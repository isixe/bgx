import { env, InferenceSession, Tensor } from 'onnxruntime-web';
import type { PostprocessMode, PreprocessMode } from '../types/app';
import { getMaxSessionThreads } from '../utils/concurrency';
import { ORT_WASM_URL } from './ort-wasm';

type ExecutionMode = 'gpu' | 'wasm';

const DEFAULT_PREPROCESS: PreprocessMode = 'isnet';
const DEFAULT_POSTPROCESS: PostprocessMode = 'linear';

type InboundMessage =
  | {
      type: 'PROCESS_IMAGE_TASK';
      taskId: string;
      imageBlob: Blob;
      modelUrl: string;
      resolution: number;
      preprocess?: PreprocessMode;
      postprocess?: PostprocessMode;
    }
  | { type: 'CANCEL_TASK'; taskId: string }
  | { type: 'CONFIGURE_WORKER'; numThreads: number; useGpu?: boolean }
  | { type: 'PRELOAD_MODEL'; modelUrl: string; resolution: number }
  | { type: 'UNLOAD_MODEL' }
  | { type: 'PROVIDE_MODEL'; modelUrl: string; buffer: SharedArrayBuffer }
  | { type: 'PROVIDE_WASM'; buffer: SharedArrayBuffer };

type OutboundMessage =
  | { type: 'PROGRESS_TASK'; taskId: string; progress: number }
  | { type: 'SUCCESS_TASK'; taskId: string; resultBlob: Blob }
  | { type: 'ERROR_TASK'; taskId: string; error: string; fatal: boolean }
  | { type: 'CANCELLED_TASK'; taskId: string }
  | { type: 'PRELOAD_DONE'; modelUrl: string; mode: ExecutionMode }
  | { type: 'GPU_STATUS'; active: boolean; reason?: string }
  | { type: 'TIMING_TASK'; taskId: string; timings: Record<string, number> };

interface WorkerScope {
  name: string;
  onmessage: ((event: MessageEvent<InboundMessage>) => void) | null;
  postMessage(message: OutboundMessage): void;
}

const ctx = self as unknown as WorkerScope;

// ORT 通过 new Worker(import.meta.url) 派生 pthread worker，会再次执行本文件；
// 覆盖它的 onmessage 会破坏握手，导致推理永久挂起。
const isOrtPthreadWorker = ctx.name.startsWith('em-pthread');

const FATAL_PATTERN =
  /memory access out of bounds|cannot enlarge memory|out of memory|allocation failed|RangeError|Aborted|RuntimeError|Assertion failed|OOM/i;

// WebGPU 设备丢失（驱动重置 / TDR）在推理期抛出的错误特征，用于触发无损回退。
const GPU_DEVICE_LOST_PATTERN = /device\s*(?:was\s*)?lost|GPUDevice|gpu device lost/i;

let wasmBinaryPromise: Promise<void> | null = null;
// 主线程抓取一次后透過 SharedArrayBuffer 分享過來；worker 仍需自行複製一份 ArrayBuffer，
// 因為 WebAssembly.compile 不接受以 SAB 為底的緩衝。
let providedWasmBuffer: SharedArrayBuffer | null = null;
let sessionModelUrl: string | null = null;
let sessionMode: ExecutionMode | null = null;
let session: InferenceSession | null = null;
let wantsGpu = false;
let gpuFailed = false;
// 最近一次 runInference 实际使用的执行后端，用于判断错误是否发生在 GPU 推理途中。
let lastRunMode: ExecutionMode = 'wasm';
const cancelledTasks = new Set<string>();
// ORT 只在 runtime 初始化时读取 numThreads，已建好的 session 不会跟随 CONFIGURE_WORKER 变化；
// 记录目标线程数，并在下一个任务开始（此时必无推理在跑）时重建 session。
let sessionThreads = 0;
let sessionStale = false;

// 共享模型字节（由 worker-pool 一次性读入并广播），避免每个 worker 各自重复读取模型。
const providedModelBuffers = new Map<string, Uint8Array>();

