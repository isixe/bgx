import { env, InferenceSession, Tensor } from 'onnxruntime-web';

type InboundMessage =
  | {
      type: 'PROCESS_IMAGE_TASK';
      taskId: string;
      imageBlob: Blob;
      modelUrl: string;
      resolution: number;
    }
  | { type: 'CANCEL_TASK'; taskId: string }
  | { type: 'UNLOAD_MODEL' };

type OutboundMessage =
  | { type: 'PROGRESS_TASK'; taskId: string; progress: number }
  | { type: 'SUCCESS_TASK'; taskId: string; resultBlob: Blob }
  | { type: 'ERROR_TASK'; taskId: string; error: string; fatal: boolean }
  | { type: 'CANCELLED_TASK'; taskId: string };

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

let wasmBinaryPromise: Promise<void> | null = null;
let sessionModelUrl: string | null = null;
let session: InferenceSession | null = null;
const cancelledTasks = new Set<string>();

function setWasmBinary(buffer: ArrayBuffer): void {
  (env.wasm as unknown as { wasmBinary?: ArrayBuffer }).wasmBinary = buffer;
}

function ensureWasmBinary(): Promise<void> {
  if (!wasmBinaryPromise) {
    wasmBinaryPromise = fetch('/ort-wasm-simd-threaded.wasm')
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

async function releaseSession(): Promise<void> {
  const current = session;
  session = null;
  sessionModelUrl = null;
  if (current) {
    try {
      await current.release();
    } catch (error) {
      console.warn('Failed to release inference session:', error);
    }
  }
}

async function getSession(modelUrl: string): Promise<InferenceSession> {
  if (session && sessionModelUrl === modelUrl) {
    return session;
  }

  await releaseSession();

  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`Failed to load model: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();

  const created = await InferenceSession.create(buffer, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
    executionMode: 'sequential',
    enableCpuMemArena: false,
    enableMemPattern: false,
  });

  session = created;
  sessionModelUrl = modelUrl;
  return created;
}

async function runInference(
  imageBlob: Blob,
  modelUrl: string,
  resolution: number,
  report: (progress: number) => void,
): Promise<Blob> {
  const inferenceSession = await getSession(modelUrl);
  report(25);

  const bitmap = await createImageBitmap(imageBlob);

  try {
    const work = new OffscreenCanvas(resolution, resolution);
    const workCtx = work.getContext('2d', { willReadFrequently: true });
    if (!workCtx) {
      throw new Error('Failed to create 2D context for preprocessing');
    }
    workCtx.imageSmoothingEnabled = true;
    workCtx.imageSmoothingQuality = 'high';
    workCtx.drawImage(bitmap, 0, 0, resolution, resolution);

    const pixels = workCtx.getImageData(0, 0, resolution, resolution).data;
    const area = resolution * resolution;
    const input = new Float32Array(area * 3);
    for (let i = 0; i < area; i += 1) {
      const pixel = i * 4;
      input[i] = (pixels[pixel] - 128) / 256;
      input[area + i] = (pixels[pixel + 1] - 128) / 256;
      input[area * 2 + i] = (pixels[pixel + 2] - 128) / 256;
    }
    report(40);

    const inputName = inferenceSession.inputNames[0];
    const outputName = inferenceSession.outputNames[0];
    const tensor = new Tensor('float32', input, [1, 3, resolution, resolution]);
    const outputs = await inferenceSession.run({ [inputName]: tensor });
    const output = outputs[outputName];

    const rawMask = output.data;
    const mask = rawMask instanceof Float32Array ? rawMask : Float32Array.from(rawMask as ArrayLike<number>);
    const dims = output.dims;
    const maskWidth = dims[dims.length - 1];
    const maskHeight = dims[dims.length - 2];
    report(75);

    const maskCanvas = new OffscreenCanvas(maskWidth, maskHeight);
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) {
      throw new Error('Failed to create 2D context for mask');
    }
    const maskImage = maskCtx.createImageData(maskWidth, maskHeight);
    const maskPixels = maskImage.data;
    const maskArea = maskWidth * maskHeight;
    for (let i = 0; i < maskArea; i += 1) {
      const value = mask[i];
      const alpha = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)) * 255;
      const pixel = i * 4;
      maskPixels[pixel] = 255;
      maskPixels[pixel + 1] = 255;
      maskPixels[pixel + 2] = 255;
      maskPixels[pixel + 3] = alpha;
    }
    maskCtx.putImageData(maskImage, 0, 0);

    const outputCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) {
      throw new Error('Failed to create 2D context for output');
    }
    outputCtx.drawImage(bitmap, 0, 0);
    outputCtx.globalCompositeOperation = 'destination-in';
    outputCtx.imageSmoothingEnabled = true;
    outputCtx.imageSmoothingQuality = 'high';
    outputCtx.drawImage(maskCanvas, 0, 0, bitmap.width, bitmap.height);
    report(90);

    const resultBlob = await outputCanvas.convertToBlob({ type: 'image/png' });
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
    cancelledTasks.delete(taskId);
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

  if (message.type === 'UNLOAD_MODEL') {
    void releaseSession();
    return;
  }

  if (message.type === 'PROCESS_IMAGE_TASK') {
    void handleTask(message);
  }
}

if (!isOrtPthreadWorker) {
  ctx.onmessage = handleMessage;
}
