import { env, InferenceSession, Tensor } from 'onnxruntime-web';
import type { PreprocessMode } from '../types/app';

type ExecutionMode = 'gpu' | 'wasm';

const DEFAULT_PREPROCESS: PreprocessMode = 'isnet';

type InboundMessage =
  | {
      type: 'PROCESS_IMAGE_TASK';
      taskId: string;
      imageBlob: Blob;
      modelUrl: string;
      resolution: number;
      preprocess?: PreprocessMode;
    }
  | { type: 'CANCEL_TASK'; taskId: string }
  | { type: 'CONFIGURE_WORKER'; numThreads: number; useGpu?: boolean }
  | { type: 'PRELOAD_MODEL'; modelUrl: string; resolution: number }
  | { type: 'UNLOAD_MODEL' }
  | { type: 'PROVIDE_MODEL'; modelUrl: string; buffer: SharedArrayBuffer };

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

// onnxruntime-web/webgpu 内置的是 asyncify 版 WASM 胶水，必须加载与之 ABI 匹配的
// ort-wasm-simd-threaded.asyncify.wasm（由 postinstall 复制到 public/），否则后端初始化会失败。
const WASM_URL = '/ort-wasm-simd-threaded.asyncify.wasm';

let wasmBinaryPromise: Promise<void> | null = null;
let sessionModelUrl: string | null = null;
let sessionMode: ExecutionMode | null = null;
let session: InferenceSession | null = null;
let wantsGpu = false;
let gpuFailed = false;
const cancelledTasks = new Set<string>();

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

function ensureWasmBinary(): Promise<void> {
  if (!wasmBinaryPromise) {
    wasmBinaryPromise = fetch(WASM_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load WASM binary: HTTP ${response.status}`);
        }
        return response.arrayBuffer();
      })
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

function hasWebGpu(): boolean {
  try {
    return typeof navigator !== 'undefined' && Boolean((navigator as { gpu?: unknown }).gpu);
  } catch {
    return false;
  }
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

async function getSession(modelUrl: string): Promise<InferenceSession> {
  const desiredMode: ExecutionMode = wantsGpu && !gpuFailed && hasWebGpu() ? 'gpu' : 'wasm';

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
  } else if (wantsGpu && !gpuFailed && !hasWebGpu()) {
    postGpuStatus(false, 'WebGPU not available');
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
): Promise<Blob> {
  let last = Date.now();
  const lap = (key: string) => {
    const now = Date.now();
    timings[key] = now - last;
    last = now;
  };

  const inferenceSession = await getSession(modelUrl);
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
    for (let i = 0; i < maskArea; i += 1) {
      const value = mask[i];
      const normalized = Number.isFinite(value) ? value : 0;
      const alpha = Math.min(255, Math.max(0, Math.round(normalized * 255)));
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

async function handleTask(
  message: Extract<InboundMessage, { type: 'PROCESS_IMAGE_TASK' }>,
): Promise<void> {
  const { taskId } = message;
  cancelledTasks.delete(taskId);

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

    const resultBlob = await runInference(
      message.imageBlob,
      message.modelUrl,
      message.resolution,
      report,
      timings,
      message.preprocess ?? DEFAULT_PREPROCESS,
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
    env.wasm.numThreads = Math.max(1, Math.min(4, Math.floor(message.numThreads)));
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

  if (message.type === 'PROCESS_IMAGE_TASK') {
    void handleTask(message);
  }
}

if (!isOrtPthreadWorker) {
  ctx.onmessage = handleMessage;
}
