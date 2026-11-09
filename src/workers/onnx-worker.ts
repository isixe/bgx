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

// 复用 OffscreenCanvas，避免每个任务重复分配三个画布。
let cachedPreprocessCanvas: OffscreenCanvas | null = null;
let cachedPreprocessCtx: OffscreenCanvasRenderingContext2D | null = null;
let cachedMaskCanvas: OffscreenCanvas | null = null;
let cachedMaskCtx: OffscreenCanvasRenderingContext2D | null = null;
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

function getMaskCanvas(
  width: number,
  height: number,
): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
  if (!cachedMaskCanvas) {
    cachedMaskCanvas = new OffscreenCanvas(width, height);
    cachedMaskCtx = cachedMaskCanvas.getContext('2d');
  } else if (cachedMaskCanvas.width !== width || cachedMaskCanvas.height !== height) {
    cachedMaskCanvas.width = width;
    cachedMaskCanvas.height = height;
  }
  if (!cachedMaskCtx) {
    throw new Error('Failed to create 2D context for mask');
  }
  return { canvas: cachedMaskCanvas, ctx: cachedMaskCtx };
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
    lap('preprocess');
    report(40);

    const inputName = inferenceSession.inputNames[0];
    const outputName = inferenceSession.outputNames[0];
    const tensor = new Tensor('float32', input, [1, 3, resolution, resolution]);
    const outputs = await inferenceSession.run({ [inputName]: tensor });
    lap('inference');
    const output = outputs[outputName];

    const rawMask = output.data;
    const mask =
      rawMask instanceof Float32Array ? rawMask : Float32Array.from(rawMask as ArrayLike<number>);
    const dims = output.dims;
    const maskWidth = dims[dims.length - 1];
    const maskHeight = dims[dims.length - 2];
    report(90);

    const { canvas: maskCanvas, ctx: maskCtx } = getMaskCanvas(maskWidth, maskHeight);
    const maskImage = maskCtx.createImageData(maskWidth, maskHeight);
    // RGBA 内存为小端序，一次 32 位写入即可同时设置常量白色 RGB 与变化的 Alpha。
    const maskU32 = new Uint32Array(maskImage.data.buffer);
    const maskArea = maskWidth * maskHeight;
    // linear 假定输出已在 [0,1]；minmax 先统计极值再线性映射到 [0,1]。
    let maskScale = 255;
    let maskOffset = 0;
    if (postprocess === 'minmax') {
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < maskArea; i += 1) {
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
    for (let i = 0; i < maskArea; i += 1) {
      const value = mask[i];
      const normalized = Number.isFinite(value) ? value : 0;
      const alpha = Math.min(255, Math.max(0, Math.round(normalized * maskScale + maskOffset)));
      maskU32[i] = (alpha << 24) | 0x00ffffff;
    }
    maskCtx.putImageData(maskImage, 0, 0);
    lap('postprocess');

    const { canvas: outputCanvas, ctx: outputCtx } = getOutputCanvas(bitmap.width, bitmap.height);
    outputCtx.drawImage(bitmap, 0, 0);
    outputCtx.globalCompositeOperation = 'destination-in';
    outputCtx.imageSmoothingEnabled = true;
    outputCtx.imageSmoothingQuality = 'high';
    outputCtx.drawImage(maskCanvas, 0, 0, bitmap.width, bitmap.height);
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
