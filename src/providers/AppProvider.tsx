import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useRemoveBackground, MODEL_NOT_CACHED } from '../hooks/useRemoveBackground';
import { MainLayout } from '../components/layout/MainLayout';
import { useTranslation, i18n } from '../lib/i18n';
import { isModelCached, getCachedModelBlobUrl } from '../utils/modelCache';
import {
  createRememberedImageUrl,
  getImageBlob,
  persistImageBlob,
  pruneImageStore,
  releaseImageUrl,
} from '../utils/imageStore';
import { getModelById } from '../utils/modelUtils';
import { checkForAppUpdate, isDesktopApp } from '../lib/appUpdate';
import { GPU_CONCURRENCY } from '../utils/concurrency';
import type { OnnxWorkerPool } from '../workers/onnx-worker-pool';
import type { BatchItem, GpuFallbackReason } from '../types/app';

// WebGPU 只在安全上下文暴露：LAN HTTP 下 navigator.gpu 不存在，重开开关也不会生效
function detectGpuUnavailableReason(): GpuFallbackReason | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return null;
  }
  if (!window.isSecureContext) {
    return 'insecure-context';
  }
  if (!('gpu' in navigator)) {
    return 'no-adapter';
  }
  return null;
}

export function AppProvider() {
  const { language, t } = useTranslation();
  const {
    currentModel,
    originalImage,
    isProcessing,
    isReadyToProcess,
    isDarkMode,
    processingTrigger,
    isModelStatusesLoaded,
    setCurrentModel,
    setResultImage,
    setIsProcessing,
    setProgress,
    setError,
    setIsReadyToProcess,
    setProcessedModel,
    initializeModelStatuses,
    updateModelStatus,
    checkUpdatesOnStartup,
    setUpdateCheckState,
    setLatestVersion,
    batchMode,
    batchQueue,
    batchConcurrency,
    updateBatchItemStatus,
    setBatchItemProgress,
    cachedModelUrl,
    gpuAcceleration,
    setGpuFallbackActive,
    applyGpuFallback,
    preloadEnabled,
    hydrateFromStorage,
  } = useAppStore();

  const activeConcurrency = gpuAcceleration ? GPU_CONCURRENCY : batchConcurrency;

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    initializeModelStatuses();
  }, [initializeModelStatuses]);

  useEffect(() => {
    void pruneImageStore();
  }, []);

  useEffect(() => {
    if (isModelStatusesLoaded) {
      setCurrentModel(useAppStore.getState().defaultModel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModelStatusesLoaded]);

  const handleProgress = useCallback(
    (progress: number) => {
      setProgress(progress);
    },
    [setProgress],
  );

  const handleError = useCallback(
    (error: Error) => {
      if (error.message === MODEL_NOT_CACHED) {
        setError(t('modelDeletedReDownload'));
        setIsProcessing(false);
        updateModelStatus(currentModel, 'not_downloaded');
        setCurrentModel(currentModel);
        return;
      }
      setError(error.message);
      setIsProcessing(false);
    },
    [setError, setIsProcessing, t, updateModelStatus, setCurrentModel, currentModel],
  );

  const handleSuccess = useCallback(
    (result: string) => {
      setResultImage(result);
      setIsProcessing(false);
      setProgress(100);
      setProcessedModel(currentModel);
    },
    [setResultImage, setIsProcessing, setProgress, setProcessedModel, currentModel],
  );

  const { processImage } = useRemoveBackground({
    onProgress: handleProgress,
    onError: handleError,
    onSuccess: handleSuccess,
  });

  const poolRef = useRef<OnnxWorkerPool | null>(null);
  const inFlightRef = useRef(new Set<string>());
  const modelUrlCacheRef = useRef(new Map<string, string>());
  const [isPoolReady, setIsPoolReady] = useState(false);

  const resolveModelUrl = useCallback(async (modelId: string): Promise<string | null> => {
    const cached = modelUrlCacheRef.current.get(modelId);
    if (cached) {
      return cached;
    }

    if (!(await isModelCached(modelId))) {
      return null;
    }

    const url = await getCachedModelBlobUrl(modelId);
    if (!url) {
      return null;
    }

    modelUrlCacheRef.current.set(modelId, url);
    return url;
  }, []);

  const runItem = useCallback(
    async (item: BatchItem) => {
      try {
        const modelUrl = await resolveModelUrl(item.modelId);
        if (!modelUrl) {
          updateBatchItemStatus(item.id, 'error', null, 'Model not available');
          return;
        }

        const pool = poolRef.current;
        if (!pool) {
          updateBatchItemStatus(item.id, 'error', null, 'Worker pool unavailable');
          return;
        }

        const model = getModelById(item.modelId);
        updateBatchItemStatus(item.id, 'processing');

        const imageBlob = await getImageBlob(item.originalImage);
        const result = await pool.processImage(
          item.id,
          imageBlob,
          modelUrl,
          model.resolution,
          model.preprocess ?? 'isnet',
          model.postprocess ?? 'linear',
          (progress) => setBatchItemProgress(item.id, progress),
        );

        if (result.type === 'success' && result.blob) {
          const resultImage = createRememberedImageUrl(result.blob);
          updateBatchItemStatus(item.id, 'completed', resultImage);
          void persistImageBlob(resultImage, result.blob).then((persisted) => {
            if (persisted) {
              releaseImageUrl(resultImage);
            }
          });
        } else if (result.type === 'error') {
          updateBatchItemStatus(item.id, 'error', null, result.error);
        } else {
          updateBatchItemStatus(item.id, 'pending');
        }
      } catch (error) {
        updateBatchItemStatus(
          item.id,
          'error',
          null,
          error instanceof Error ? error.message : 'Unknown error',
        );
      } finally {
        inFlightRef.current.delete(item.id);
      }
    },
    [resolveModelUrl, updateBatchItemStatus, setBatchItemProgress],
  );

  useEffect(() => {
    let cancelled = false;
    let disposePool: (() => void) | null = null;
    import('../workers/onnx-worker-pool').then((mod) => {
      if (cancelled) {
        return;
      }
      disposePool = mod.disposeOnnxWorkerPool;
      poolRef.current = mod.getOnnxWorkerPool();
      setIsPoolReady(true);
    });
    return () => {
      cancelled = true;
      // 只 cancelAll 会留下 worker 与其持有的 GPU device；卸载时必须真正销毁 pool。
      disposePool?.();
      poolRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isPoolReady) {
      poolRef.current?.setUseGpu(gpuAcceleration);
    }
  }, [gpuAcceleration, isPoolReady]);

  useEffect(() => {
    if (isPoolReady) {
      poolRef.current?.setConcurrency(activeConcurrency);
    }
  }, [activeConcurrency, isPoolReady]);

  useEffect(() => {
    if (isPoolReady) {
      poolRef.current?.setJobConcurrency(batchMode ? null : 1);
    }
  }, [batchMode, isPoolReady]);

  useEffect(() => {
    if (isPoolReady) {
      poolRef.current?.unload();
    }
  }, [cachedModelUrl, isPoolReady]);

  useEffect(() => {
    if (!isPoolReady) {
      return;
    }

    const pool = poolRef.current;
    if (!pool) {
      return;
    }

    pool.onGpuStatus = (status) => {
      if (status.active) {
        setGpuFallbackActive(false);
        return;
      }
      if (useAppStore.getState().gpuAcceleration) {
        applyGpuFallback('runtime');
      }
    };

    return () => {
      pool.onGpuStatus = null;
    };
  }, [isPoolReady, setGpuFallbackActive, applyGpuFallback]);

  useEffect(() => {
    if (!gpuAcceleration) {
      return;
    }
    const reason = detectGpuUnavailableReason();
    if (reason) {
      applyGpuFallback(reason);
    }
  }, [gpuAcceleration, applyGpuFallback]);

  const preloadedUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isPoolReady || !cachedModelUrl || !preloadEnabled) {
      return;
    }
    // 懒预热：仅当待处理队列超过并发数（确实会占用多个 worker）时才预热所有空闲 slot
    if (batchQueue.length <= activeConcurrency) {
      return;
    }
    if (preloadedUrlRef.current === cachedModelUrl) {
      return;
    }

    const model = getModelById(currentModel);
    if (!model) {
      return;
    }

    preloadedUrlRef.current = cachedModelUrl;
    poolRef.current?.preload(cachedModelUrl, model.resolution);
  }, [cachedModelUrl, currentModel, isPoolReady, preloadEnabled, batchQueue, activeConcurrency]);

  useEffect(() => {
    if (!batchMode || !isPoolReady) {
      return;
    }

    const pool = poolRef.current;
    if (!pool) {
      return;
    }

    const available = Math.min(pool.poolSize, activeConcurrency) - inFlightRef.current.size;
    if (available <= 0) {
      return;
    }

    const pending = batchQueue.filter(
      (item) => item.status === 'pending' && !inFlightRef.current.has(item.id),
    );

    for (const item of pending.slice(0, available)) {
      inFlightRef.current.add(item.id);
      void runItem(item);
    }
  }, [batchMode, batchQueue, activeConcurrency, isPoolReady, runItem]);

  useEffect(() => {
    if (originalImage && !isProcessing && isReadyToProcess) {
      setIsProcessing(true);
      setIsReadyToProcess(false);
      setError(null);
      setProgress(0);
      processImage(originalImage, currentModel);
    }
  }, [
    originalImage,
    currentModel,
    isProcessing,
    isReadyToProcess,
    processingTrigger,
    processImage,
    setIsProcessing,
    setIsReadyToProcess,
    setError,
    setProgress,
  ]);

  useEffect(() => {
    if (!isDesktopApp() || !checkUpdatesOnStartup) return;

    let cancelled = false;
    setUpdateCheckState('checking');

    checkForAppUpdate().then((result) => {
      if (cancelled) return;
      setUpdateCheckState(result.state);
      setLatestVersion(result.state === 'available' ? result.latestVersion : null);
    });

    return () => {
      cancelled = true;
    };
  }, [checkUpdatesOnStartup, setUpdateCheckState, setLatestVersion]);

  // Sync dark mode to html element for Tailwind dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Update page title based on language
  useEffect(() => {
    document.title = i18n.t('pageTitle');
  }, [language]);

  return <MainLayout />;
}
