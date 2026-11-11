import { useCallback, useEffect, useRef } from 'react';
import { MODELS } from '../config/models';
import { getCachedModelBlobUrl, isModelCached } from '../utils/modelCache';
import { createRememberedImageUrl, getImageBlob } from '../utils/imageStore';
import type { UseRemoveBackgroundOptions, UseRemoveBackgroundReturn } from '../types/app';

export const MODEL_NOT_CACHED = 'model_not_cached';

let singleTaskCounter = 0;

export function useRemoveBackground(
  options: UseRemoveBackgroundOptions,
): UseRemoveBackgroundReturn {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  const processImage = useCallback(async (imageUrl: string, modelId: string) => {
    const { onProgress, onError, onSuccess } = optionsRef.current;

    try {
      const model = MODELS.find((candidate) => candidate.id === modelId);
      if (!model) {
        throw new Error(`Unknown model: ${modelId}`);
      }

      onProgress?.(0);

      if (!(await isModelCached(modelId))) {
        throw new Error(MODEL_NOT_CACHED);
      }

      const modelUrl = await getCachedModelBlobUrl(modelId);
      if (!modelUrl) {
        throw new Error('Model URL unavailable');
      }

      const imageBlob = await getImageBlob(imageUrl);
      const { getOnnxWorkerPool } = await import('../workers/onnx-worker-pool');
      const pool = getOnnxWorkerPool();

      singleTaskCounter += 1;
      const result = await pool.processImage(
        `single-${singleTaskCounter}`,
        imageBlob,
        modelUrl,
        model.resolution,
        model.preprocess ?? 'isnet',
        model.postprocess ?? 'linear',
        (progress) => onProgress?.(progress),
      );

      if (result.type === 'success' && result.blob) {
        onProgress?.(100);
        onSuccess?.(createRememberedImageUrl(result.blob));
        return;
      }

      if (result.type === 'error') {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, []);

  return { processImage };
}
