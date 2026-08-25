export type WorkerResult = {
  type: 'success' | 'error' | 'cancelled';
  result?: string;
  error?: string;
};

export class OnnxWorkerClient {
  private worker: Worker | null = null;
  private pendingResolve: ((result: WorkerResult) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private onProgressCallback: ((progress: number) => void) | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers are not supported in this environment');
    }

    this.worker = new Worker(new URL('./onnx-worker.ts', import.meta.url), { type: 'module' });

    this.worker.onmessage = (event) => {
      const { type, ...data } = event.data;

      switch (type) {
        case 'PROGRESS':
          this.onProgressCallback?.(data.progress);
          break;

        case 'SUCCESS':
          this.pendingResolve?.({ type: 'success', result: data.result });
          this.cleanup();
          break;

        case 'ERROR':
          this.pendingResolve?.({ type: 'error', error: data.error });
          this.cleanup();
          break;

        case 'CANCELLED':
          this.pendingResolve?.({ type: 'cancelled' });
          this.cleanup();
          break;
      }
    };

    this.worker.onerror = (error) => {
      this.pendingReject?.(new Error(error.message));
      this.cleanup();
    };
  }

  private cleanup(): void {
    this.pendingResolve = null;
    this.pendingReject = null;
    this.onProgressCallback = null;
  }

  async processImage(
    imageDataUrl: string,
    modelUrl: string,
    resolution: number,
    onProgress?: (progress: number) => void,
  ): Promise<WorkerResult> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    if (this.pendingResolve) {
      this.cancel();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return new Promise<WorkerResult>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.onProgressCallback = onProgress || null;

      this.worker!.postMessage({
        type: 'PROCESS_IMAGE',
        imageDataUrl,
        modelUrl,
        resolution,
      });
    });
  }

  cancel(): void {
    if (this.worker && this.pendingResolve) {
      this.worker.postMessage({ type: 'CANCEL' });
    }
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.cleanup();
  }
}

let clientInstance: OnnxWorkerClient | null = null;

export function getOnnxWorkerClient(): OnnxWorkerClient {
  if (!clientInstance) {
    clientInstance = new OnnxWorkerClient();
  }
  return clientInstance;
}

export function disposeOnnxWorkerClient(): void {
  if (clientInstance) {
    clientInstance.dispose();
    clientInstance = null;
  }
}

export { OnnxWorkerPool, getOnnxWorkerPool, disposeOnnxWorkerPool } from './onnx-worker-pool';
