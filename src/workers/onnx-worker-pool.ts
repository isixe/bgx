import {
  clampBatchConcurrency,
  DEFAULT_BATCH_CONCURRENCY,
  getSessionThreads,
} from '../utils/concurrency';

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
  onProgress?: (progress: number) => void;
  attempts: number;
  inferenceStartedAt: number | null;
  progressTimer: ReturnType<typeof setInterval> | null;
  resolve: (result: PoolImageResult) => void;
}

interface WorkerSlot {
  worker: Worker;
  busy: boolean;
  currentTaskId: string | null;
  index: number;
}

type WorkerMessage =
  | { type: 'PROGRESS_TASK'; taskId: string; progress: number }
  | { type: 'SUCCESS_TASK'; taskId: string; resultBlob: Blob }
  | { type: 'ERROR_TASK'; taskId: string; error: string; fatal: boolean }
  | { type: 'CANCELLED_TASK'; taskId: string };

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
  private disposed = false;
  private concurrencyLimit = DEFAULT_BATCH_CONCURRENCY;

  constructor() {
    this.resizeSlots();
  }

  get poolSize(): number {
    return this.slots.length;
  }

  get concurrency(): number {
    return this.concurrencyLimit;
  }

  setConcurrency(limit: number): void {
    const next = clampBatchConcurrency(limit);
    if (next === this.concurrencyLimit) {
      return;
    }

    this.concurrencyLimit = next;
    this.resizeSlots();
    this.applyThreadConfig();
    this.drainQueue();
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
        onProgress,
        attempts: 0,
        inferenceStartedAt: null,
        progressTimer: null,
        resolve,
      });
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
  }

  private createSlot(index: number): WorkerSlot {
    const worker = new Worker(new URL('./onnx-worker.ts', import.meta.url), { type: 'module' });
    const slot: WorkerSlot = { worker, busy: false, currentTaskId: null, index };

    worker.postMessage({
      type: 'CONFIGURE_WORKER',
      numThreads: getSessionThreads(this.concurrencyLimit),
    });

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
  }

  private applyThreadConfig(): void {
    const numThreads = getSessionThreads(this.concurrencyLimit);
    for (const slot of this.slots) {
      slot.worker.postMessage({ type: 'CONFIGURE_WORKER', numThreads });
    }
  }

  private resizeSlots(): void {
    if (this.disposed) {
      return;
    }

    while (this.slots.length < this.concurrencyLimit) {
      this.slots.push(this.createSlot(this.slots.length));
    }

    this.trimSlots();
  }

  private trimSlots(): void {
    for (let index = this.slots.length - 1; index >= this.concurrencyLimit; index -= 1) {
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
      const slot = this.slots.find((candidate) => !candidate.busy);
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
      });
    }
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
