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

export class OnnxWorkerPool {
  private readonly slots: WorkerSlot[] = [];
  private readonly pendingTasks: PendingTask[] = [];
  private readonly activeTasks = new Map<string, PendingTask>();
  private disposed = false;

  constructor() {
    const cores =
      typeof navigator !== 'undefined' && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 2;
    const size = Math.min(Math.max(1, cores - 1), 2);
    for (let index = 0; index < size; index += 1) {
      this.slots.push(this.createSlot(index));
    }
  }

  get poolSize(): number {
    return this.slots.length;
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
      this.activeTasks.get(message.taskId)?.onProgress?.(message.progress);
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

    if (slot.currentTaskId === taskId) {
      slot.currentTaskId = null;
      slot.busy = false;
    }

    task?.resolve(result);
    this.drainQueue();
  }

  private retryOrFail(slot: WorkerSlot, taskId: string, error: string): void {
    const task = this.activeTasks.get(taskId);
    this.activeTasks.delete(taskId);

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

    this.drainQueue();
  }

  private restartSlot(slot: WorkerSlot): void {
    slot.worker.terminate();
    this.slots[slot.index] = this.createSlot(slot.index);
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
