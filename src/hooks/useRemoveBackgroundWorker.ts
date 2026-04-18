import { useCallback, useRef } from 'react';
import { getModelById } from '../utils/modelUtils';
import type { UseRemoveBackgroundOptions, UseRemoveBackgroundReturn } from '../types/app';

export function useRemoveBackgroundWorker(
  options: UseRemoveBackgroundOptions = {}
): UseRemoveBackgroundReturn {
  const workerRef = useRef<Worker | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentProgressRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const optionsRef = useRef(options);

  // Keep optionsRef up to date
  optionsRef.current = options;

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
        optionsRef.current.onProgress?.(Math.floor(currentProgressRef.current));
      }
    }, 200);
  }, [stopProgressAnimation]);

  const abort = useCallback(() => {
    if (workerRef.current) {
      // Terminate the worker to truly cancel the processing
      workerRef.current.terminate();
      workerRef.current = null;
    }
    stopProgressAnimation();
    isProcessingRef.current = false;
    optionsRef.current.onCancelled?.();
  }, [stopProgressAnimation]);

  const processImage = useCallback(
    async (imageDataUrl: string, modelId: string) => {
      // Terminate any existing worker
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }

      isProcessingRef.current = true;
      optionsRef.current.onProgress?.(0);
      startProgressAnimation();

      const model = getModelById(modelId);

      return new Promise<void>((resolve) => {
        // Create new worker
        const worker = new Worker('/bg-removal-worker.js', { type: 'module' });
        workerRef.current = worker;

        worker.onmessage = (e) => {
          const { type, result, error } = e.data;

          if (type === 'success') {
            stopProgressAnimation();
            optionsRef.current.onProgress?.(100);
            optionsRef.current.onSuccess?.(result);
            isProcessingRef.current = false;
            worker.terminate();
            workerRef.current = null;
            resolve();
          } else if (type === 'error') {
            stopProgressAnimation();
            optionsRef.current.onError?.(new Error(error));
            isProcessingRef.current = false;
            worker.terminate();
            workerRef.current = null;
            resolve();
          } else if (type === 'cancelled') {
            stopProgressAnimation();
            isProcessingRef.current = false;
            worker.terminate();
            workerRef.current = null;
            resolve();
          }
        };

        worker.onerror = (err) => {
          stopProgressAnimation();
          optionsRef.current.onError?.(new Error(err.message || 'Worker error'));
          isProcessingRef.current = false;
          worker.terminate();
          workerRef.current = null;
          resolve();
        };

        worker.postMessage({
          type: 'process',
          imageDataUrl,
          modelPath: `/models/${model.filename}`,
          resolution: model.resolution,
        });
      });
    },
    [startProgressAnimation, stopProgressAnimation]
  );

  return {
    processImage,
    abort,
  };
}
