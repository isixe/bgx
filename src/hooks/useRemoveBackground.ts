import { useCallback, useRef, useEffect } from 'react';
import { getModelById } from '../utils/modelUtils';
import { getCachedModelBlobUrl, revokeCachedUrl } from '../utils/modelCache';
import type { UseRemoveBackgroundOptions, UseRemoveBackgroundReturn } from '../types/app';

let workerClient: ReturnType<
  (typeof import('../workers/onnx-worker-client'))['getOnnxWorkerClient']
> | null = null;

export function useRemoveBackground(
  options: UseRemoveBackgroundOptions = {},
): UseRemoveBackgroundReturn {
  const isProcessingRef = useRef<boolean>(false);
  const cachedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (isProcessingRef.current) {
        workerClient?.cancel();
      }
    };
  }, []);

  const processImage = useCallback(
    async (imageDataUrl: string, modelId: string, preloadedModelUrl: string | null = null) => {
      if (isProcessingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      isProcessingRef.current = true;

      try {
        options.onProgress?.(0);

        const model = getModelById(modelId);

        let modelUrl = preloadedModelUrl;
        if (!modelUrl) {
          modelUrl = await getCachedModelBlobUrl(modelId);
        }

        if (!modelUrl) {
          modelUrl = `/models/${model.filename}`;
        }

        if (modelUrl !== `/models/${model.filename}`) {
          cachedUrlRef.current = modelUrl;
        }

        if (!workerClient) {
          const mod = await import('../workers/onnx-worker-client');
          workerClient = mod.getOnnxWorkerClient();
        }
        const result = await workerClient.processImage(
          imageDataUrl,
          modelUrl,
          model.resolution,
          (progress) => options.onProgress?.(progress),
        );

        if (result.type === 'success' && result.result) {
          options.onProgress?.(100);
          options.onSuccess?.(result.result);
        } else if (result.type === 'error') {
          options.onError?.(new Error(result.error || 'Unknown error'));
        }
      } catch (error) {
        options.onError?.(error instanceof Error ? error : new Error(String(error)));
      } finally {
        isProcessingRef.current = false;
        if (cachedUrlRef.current) {
          revokeCachedUrl(cachedUrlRef.current);
          cachedUrlRef.current = null;
        }
      }
    },
    [options],
  );

  return {
    processImage,
  };
}

export type { UseRemoveBackgroundOptions, UseRemoveBackgroundReturn } from '../types/app';
