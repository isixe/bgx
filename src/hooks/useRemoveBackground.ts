import { useCallback, useRef } from 'react';
import { removeBackground } from 'modern-rembg';
import { getModelById } from '../utils/modelUtils';
import type { UseRemoveBackgroundOptions, UseRemoveBackgroundReturn } from '../types/app';

export function useRemoveBackground(
  options: UseRemoveBackgroundOptions = {}
): UseRemoveBackgroundReturn {
  const isProcessingRef = useRef<boolean>(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentProgressRef = useRef<number>(0);

  const stopProgressAnimation = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const startProgressAnimation = useCallback(() => {
    stopProgressAnimation();
    currentProgressRef.current = 0;

    progressIntervalRef.current = setInterval(() => {
      const remaining = 90 - currentProgressRef.current;
      if (remaining > 0) {
        const increment = remaining * 0.05 + Math.random() * 2;
        currentProgressRef.current = Math.min(90, currentProgressRef.current + increment);
        options.onProgress?.(Math.floor(currentProgressRef.current));
      }
    }, 200);
  }, [options, stopProgressAnimation]);

  const processImage = useCallback(
    async (imageDataUrl: string, modelId: string) => {
      if (isProcessingRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      isProcessingRef.current = true;

      try {
        options.onProgress?.(0);
        startProgressAnimation();

        const model = getModelById(modelId);

        const blob = await removeBackground(imageDataUrl, {
          model: `/models/${model.filename}`,
          resolution: model.resolution,
          debug: true,
        });

        stopProgressAnimation();

        options.onProgress?.(95);

        const resultDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        options.onProgress?.(100);
        options.onSuccess?.(resultDataUrl);
      } catch (error) {
        stopProgressAnimation();
        options.onError?.(error instanceof Error ? error : new Error(String(error)));
      } finally {
        isProcessingRef.current = false;
      }
    },
    [options, startProgressAnimation, stopProgressAnimation]
  );

  return {
    processImage,
  };
}

export type { UseRemoveBackgroundOptions, UseRemoveBackgroundReturn } from '../types/app';