// 复用 OffscreenCanvas，避免每个任务重复分配两个画布。
let cachedPreprocessCanvas: OffscreenCanvas | null = null;
let cachedPreprocessCtx: OffscreenCanvasRenderingContext2D | null = null;
let cachedOutputCanvas: OffscreenCanvas | null = null;
let cachedOutputCtx: OffscreenCanvasRenderingContext2D | null = null;

function getPreprocessContext(size: number): OffscreenCanvasRenderingContext2D {
  if (!cachedPreprocessCanvas) {
    cachedPreprocessCanvas = new OffscreenCanvas(size, size);
    cachedPreprocessCtx = cachedPreprocessCanvas.getContext('2d', { willReadFrequently: true });
  } else if (cachedPreprocessCanvas.width !== size || cachedPreprocessCanvas.height !== size) {
    cachedPreprocessCanvas.width = size;
    cachedPreprocessCanvas.height = size;
  }
  if (!cachedPreprocessCtx) {
    throw new Error('Failed to create 2D context for preprocessing');
  }
  return cachedPreprocessCtx;
}

function getOutputCanvas(
  width: number,
  height: number,
): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
  if (!cachedOutputCanvas) {
    cachedOutputCanvas = new OffscreenCanvas(width, height);
    cachedOutputCtx = cachedOutputCanvas.getContext('2d');
  } else if (cachedOutputCanvas.width !== width || cachedOutputCanvas.height !== height) {
    cachedOutputCanvas.width = width;
    cachedOutputCanvas.height = height;
  }
  if (!cachedOutputCtx) {
    throw new Error('Failed to create 2D context for output');
  }
  return { canvas: cachedOutputCanvas, ctx: cachedOutputCtx };
}

function setWasmBinary(buffer: ArrayBuffer): void {
  (env.wasm as unknown as { wasmBinary?: ArrayBuffer }).wasmBinary = buffer;
}

async function loadWasmBinary(): Promise<ArrayBuffer> {
  if (providedWasmBuffer) {
    const copy = new ArrayBuffer(providedWasmBuffer.byteLength);
    new Uint8Array(copy).set(new Uint8Array(providedWasmBuffer));
    return copy;
  }

  const response = await fetch(ORT_WASM_URL);
  if (!response.ok) {
    throw new Error(`Failed to load WASM binary: HTTP ${response.status}`);
  }
  return response.arrayBuffer();
}

function ensureWasmBinary(): Promise<void> {
  if (!wasmBinaryPromise) {
    wasmBinaryPromise = loadWasmBinary()
      .then((buffer) => {
        setWasmBinary(buffer);
      })
      .catch((error) => {
        wasmBinaryPromise = null;
        throw error;
      });
  }
  return wasmBinaryPromise;
}

interface WebGpuAdapter {
  requestDevice(descriptor?: Record<string, unknown>): Promise<WebGpuDevice>;
}

interface WebGpuDevice {
  lost: Promise<{ reason?: string; message?: string }>;
}

interface WebGpuNavigator {
  gpu?: { requestAdapter(): Promise<WebGpuAdapter | null> };
}

// 真正向浏览器申请一次适配器，而非仅判断 navigator.gpu 是否存在：部分环境
// navigator.gpu 存在却拿不到适配器（驱动被屏蔽、纯软件渲染等）。结果缓存复用。
let adapterProbe: Promise<WebGpuAdapter | null> | null = null;

function probeWebGpuAdapter(): Promise<WebGpuAdapter | null> {
  if (!adapterProbe) {
    adapterProbe = (async () => {
      try {
        const gpu =
          typeof navigator !== 'undefined'
            ? (navigator as unknown as WebGpuNavigator).gpu
            : undefined;
        if (!gpu) {
          return null;
        }
        return await gpu.requestAdapter();
      } catch {
        return null;
      }
    })();
  }
  return adapterProbe;
}

// ORT 在 EP 内部自行创建 GPUDevice，外部拿不到引用。这里用同一适配器额外申请一个
// 监控设备：物理 GPU 重置时该适配器的所有设备都会触发 lost，作为可靠的失效信号。
let deviceMonitorStarted = false;

