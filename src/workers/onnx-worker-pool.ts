import {
  clampBatchConcurrency,
  DEFAULT_BATCH_CONCURRENCY,
  getMaxWorkersForModelBytes,
  getSessionThreads,
  GPU_CONCURRENCY,
} from '../utils/concurrency';
import type { PostprocessMode, PreprocessMode } from '../types/app';

export interface PoolImageResult {
  type: 'success' | 'error' | 'cancelled';
  blob?: Blob;
  error?: string;
}

interface PendingTask {
  id: string;
  imageBlob: Blob;
  modelUrl: string;
  resolution: number;
  preprocess?: PreprocessMode;
  postprocess?: PostprocessMode;
  onProgress?: (progress: number) => void;
  attempts: number;
  inferenceStartedAt: number | null;
  progressTimer: ReturnType<typeof setInterval> | null;
  resolve: (result: PoolImageResult) => void;
}

interface WorkerSlot {
  worker: Worker;
  busy: boolean;
  preloading: boolean;
  currentTaskId: string | null;
  index: number;
}

type WorkerMessage =
  | { type: 'PROGRESS_TASK'; taskId: string; progress: number }
  | { type: 'SUCCESS_TASK'; taskId: string; resultBlob: Blob }
  | { type: 'ERROR_TASK'; taskId: string; error: string; fatal: boolean }
  | { type: 'CANCELLED_TASK'; taskId: string }
  | { type: 'PRELOAD_DONE'; modelUrl: string; mode: 'gpu' | 'wasm' }
  | { type: 'GPU_STATUS'; active: boolean; reason?: string }
  | { type: 'TIMING_TASK'; taskId: string; timings: Record<string, number> };

const FATAL_PATTERN =
  /memory access out of bounds|cannot enlarge memory|out of memory|allocation failed|RangeError|Aborted|RuntimeError|Assertion failed|OOM/i;

const MAX_ATTEMPTS = 2;

const PROGRESS_TICK_MS = 250;
const INFERENCE_PROGRESS_START = 40;
const INFERENCE_PROGRESS_END = 90;
const INFERENCE_EWMA_ALPHA = 0.3;
const ESTIMATE_BASE_MS = 1200;
const ESTIMATE_BASE_PIXELS = 320 * 320;

let estimatedInferenceMs: number | null = null;

function estimateInferenceMs(resolution: number): number {
  if (estimatedInferenceMs !== null) {
    return estimatedInferenceMs;
  }
  return (resolution * resolution * ESTIMATE_BASE_MS) / ESTIMATE_BASE_PIXELS;
}

function recordInferenceMs(durationMs: number): void {
  estimatedInferenceMs =
    estimatedInferenceMs === null
      ? durationMs
      : estimatedInferenceMs * (1 - INFERENCE_EWMA_ALPHA) + durationMs * INFERENCE_EWMA_ALPHA;
}

function asymptoticEase(elapsed: number, timeConstant: number): number {
  return 1 - Math.exp(-elapsed / timeConstant);
}

export class OnnxWorkerPool {
  private readonly slots: WorkerSlot[] = [];
  private readonly pendingTasks: PendingTask[] = [];
  private readonly activeTasks = new Map<string, PendingTask>();
  private readonly modelBuffers = new Map<string, SharedArrayBuffer>();
  private readonly modelBufferRequests = new Map<string, Promise<void>>();
  private disposed = false;
  // 存原始请求值，切换 GPU/CPU 模式时按新模式重新夹取，避免沿用上一模式夹过的值。
  private requestedConcurrency = DEFAULT_BATCH_CONCURRENCY;
  // 单图流程传 1：只有一个 worker 时让它独占全部线程；null 表示按并发容量切分。
  private jobConcurrency: number | null = null;
  private useGpu = true;
  private gpuActive: boolean | null = null;
  private currentModelBytes = 0;

  onGpuStatus: ((status: { active: boolean; reason?: string }) => void) | null = null;

  get poolSize(): number {
    return this.plannedWorkers;
  }

  // GPU 模式下模型常驻显存，不受 CPU 堆内存预算约束，因此跳过该上限。
  private get effectiveConcurrency(): number {
    if (this.useGpu) {
      return GPU_CONCURRENCY;
    }
    const requested = clampBatchConcurrency(Math.max(1, Math.round(this.requestedConcurrency)));
    return Math.max(1, Math.min(requested, getMaxWorkersForModelBytes(this.currentModelBytes)));
  }

  get concurrency(): number {
    return this.effectiveConcurrency;
  }

