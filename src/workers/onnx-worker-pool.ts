import type { WorkerResult } from './onnx-worker-client';
import { removeBackground } from 'modern-rembg';

type PoolTaskResult = WorkerResult;

interface PendingTask {
  id: string;
  imageDataUrl: string;
  modelUrl: string;
  resolution: number;
  resolve: (result: PoolTaskResult) => void;
  onProgress?: (progress: number) => void;
}

interface WorkerSlot {
  worker: Worker;
  busy: boolean;
  currentTaskId: string | null;
}

const WASM_ERROR_PATTERN = /wasm|CompileError|WebAssembly|Expected magic word/i;

export class OnnxWorkerPool {
  private workers: WorkerSlot[] = [];
  private pendingTasks: PendingTask[] = [];
  private activeTasks = new Map<string, PendingTask>();
  private fallbackMode = false;
  private fallbackQueue: PendingTask[] = [];
  private fallbackProcessing = false;

  constructor(poolSize?: number) {
    const size = poolSize ?? this.getDefaultPoolSize();
    for (let i = 0; i < size; i++) {
      this.workers.push(this.createWorkerSlot());
    }
  }

  private getDefaultPoolSize(): number {
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      return Math.min(navigator.hardwareConcurrency - 1, 3);
    }
    return 2;
  }

  private createWorkerSlot(): WorkerSlot {
    const worker = new Worker(
      new URL('./onnx-worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event) => {
      const { type, ...data } = event.data;

      switch (type) {
        case 'PROGRESS_TASK': {
          const { taskId, progress } = data;
          const entry = this.activeTasks.get(taskId);
          entry?.onProgress?.(progress);
          break;
        }

        case 'SUCCESS_TASK': {
          const { taskId, result } = data;
          this.resolveTask(taskId, { type: 'success', result });
          break;
        }

        case 'ERROR_TASK': {
          const { taskId, error } = data;
          this.resolveTask(taskId, { type: 'error', error });
          break;
        }

        case 'CANCELLED_TASK': {
          const { taskId } = data;
          this.resolveTask(taskId, { type: 'cancelled' });
          break;
        }
      }
    };

    worker.onerror = (error) => {
      const slot = this.workers.find((s) => s.worker === worker);
      if (slot?.currentTaskId) {
        this.resolveTask(slot.currentTaskId, { type: 'error', error: error.message });
      }
      if (slot) {
        slot.busy = false;
        slot.currentTaskId = null;
      }
      this.drainQueue();
    };

    return { worker, busy: false, currentTaskId: null };
  }

  private resolveTask(taskId: string, result: PoolTaskResult): void {
    const entry = this.activeTasks.get(taskId);
    if (entry) {
      entry.resolve(result);
      this.activeTasks.delete(taskId);
    }

    const slot = this.workers.find((s) => s.currentTaskId === taskId);
    if (slot) {
      slot.busy = false;
      slot.currentTaskId = null;
    }

    if (!this.fallbackMode && result.type === 'error' && result.error && WASM_ERROR_PATTERN.test(result.error)) {
      console.warn('[OnnxWorkerPool] WASM error detected, switching to fallback mode (single worker)');
      this.enableFallback();
    }

    this.drainQueue();
  }

  private enableFallback(): void {
    this.fallbackMode = true;

    this.workers.forEach((slot) => {
      if (slot.currentTaskId) {
        const entry = this.activeTasks.get(slot.currentTaskId);
        if (entry) {
          entry.resolve({ type: 'cancelled' });
          this.activeTasks.delete(slot.currentTaskId);
        }
        slot.worker.terminate();
      }
    });
    this.workers = [];

    this.pendingTasks.forEach((task) => {
      this.fallbackQueue.push(task);
    });
    this.pendingTasks = [];

    this.drainFallbackQueue();
  }

  private drainFallbackQueue(): void {
    if (this.fallbackProcessing || this.fallbackQueue.length === 0) return;

    this.fallbackProcessing = true;
    const task = this.fallbackQueue.shift()!;

    this.processImageMainThread(task.imageDataUrl, task.modelUrl, task.resolution, task.onProgress)
      .then((result) => {
        task.resolve(result);
        this.fallbackProcessing = false;
        this.drainFallbackQueue();
      })
      .catch((error) => {
        task.resolve({ type: 'error', error: error instanceof Error ? error.message : String(error) });
        this.fallbackProcessing = false;
        this.drainFallbackQueue();
      });
  }

  private async processImageMainThread(
    imageDataUrl: string,
    modelUrl: string,
    resolution: number,
    onProgress?: (progress: number) => void,
  ): Promise<PoolTaskResult> {
    try {
      onProgress?.(5);

      const blob = await removeBackground(imageDataUrl, {
        model: modelUrl,
        resolution: resolution,
      });

      const reader = new FileReader();
      const result = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      onProgress?.(100);
      return { type: 'success', result };
    } catch (error) {
      return {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private drainQueue(): void {
    if (this.pendingTasks.length === 0) return;

    const availableWorker = this.workers.find((w) => !w.busy);
    if (!availableWorker) return;

    const task = this.pendingTasks.shift()!;
    availableWorker.busy = true;
    availableWorker.currentTaskId = task.id;

    this.activeTasks.set(task.id, task);

    availableWorker.worker.postMessage({
      type: 'PROCESS_IMAGE_TASK',
      taskId: task.id,
      imageDataUrl: task.imageDataUrl,
      modelUrl: task.modelUrl,
      resolution: task.resolution,
    });
  }

  async processImage(
    taskId: string,
    imageDataUrl: string,
    modelUrl: string,
    resolution: number,
    onProgress?: (progress: number) => void,
  ): Promise<PoolTaskResult> {
    if (this.fallbackMode) {
      return new Promise<PoolTaskResult>((resolve) => {
        this.fallbackQueue.push({
          id: taskId,
          imageDataUrl,
          modelUrl,
          resolution,
          resolve,
          onProgress,
        });
        this.drainFallbackQueue();
      });
    }

    return new Promise<PoolTaskResult>((resolve) => {
      this.pendingTasks.push({
        id: taskId,
        imageDataUrl,
        modelUrl,
        resolution,
        resolve,
        onProgress,
      });
      this.drainQueue();
    });
  }

  cancelTask(taskId: string): void {
    const pendingIndex = this.pendingTasks.findIndex((t) => t.id === taskId);
    if (pendingIndex !== -1) {
      const task = this.pendingTasks.splice(pendingIndex, 1)[0];
      task.resolve({ type: 'cancelled' });
      return;
    }

    const slot = this.workers.find((s) => s.currentTaskId === taskId);
    if (slot) {
      slot.worker.postMessage({ type: 'CANCEL_TASK', taskId });
    }
  }

  cancelAll(): void {
    while (this.pendingTasks.length > 0) {
      const task = this.pendingTasks.shift()!;
      task.resolve({ type: 'cancelled' });
    }

    while (this.fallbackQueue.length > 0) {
      const task = this.fallbackQueue.shift()!;
      task.resolve({ type: 'cancelled' });
    }

    this.workers.forEach((slot) => {
      if (slot.currentTaskId) {
        slot.worker.postMessage({ type: 'CANCEL_TASK', taskId: slot.currentTaskId });
      }
    });
  }

  get activeCount(): number {
    return this.workers.filter((w) => w.busy).length;
  }

  get pendingCount(): number {
    return this.pendingTasks.length;
  }

  get poolSize(): number {
    return this.workers.length;
  }

  dispose(): void {
    this.cancelAll();
    this.activeTasks.clear();
    this.workers.forEach((slot) => {
      slot.worker.terminate();
    });
    this.workers = [];
  }
}

let poolInstance: OnnxWorkerPool | null = null;

export function getOnnxWorkerPool(): OnnxWorkerPool {
  if (!poolInstance) {
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers are not supported in this environment');
    }
    poolInstance = new OnnxWorkerPool();
  }
  return poolInstance;
}

export function disposeOnnxWorkerPool(): void {
  if (poolInstance) {
    poolInstance.dispose();
    poolInstance = null;
  }
}