function watchGpuDeviceLoss(adapter: WebGpuAdapter): void {
  if (deviceMonitorStarted) {
    return;
  }
  deviceMonitorStarted = true;
  void adapter
    .requestDevice()
    .then((device) => {
      void device.lost.then((info) => {
        deviceMonitorStarted = false;
        if (gpuFailed) {
          return;
        }
        gpuFailed = true;
        postGpuStatus(false, `GPU device lost: ${info?.message ?? info?.reason ?? 'unknown'}`);
        void releaseSession();
      });
    })
    .catch((error) => {
      deviceMonitorStarted = false;
      console.warn('Failed to start GPU device loss monitor:', error);
    });
}

function postGpuStatus(active: boolean, reason?: string): void {
  ctx.postMessage({ type: 'GPU_STATUS', active, reason });
}

async function releaseSession(): Promise<void> {
  const current = session;
  session = null;
  sessionModelUrl = null;
  sessionMode = null;
  if (current) {
    try {
      await current.release();
    } catch (error) {
      console.warn('Failed to release inference session:', error);
    }
  }
}

// 只能在任务边界调用：重建 session 期间不能有推理在跑。
async function applyPendingThreadChange(): Promise<void> {
  if (!sessionStale) {
    return;
  }
  sessionStale = false;
  await releaseSession();
}

function buildSession(data: Uint8Array, mode: ExecutionMode): Promise<InferenceSession> {
  return InferenceSession.create(data, {
    executionProviders: mode === 'gpu' ? ['webgpu', 'wasm'] : ['wasm'],
    graphOptimizationLevel: 'all',
    executionMode: 'sequential',
    enableCpuMemArena: true,
    enableMemPattern: true,
  });
}

async function createSession(
  modelUrl: string,
  mode: ExecutionMode,
  providedBuffer?: Uint8Array,
): Promise<InferenceSession> {
  if (providedBuffer) {
    try {
      return await buildSession(providedBuffer, mode);
    } catch (error) {
      console.warn('Shared model buffer rejected, falling back to fetch:', error);
    }
  }

  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`Failed to load model: HTTP ${response.status}`);
  }
  return buildSession(new Uint8Array(await response.arrayBuffer()), mode);
}

async function resolveExecutionMode(): Promise<ExecutionMode> {
  if (!wantsGpu || gpuFailed) {
    return 'wasm';
  }

  const adapter = await probeWebGpuAdapter();
  if (!adapter) {
    gpuFailed = true;
    postGpuStatus(false, 'WebGPU adapter unavailable');
    return 'wasm';
  }

  watchGpuDeviceLoss(adapter);
  return 'gpu';
}

async function getSession(modelUrl: string): Promise<InferenceSession> {
  const desiredMode = await resolveExecutionMode();

  if (session && sessionModelUrl === modelUrl && sessionMode === desiredMode) {
    return session;
  }

  await releaseSession();
  await ensureWasmBinary();

  const providedBuffer = providedModelBuffers.get(modelUrl);

  if (desiredMode === 'gpu') {
    try {
      session = await createSession(modelUrl, 'gpu', providedBuffer);
      sessionMode = 'gpu';
      sessionModelUrl = modelUrl;
      postGpuStatus(true);
      return session;
    } catch (error) {
      gpuFailed = true;
      postGpuStatus(false, error instanceof Error ? error.message : String(error));
    }
  }

  session = await createSession(modelUrl, 'wasm', providedBuffer);
  sessionMode = 'wasm';
  sessionModelUrl = modelUrl;
  return session;
}

async function warmupSession(target: InferenceSession, resolution: number): Promise<void> {
  if (!Number.isFinite(resolution) || resolution <= 0) {
    return;
  }
  const area = resolution * resolution;
  const inputName = target.inputNames[0];
  const tensor = new Tensor('float32', new Float32Array(area * 3), [1, 3, resolution, resolution]);
  try {
    await target.run({ [inputName]: tensor });
  } finally {
    const disposable = tensor as unknown as { dispose?: () => void };
    disposable.dispose?.();
  }
}