  private get plannedWorkers(): number {
    const requested = this.jobConcurrency ?? this.effectiveConcurrency;
    return Math.max(1, Math.min(this.effectiveConcurrency, Math.round(requested)));
  }

  setConcurrency(limit: number): void {
    const before = this.effectiveConcurrency;
    this.requestedConcurrency = limit;
    if (this.effectiveConcurrency === before) {
      return;
    }

    this.trimSlots();
    this.applyThreadConfig();
    this.drainQueue();
  }

  setJobConcurrency(limit: number | null): void {
    const normalized = limit === null ? null : Math.max(1, Math.round(limit));
    if (normalized === this.jobConcurrency) {
      return;
    }

    this.jobConcurrency = normalized;
    this.trimSlots();
    this.applyThreadConfig();
    this.drainQueue();
  }

  setUseGpu(useGpu: boolean): void {
    if (this.disposed || useGpu === this.useGpu) {
      return;
    }

    this.useGpu = useGpu;
    this.trimSlots();
    this.applyThreadConfig();
    this.drainQueue();
  }

  preload(modelUrl: string, resolution: number): void {
    if (this.disposed || !modelUrl) {
      return;
    }

    this.ensureModelBuffer(modelUrl);
    this.ensureSlots(this.plannedWorkers);

    for (const slot of this.slots) {
      if (slot.busy || slot.preloading) {
        continue;
      }
      slot.preloading = true;
      slot.worker.postMessage({ type: 'PRELOAD_MODEL', modelUrl, resolution });
    }
  }

  get activeCount(): number {
    return this.activeTasks.size;
  }

  get pendingCount(): number {
    return this.pendingTasks.length;
  }

  processImage(
    taskId: string,
    imageBlob: Blob,
    modelUrl: string,
    resolution: number,
    preprocess?: PreprocessMode,
    postprocess?: PostprocessMode,
    onProgress?: (progress: number) => void,
  ): Promise<PoolImageResult> {
    if (this.disposed) {
      return Promise.resolve({ type: 'error', error: 'Worker pool has been disposed' });
    }

    return new Promise<PoolImageResult>((resolve) => {
      this.pendingTasks.push({
        id: taskId,
        imageBlob,
        modelUrl,
        resolution,
        preprocess,
        postprocess,
        onProgress,
        attempts: 0,
        inferenceStartedAt: null,
        progressTimer: null,
        resolve,
      });
      this.ensureModelBuffer(modelUrl);
      this.drainQueue();
    });
  }

  cancelTask(taskId: string): void {
    const pendingIndex = this.pendingTasks.findIndex((task) => task.id === taskId);
    if (pendingIndex >= 0) {
      const [task] = this.pendingTasks.splice(pendingIndex, 1);
      task.resolve({ type: 'cancelled' });
      return;
    }

    const slot = this.slots.find((candidate) => candidate.currentTaskId === taskId);
    if (slot) {
      slot.worker.postMessage({ type: 'CANCEL_TASK', taskId });
    }
  }

  cancelAll(): void {
    while (this.pendingTasks.length > 0) {
      const task = this.pendingTasks.shift();
      task?.resolve({ type: 'cancelled' });
    }

    for (const slot of this.slots) {
      if (slot.currentTaskId) {
        slot.worker.postMessage({ type: 'CANCEL_TASK', taskId: slot.currentTaskId });
      }
    }
  }

  dispose(): void {
    this.disposed = true;

    while (this.pendingTasks.length > 0) {
      const task = this.pendingTasks.shift();
      task?.resolve({ type: 'cancelled' });
    }

    for (const task of this.activeTasks.values()) {
      this.clearProgressTimer(task);
      task.resolve({ type: 'cancelled' });
    }
    this.activeTasks.clear();

    for (const slot of this.slots) {
      slot.worker.terminate();
    }
    this.slots.length = 0;
    this.modelBuffers.clear();
    this.modelBufferRequests.clear();
  }

  private ensureModelBuffer(modelUrl: string): void {
    if (
      this.disposed ||
      !modelUrl ||
      typeof SharedArrayBuffer === 'undefined' ||
      this.modelBuffers.has(modelUrl) ||
      this.modelBufferRequests.has(modelUrl)
    ) {
      return;
    }

    // 只抓取一次模型字節，透過 SharedArrayBuffer 共享給所有 worker，
    // 避免每個 worker 各自 fetch 同一模型造成併發時的內存峰值。
    const request = (async () => {
      try {
        const response = await fetch(modelUrl);
        if (!response.ok) {
          return;
        }
        const bytes = await response.arrayBuffer();
        if (this.disposed) {
          return;
        }
        const shared = new SharedArrayBuffer(bytes.byteLength);
        new Uint8Array(shared).set(new Uint8Array(bytes));
        this.modelBuffers.set(modelUrl, shared);
        this.broadcastModelBuffer(modelUrl, shared);
        this.applyModelMemoryLimit(bytes.byteLength);
      } catch (error) {
        // 共享緩衝不可用時靜默回退到 worker 內的獨立 fetch。
        console.warn('[onnx-pool] shared model buffer unavailable, falling back:', error);
      }
    })();

    this.modelBufferRequests.set(modelUrl, request);
  }

