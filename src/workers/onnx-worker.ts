/// <reference lib="webworker" />

import { removeBackground } from 'modern-rembg';

type WorkerMessage =
  | { type: 'PROCESS_IMAGE'; imageDataUrl: string; modelUrl: string; resolution: number }
  | { type: 'CANCEL' };

type WorkerResponse =
  | { type: 'PROGRESS'; progress: number }
  | { type: 'SUCCESS'; result: string }
  | { type: 'ERROR'; error: string }
  | { type: 'CANCELLED' };

let abortController: AbortController | null = null;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  switch (type) {
    case 'PROCESS_IMAGE': {
      const { imageDataUrl, modelUrl, resolution } = event.data;

      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();

      try {
        postMessage({ type: 'PROGRESS', progress: 5 } as WorkerResponse);

        const blob = await removeBackground(imageDataUrl, {
          model: modelUrl,
          resolution: resolution,
          onProgress: (progress: number) => {
            const scaledProgress = 5 + Math.floor(progress * 0.9);
            postMessage({ type: 'PROGRESS', progress: scaledProgress } as WorkerResponse);
          },
        });

        if (abortController?.signal.aborted) {
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
        if (abortController?.signal.aborted) {
          postMessage({ type: 'CANCELLED' } as WorkerResponse);
        } else {
          postMessage({
            type: 'ERROR',
            error: error instanceof Error ? error.message : String(error),
          } as WorkerResponse);
        }
      } finally {
        abortController = null;
      }
      break;
    }

    case 'CANCEL': {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      postMessage({ type: 'CANCELLED' } as WorkerResponse);
      break;
    }
  }
};

self.onbeforeunload = () => {
  if (abortController) {
    abortController.abort();
  }
};