// 各模型的归一化本质是对每个通道做仿射变换 out = x*scale + offset（x 为 0-255）。
// 预计算为常量，避免在逐像素循环里做分支判断。
function getPreprocessAffine(mode: PreprocessMode): { scale: number[]; offset: number[] } {
  switch (mode) {
    case 'imagenet':
      // U2Net 系列：ImageNet 均值 (0.485,0.456,0.406)、标准差 (0.229,0.224,0.225)
      return {
        scale: [1 / (255 * 0.229), 1 / (255 * 0.224), 1 / (255 * 0.225)],
        offset: [-0.485 / 0.229, -0.456 / 0.224, -0.406 / 0.225],
      };
    case 'modnet':
      // MODNet：mean 0.5、std 0.5，等价于 (x/255 - 0.5) / 0.5，范围 [-1, 1]
      return {
        scale: [2 / 255, 2 / 255, 2 / 255],
        offset: [-1, -1, -1],
      };
    case 'isnet':
    default:
      // ISNet / BRIA RMBG：x/255 - 0.5
      return { scale: [1 / 255, 1 / 255, 1 / 255], offset: [-0.5, -0.5, -0.5] };
  }
}

// 边缘带重算：粗推理在低分辨率下完成，再把 alpha 处于过渡区间的格子按原始
// 分辨率重跑一次，用更密的采样修正边缘。
const EDGE_BAND_LOW = 16;
const EDGE_BAND_HIGH = 239;
// 真实照片的过渡像素散布全图，用外接框判断必然退化成整图；改为网格分块，
// 只重算含有足够多过渡像素的格子，每格独立放大到模型分辨率以获得更密的采样。
const EDGE_REFINE_GRID = 3;
const EDGE_REFINE_MAX_TILES = 4;
const EDGE_REFINE_CELL_BAND_RATIO = 0.02;
const EDGE_REFINE_PADDING = 0.08;
const EDGE_REFINE_FEATHER = 0.18;

function toAlpha(mask: Float32Array, postprocess: PostprocessMode): Uint8ClampedArray {
  const area = mask.length;
  const alpha = new Uint8ClampedArray(area);
  // linear 假定输出已在 [0,1]；minmax 先统计极值再线性映射到 [0,1]。
  let maskScale = 255;
  let maskOffset = 0;
  if (postprocess === 'minmax') {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < area; i += 1) {
      const value = mask[i];
      if (Number.isFinite(value)) {
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }
    const range = max - min;
    if (range > 0) {
      maskScale = 255 / range;
      maskOffset = -min * maskScale;
    }
  }
  for (let i = 0; i < area; i += 1) {
    const value = mask[i];
    const normalized = Number.isFinite(value) ? value : 0;
    alpha[i] = normalized * maskScale + maskOffset;
  }
  return alpha;
}

function buildInput(
  pixels: Uint8ClampedArray,
  resolution: number,
  preprocess: PreprocessMode,
): Float32Array {
  const area = resolution * resolution;
  const input = new Float32Array(area * 3);
  const affine = getPreprocessAffine(preprocess);
  const scaleR = affine.scale[0];
  const scaleG = affine.scale[1];
  const scaleB = affine.scale[2];
  const offsetR = affine.offset[0];
  const offsetG = affine.offset[1];
  const offsetB = affine.offset[2];
  for (let i = 0; i < area; i += 1) {
    const pixel = i * 4;
    input[i] = pixels[pixel] * scaleR + offsetR;
    input[area + i] = pixels[pixel + 1] * scaleG + offsetG;
    input[area * 2 + i] = pixels[pixel + 2] * scaleB + offsetB;
  }
  return input;
}

interface MaskPrediction {
  alpha: Uint8ClampedArray;
  width: number;
  height: number;
}

async function predictMask(
  inferenceSession: InferenceSession,
  pixels: Uint8ClampedArray,
  resolution: number,
  preprocess: PreprocessMode,
  postprocess: PostprocessMode,
): Promise<MaskPrediction> {
  const input = buildInput(pixels, resolution, preprocess);
  const inputName = inferenceSession.inputNames[0];
  const outputName = inferenceSession.outputNames[0];
  const tensor = new Tensor('float32', input, [1, 3, resolution, resolution]);
  const outputs = await inferenceSession.run({ [inputName]: tensor });
  const output = outputs[outputName];
  const raw = output.data;
  const mask = raw instanceof Float32Array ? raw : Float32Array.from(raw as ArrayLike<number>);
  const dims = output.dims;
  return {
    alpha: toAlpha(mask, postprocess),
    width: dims[dims.length - 1],
    height: dims[dims.length - 2],
  };
}