  private applyModelMemoryLimit(modelBytes: number): void {
    if (this.disposed || modelBytes <= this.currentModelBytes) {
      return;
    }

    const before = this.effectiveConcurrency;
    this.currentModelBytes = modelBytes;
    if (this.effectiveConcurrency === before) {
      return;
    }

    this.trimSlots();
    this.applyThreadConfig();
    this.drainQueue();
  }

  private broadcastModelBuffer(modelUrl: string, buffer: SharedArrayBuffer): void {
    for (const slot of this.slots) {
      slot.worker.postMessage({ type: 'PROVIDE_MODEL', modelUrl, buffer });
    }
  }

  private createSlot(index: number): WorkerSlot {
    const worker = new Worker(new URL('./onnx-worker.ts', import.meta.url), { type: 'module' });
    const slot: WorkerSlot = { worker, busy: false, preloading: false, currentTaskId: null, index };

    for (const [modelUrl, buffer] of this.modelBuffers) {
      worker.postMessage({ type: 'PROVIDE_MODEL', modelUrl, buffer });
    }

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      this.handleMessage(slot, event.data);
    };
    worker.onerror = (event: ErrorEvent) => {
      this.handleWorkerError(slot, event.message || 'Worker crashed');
    };
    worker.onmessageerror = () => {
      this.handleWorkerError(slot, 'Worker message could not be deserialized');
    };

