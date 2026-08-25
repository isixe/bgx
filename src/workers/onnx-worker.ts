/// <reference lib="webworker" />

import { env } from 'onnxruntime-web';
import { removeBackground } from 'modern-rembg';

type WorkerMessage =
  | { type: 'PROCESS_IMAGE'; imageDataUrl: string; modelUrl: string; resolution: number }
  | {
      type: 'PROCESS_IMAGE_TASK';
      taskId: string;
      imageDataUrl: string;
      modelUrl: string;
      resolution: number;
    }
  | { type: 'CANCEL' }
  | { type: 'CANCEL_TASK'; taskId: string };

type WorkerResponse =
  | { type: 'PROGRESS'; progress: number }
  | { type: 'PROGRESS_TASK'; taskId: string; progress: number }
  | { type: 'SUCCESS'; result: string }
  | { type: 'SUCCESS_TASK'; taskId: string; result: string }
  | { type: 'ERROR'; error: string }
  | { type: 'ERROR_TASK'; taskId: string; error: string }
  | { type: 'CANCELLED' }
  | { type: 'CANCELLED_TASK'; taskId: string };

const taskAbortControllers = new Map<string, AbortController>();
let globalAbortController: AbortController | null = null;
let wasmBinaryReady = false;

async function ensureWasmBinary() {
  if (wasmBinaryReady) return;
  try {
    const resp = await fetch('/ort-wasm-simd-threaded.wasm');
    if (resp.ok) {
      env.wasm.wasmBinary = await resp.arrayBuffer();
      wasmBinaryReady = true;
    }
  } catch {
    // WASM binary fetch failed - will use default WASM loading
  }
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  await ensureWasmBinary();
  const { type } = event.data;

  switch (type) {
    case 'PROCESS_IMAGE': {
      const { imageDataUrl, modelUrl, resolution } = event.data;

      if (globalAbortController) {
        globalAbortController.abort();
      }
      globalAbortController = new AbortController();

      try {
        postMessage({ type: 'PROGRESS', progress: 5 } as WorkerResponse);

        const blob = await removeBackground(imageDataUrl, {
          model: modelUrl,
          resolution: resolution,
        });

        if (globalAbortController?.signal.aborted) {
          postMessage({ type: 'CANCELLED' } as WorkerResponse);
          return;
        }

        const reader = new FileReader();
        const result = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        postMessage({ type: 'PROGRESS', progress: 100 } as WorkerResponse);
        postMessage({ type: 'SUCCESS', result } as WorkerResponse);
      } catch (error) {
        if (globalAbortController?.signal.aborted) {
          postMessage({ type: 'CANCELLED' } as WorkerResponse);
        } else {
          postMessage({
            type: 'ERROR',
            error: error instanceof Error ? error.message : String(error),
          } as WorkerResponse);
        }
      } finally {
        globalAbortController = null;
      }
      break;
    }

    case 'PROCESS_IMAGE_TASK': {
      const { taskId, imageDataUrl, modelUrl, resolution } = event.data;

      const existingController = taskAbortControllers.get(taskId);
      if (existingController) {
        existingController.abort();
      }

      const abortController = new AbortController();
      taskAbortControllers.set(taskId, abortController);

      try {
        postMessage({ type: 'PROGRESS_TASK', taskId, progress: 5 } as WorkerResponse);

        const blob = await removeBackground(imageDataUrl, {
          model: modelUrl,
          resolution: resolution,
        });

        if (abortController.signal.aborted) {
          postMessage({ type: 'CANCELLED_TASK', taskId } as WorkerResponse);
          return;
        }

        const reader = new FileReader();
        const result = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        postMessage({ type: 'PROGRESS_TASK', taskId, progress: 100 } as WorkerResponse);
        postMessage({ type: 'SUCCESS_TASK', taskId, result } as WorkerResponse);
      } catch (error) {
        if (abortController.signal.aborted) {
          postMessage({ type: 'CANCELLED_TASK', taskId } as WorkerResponse);
        } else {
          postMessage({
            type: 'ERROR_TASK',
            taskId,
            error: error instanceof Error ? error.message : String(error),
          } as WorkerResponse);
        }
      } finally {
        taskAbortControllers.delete(taskId);
      }
      break;
    }

    case 'CANCEL': {
      if (globalAbortController) {
        globalAbortController.abort();
        globalAbortController = null;
      }
      postMessage({ type: 'CANCELLED' } as WorkerResponse);
      break;
    }

    case 'CANCEL_TASK': {
      const { taskId } = event.data;
      const controller = taskAbortControllers.get(taskId);
      if (controller) {
        controller.abort();
        taskAbortControllers.delete(taskId);
      }
      postMessage({ type: 'CANCELLED_TASK', taskId } as WorkerResponse);
      break;
    }
  }
};

self.onbeforeunload = () => {
  if (globalAbortController) {
    globalAbortController.abort();
  }
  taskAbortControllers.forEach((controller) => controller.abort());
  taskAbortControllers.clear();
};