function paintMask(alpha: Uint8ClampedArray, width: number, height: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to create 2D context for refined mask');
  }
  const image = context.createImageData(width, height);
  const pixels = new Uint32Array(image.data.buffer);
  for (let i = 0; i < pixels.length; i += 1) {
    pixels[i] = (alpha[i] << 24) | 0x00ffffff;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

// 以椭圆径向渐变做边缘羽化，避免重算区域与粗结果之间出现硬接缝。
function featherCanvas(canvas: OffscreenCanvas): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const { width, height } = canvas;
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * (0.5 - EDGE_REFINE_FEATHER),
    width / 2,
    height / 2,
    Math.max(width, height) * 0.5,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.globalCompositeOperation = 'destination-in';
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
}

async function refineEdges(
  inferenceSession: InferenceSession,
  bitmap: ImageBitmap,
  coarse: MaskPrediction,
  resolution: number,
  preprocess: PreprocessMode,
  postprocess: PostprocessMode,
): Promise<OffscreenCanvas | null> {
  const { alpha, width, height } = coarse;
  const cellWidth = Math.ceil(width / EDGE_REFINE_GRID);
  const cellHeight = Math.ceil(height / EDGE_REFINE_GRID);

  const candidates: Array<{ cx: number; cy: number; band: number }> = [];
  for (let cy = 0; cy < EDGE_REFINE_GRID; cy += 1) {
    for (let cx = 0; cx < EDGE_REFINE_GRID; cx += 1) {
      const startX = cx * cellWidth;
      const startY = cy * cellHeight;
      const endX = Math.min(width, startX + cellWidth);
      const endY = Math.min(height, startY + cellHeight);
      const cellArea = (endX - startX) * (endY - startY);
      if (cellArea <= 0) {
        continue;
      }
      let band = 0;
      for (let y = startY; y < endY; y += 1) {
        const row = y * width;
        for (let x = startX; x < endX; x += 1) {
          const value = alpha[row + x];
          if (value > EDGE_BAND_LOW && value < EDGE_BAND_HIGH) {
            band += 1;
          }
        }
      }
      if (band / cellArea >= EDGE_REFINE_CELL_BAND_RATIO) {
        candidates.push({ cx, cy, band });
      }
    }
  }
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.band - a.band);
  const selected = candidates.slice(0, EDGE_REFINE_MAX_TILES);

  const scaleX = bitmap.width / width;
  const scaleY = bitmap.height / height;
  const alphaCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const alphaContext = alphaCanvas.getContext('2d');
  if (!alphaContext) {
    return null;
  }
  alphaContext.imageSmoothingEnabled = true;
  alphaContext.imageSmoothingQuality = 'high';
  alphaContext.drawImage(paintMask(alpha, width, height), 0, 0, bitmap.width, bitmap.height);

  for (const cell of selected) {
    const startX = cell.cx * cellWidth;
    const startY = cell.cy * cellHeight;
    const endX = Math.min(width, startX + cellWidth);
    const endY = Math.min(height, startY + cellHeight);
    const padX = (endX - startX) * EDGE_REFINE_PADDING;
    const padY = (endY - startY) * EDGE_REFINE_PADDING;
    let left = Math.floor((startX - padX) * scaleX);
    let top = Math.floor((startY - padY) * scaleY);
    const right = Math.ceil((endX + padX) * scaleX);
    const bottom = Math.ceil((endY + padY) * scaleY);

    // 模型输入是正方形，取覆盖该格的最大边长并居中，避免拉伸导致 alpha 错位。
    const side = Math.max(right - left, bottom - top);
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    left = Math.round(centerX - side / 2);
    top = Math.round(centerY - side / 2);
    left = Math.max(0, Math.min(left, Math.max(0, bitmap.width - side)));
    top = Math.max(0, Math.min(top, Math.max(0, bitmap.height - side)));
    const cropSize = Math.min(side, bitmap.width - left, bitmap.height - top);
    if (cropSize <= 0) {
      continue;
    }

    const crop = await createImageBitmap(bitmap, left, top, cropSize, cropSize, {
      resizeWidth: resolution,
      resizeHeight: resolution,
      resizeQuality: 'high',
    });
    const cropCanvas = new OffscreenCanvas(resolution, resolution);
    const cropContext = cropCanvas.getContext('2d', { willReadFrequently: true });
    if (!cropContext) {
      crop.close();
      continue;
    }
    cropContext.drawImage(crop, 0, 0);
    crop.close();
    const cropPixels = cropContext.getImageData(0, 0, resolution, resolution).data;
    const refined = await predictMask(
      inferenceSession,
      cropPixels,
      resolution,
      preprocess,
      postprocess,
    );

    const tile = paintMask(refined.alpha, refined.width, refined.height);
    featherCanvas(tile);
    alphaContext.drawImage(tile, left, top, cropSize, cropSize);
  }

  return alphaCanvas;
}