    return slot;
  }

  private handleMessage(slot: WorkerSlot, message: WorkerMessage): void {
    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === 'PROGRESS_TASK') {
      const task = this.activeTasks.get(message.taskId);
      if (task) {
        this.handleProgress(task, message.progress);
      }
      return;
    }

    if (message.type === 'TIMING_TASK') {
      if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
        console.debug('[onnx-pool] timings', message.taskId, message.timings);
      }
      return;
    }

    if (message.type === 'GPU_STATUS') {
      if (this.gpuActive !== message.active) {
        this.gpuActive = message.active;
        this.onGpuStatus?.({ active: message.active, reason: message.reason });
      }
      return;
    }

    if (message.type === 'PRELOAD_DONE') {
      slot.preloading = false;
      this.drainQueue();
      return;
    }

    if (message.type === 'SUCCESS_TASK') {
      this.finishTask(slot, message.taskId, { type: 'success', blob: message.resultBlob });
      return;
    }

    if (message.type === 'CANCELLED_TASK') {
      this.finishTask(slot, message.taskId, { type: 'cancelled' });
      return;
    }

    if (message.type === 'ERROR_TASK') {
      if (message.fatal || FATAL_PATTERN.test(message.error)) {
        this.retryOrFail(slot, message.taskId, message.error);
      } else {
        this.finishTask(slot, message.taskId, { type: 'error', error: message.error });
      }
    }
  }

  private handleProgress(task: PendingTask, progress: number): void {
    if (
      progress >= INFERENCE_PROGRESS_START &&
      progress < INFERENCE_PROGRESS_END &&
      task.progressTimer === null
    ) {
      this.startInferenceEstimate(task);
    }

    if (progress >= INFERENCE_PROGRESS_END) {
      this.stopInferenceEstimate(task);
    }

    task.onProgress?.(progress);
  }

  private startInferenceEstimate(task: PendingTask): void {
    const estimate = Math.max(200, estimateInferenceMs(task.resolution));
    const startedAt = Date.now();
    const span = INFERENCE_PROGRESS_END - INFERENCE_PROGRESS_START;
    const timeConstant = Math.max(150, estimate * 0.6);

    task.inferenceStartedAt = startedAt;
    task.progressTimer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const ratio = asymptoticEase(elapsed, timeConstant);
      task.onProgress?.(INFERENCE_PROGRESS_START + ratio * span);
    }, PROGRESS_TICK_MS);
  }

  private stopInferenceEstimate(task: PendingTask): void {
    if (task.progressTimer !== null) {
      clearInterval(task.progressTimer);
      task.progressTimer = null;
    }

    if (task.inferenceStartedAt !== null) {
      recordInferenceMs(Date.now() - task.inferenceStartedAt);
      task.inferenceStartedAt = null;
    }
  }

  private clearProgressTimer(task: PendingTask): void {
    if (task.progressTimer !== null) {
      clearInterval(task.progressTimer);
      task.progressTimer = null;
    }
    task.inferenceStartedAt = null;
  }

  private handleWorkerError(slot: WorkerSlot, message: string): void {
    const taskId = slot.currentTaskId;
    if (taskId) {
      this.retryOrFail(slot, taskId, message);
      return;
    }

    this.restartSlot(slot);
    this.drainQueue();
  }

  private finishTask(slot: WorkerSlot, taskId: string, result: PoolImageResult): void {
    const task = this.activeTasks.get(taskId);
    this.activeTasks.delete(taskId);

    if (task) {
      this.clearProgressTimer(task);
    }

    if (slot.currentTaskId === taskId) {
      slot.currentTaskId = null;
      slot.busy = false;
    }

    task?.resolve(result);
    this.trimSlots();
    this.drainQueue();
  }

  private retryOrFail(slot: WorkerSlot, taskId: string, error: string): void {
    const task = this.activeTasks.get(taskId);
    this.activeTasks.delete(taskId);

    if (task) {
      this.clearProgressTimer(task);
    }

    slot.currentTaskId = null;
    slot.busy = false;
    this.restartSlot(slot);

    if (task) {
      if (task.attempts < MAX_ATTEMPTS) {
        task.attempts += 1;
        this.pendingTasks.unshift(task);
      } else {
        task.resolve({ type: 'error', error });
      }
    }

    this.trimSlots();
    this.drainQueue();
  }

  private restartSlot(slot: WorkerSlot): void {
    slot.worker.terminate();
    this.slots[slot.index] = this.createSlot(slot.index);
    this.applyThreadConfig();
  }

  private applyThreadConfig(): void {
    const numThreads = getSessionThreads(this.plannedWorkers);
    for (const slot of this.slots) {
      slot.worker.postMessage({ type: 'CONFIGURE_WORKER', numThreads, useGpu: this.useGpu });
    }
  }

  private ensureSlots(target: number): void {
    if (this.disposed) {
      return;
    }

    const before = this.slots.length;
    while (this.slots.length < target) {
      this.slots.push(this.createSlot(this.slots.length));
    }

    if (this.slots.length !== before) {
      this.applyThreadConfig();
    }
  }

  private trimSlots(): void {
    if (this.disposed) {
      return;
    }

    for (let index = this.slots.length - 1; index >= this.plannedWorkers; index -= 1) {
      const slot = this.slots[index];
      if (!slot || slot.busy) {
        continue;
      }

      slot.worker.terminate();
      this.slots.splice(index, 1);
    }

    this.slots.forEach((slot, index) => {
      slot.index = index;
    });
  }

  private drainQueue(): void {
    if (this.disposed) {
      return;
    }

    while (this.pendingTasks.length > 0) {
      const slot = this.takeIdleSlot();
      if (!slot) {
        return;
      }

      const task = this.pendingTasks.shift();
      if (!task) {
        return;
      }

      slot.busy = true;
      slot.currentTaskId = task.id;
      this.activeTasks.set(task.id, task);

      slot.worker.postMessage({
        type: 'PROCESS_IMAGE_TASK',
        taskId: task.id,
        imageBlob: task.imageBlob,
        modelUrl: task.modelUrl,
        resolution: task.resolution,
        preprocess: task.preprocess,
        postprocess: task.postprocess,
      });
    }
  }

  private takeIdleSlot(): WorkerSlot | undefined {
    const idle = this.slots.find((candidate) => !candidate.busy && !candidate.preloading);
    if (idle) {
      return idle;
    }

    // 有 worker 正在预热时优先等它，别为了同一批任务再拉一个没预热的 worker。
    if (this.slots.some((candidate) => candidate.preloading)) {
      return undefined;
    }

    if (this.slots.length >= this.plannedWorkers) {
      return undefined;
    }

    const slot = this.createSlot(this.slots.length);
    this.slots.push(slot);
    this.applyThreadConfig();
    return slot;
  }
}

let poolInstance: OnnxWorkerPool | null = null;

export function getOnnxWorkerPool(): OnnxWorkerPool {
  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers are not supported in this environment');
  }

  if (!poolInstance) {
    poolInstance = new OnnxWorkerPool();
  }

  return poolInstance;
}

export function disposeOnnxWorkerPool(): void {
  poolInstance?.dispose();
  poolInstance = null;
}