async function runInference(
  imageBlob: Blob,
  modelUrl: string,
  resolution: number,
  report: (progress: number) => void,
  timings: Record<string, number>,
  preprocess: PreprocessMode,
  postprocess: PostprocessMode,
): Promise<Blob> {
  let last = Date.now();
  const lap = (key: string) => {
    const now = Date.now();
    timings[key] = now - last;
    last = now;
  };

  const inferenceSession = await getSession(modelUrl);
  lastRunMode = sessionMode ?? 'wasm';
  lap('session');
  report(25);

  const bitmap = await createImageBitmap(imageBlob);
  lap('decode');

  try {
    const workCtx = getPreprocessContext(resolution);
    workCtx.imageSmoothingEnabled = true;
    workCtx.imageSmoothingQuality = 'high';
    // 用 bitmap 自带的缩放器生成小图，避免在 willReadFrequently 软件画布上做大图高质量缩放。
    const resized = await createImageBitmap(bitmap, {
      resizeWidth: resolution,
      resizeHeight: resolution,
      resizeQuality: 'high',
    });
    workCtx.drawImage(resized, 0, 0, resolution, resolution);
    resized.close();

    const pixels = workCtx.getImageData(0, 0, resolution, resolution).data;
    lap('preprocess');
    report(40);

    const coarse = await predictMask(inferenceSession, pixels, resolution, preprocess, postprocess);
    lap('inference');
    report(90);

    const coarseCanvas = paintMask(coarse.alpha, coarse.width, coarse.height);
    lap('postprocess');

    const refined = await refineEdges(
      inferenceSession,
      bitmap,
      coarse,
      resolution,
      preprocess,
      postprocess,
    );
    const alphaSource: OffscreenCanvas = refined ?? coarseCanvas;
    lap('refine');

    const { canvas: outputCanvas, ctx: outputCtx } = getOutputCanvas(bitmap.width, bitmap.height);
    // 画布是复用的：上一次任务留下的 destination-in 与像素必须清掉，否则同尺寸的
    // 下一个任务会把上一张图的画面当作底图，产出「别的图片」的结果。
    outputCtx.globalCompositeOperation = 'source-over';
    outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    outputCtx.drawImage(bitmap, 0, 0);
    outputCtx.globalCompositeOperation = 'destination-in';
    outputCtx.imageSmoothingEnabled = true;
    outputCtx.imageSmoothingQuality = 'high';
    outputCtx.drawImage(alphaSource, 0, 0, bitmap.width, bitmap.height);
    lap('composite');
    report(95);

    const resultBlob = await outputCanvas.convertToBlob({ type: 'image/png' });
    lap('encode');
    report(100);
    return resultBlob;
  } finally {
    bitmap.close();
  }
}

// GPU 设备在推理途中丢失时，同一个 worker 内无损回退到 WASM 重跑一次，
// 避免把错误冒泡给上层导致整个任务失败。
async function runInferenceWithFallback(
  imageBlob: Blob,
  modelUrl: string,
  resolution: number,
  report: (progress: number) => void,
  timings: Record<string, number>,
  preprocess: PreprocessMode,
  postprocess: PostprocessMode,
): Promise<Blob> {
  try {
    return await runInference(
      imageBlob,
      modelUrl,
      resolution,
      report,
      timings,
      preprocess,
      postprocess,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (lastRunMode !== 'gpu' || !GPU_DEVICE_LOST_PATTERN.test(errorMessage)) {
      throw error;
    }
    if (!gpuFailed) {
      gpuFailed = true;
      postGpuStatus(false, errorMessage);
    }
    await releaseSession();
    return await runInference(
      imageBlob,
      modelUrl,
      resolution,
      report,
      timings,
      preprocess,
      postprocess,
    );
  }
}

async function handleTask(
  message: Extract<InboundMessage, { type: 'PROCESS_IMAGE_TASK' }>,
): Promise<void> {
  const { taskId } = message;
  cancelledTasks.delete(taskId);
  await applyPendingThreadChange();

  const report = (progress: number) => {
    if (!cancelledTasks.has(taskId)) {
      ctx.postMessage({ type: 'PROGRESS_TASK', taskId, progress });
    }
  };

  const timings: Record<string, number> = {};

  try {
    await ensureWasmBinary();
    report(10);

    if (cancelledTasks.has(taskId)) {
      ctx.postMessage({ type: 'CANCELLED_TASK', taskId });
      return;
    }

    const resultBlob = await runInferenceWithFallback(
      message.imageBlob,
      message.modelUrl,
      message.resolution,
      report,
      timings,
      message.preprocess ?? DEFAULT_PREPROCESS,
      message.postprocess ?? DEFAULT_POSTPROCESS,
    );

    if (cancelledTasks.has(taskId)) {
      ctx.postMessage({ type: 'CANCELLED_TASK', taskId });
      return;
    }

    ctx.postMessage({ type: 'SUCCESS_TASK', taskId, resultBlob });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fatal = FATAL_PATTERN.test(errorMessage);

    if (fatal) {
      await releaseSession();
    }

    if (cancelledTasks.has(taskId)) {
      ctx.postMessage({ type: 'CANCELLED_TASK', taskId });
      return;
    }

    ctx.postMessage({ type: 'ERROR_TASK', taskId, error: errorMessage, fatal });
  } finally {
    ctx.postMessage({ type: 'TIMING_TASK', taskId, timings });
    cancelledTasks.delete(taskId);
  }
}

async function handlePreload(
  message: Extract<InboundMessage, { type: 'PRELOAD_MODEL' }>,
): Promise<void> {
  try {
    await applyPendingThreadChange();
    const target = await getSession(message.modelUrl);
    await warmupSession(target, message.resolution);
  } catch (error) {
    console.warn('Model preload/warmup failed:', error);
  } finally {
    ctx.postMessage({
      type: 'PRELOAD_DONE',
      modelUrl: message.modelUrl,
      mode: sessionMode ?? 'wasm',
    });
  }
}

function handleMessage(event: MessageEvent<InboundMessage>): void {
  const message = event.data;
  if (!message || typeof message !== 'object') {
    return;
  }

  if (message.type === 'CANCEL_TASK') {
    cancelledTasks.add(message.taskId);
    return;
  }

  if (message.type === 'CONFIGURE_WORKER') {
    const nextThreads = Math.max(
      1,
      Math.min(getMaxSessionThreads(), Math.floor(message.numThreads)),
    );
    if (nextThreads !== sessionThreads) {
      sessionThreads = nextThreads;
      env.wasm.numThreads = nextThreads;
      sessionStale = session !== null;
    }
    if (typeof message.useGpu === 'boolean') {
      if (message.useGpu && !wantsGpu) {
        gpuFailed = false;
      }
      wantsGpu = message.useGpu;
    }
    return;
  }

  if (message.type === 'PRELOAD_MODEL') {
    void handlePreload(message);
    return;
  }

  if (message.type === 'UNLOAD_MODEL') {
    void releaseSession();
    return;
  }

  if (message.type === 'PROVIDE_MODEL') {
    providedModelBuffers.set(message.modelUrl, new Uint8Array(message.buffer));
    return;
  }

  if (message.type === 'PROVIDE_WASM') {
    providedWasmBuffer = message.buffer;
    return;
  }

  if (message.type === 'PROCESS_IMAGE_TASK') {
    void handleTask(message);
  }
}

if (!isOrtPthreadWorker) {
  ctx.onmessage = handleMessage;
}
