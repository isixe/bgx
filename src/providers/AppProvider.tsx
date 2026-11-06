import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useRemoveBackground, MODEL_NOT_CACHED } from '../hooks/useRemoveBackground';
import { MainLayout } from '../components/layout/MainLayout';
import { useTranslation, i18n } from '../lib/i18n';
import { isModelCached, getCachedModelBlobUrl } from '../utils/modelCache';
import { getModelById } from '../utils/modelUtils';
import { checkForAppUpdate, isDesktopApp } from '../lib/appUpdate';
import type { OnnxWorkerPool } from '../workers/onnx-worker-pool';
import type { BatchItem } from '../types/app';

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
  } = useAppStore();

  useEffect(() => {
    initializeModelStatuses();
  }, [initializeModelStatuses]);

  useEffect(() => {
    if (isModelStatusesLoaded) {
      setCurrentModel(currentModel);
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

        const imageBlob = await fetch(item.originalImage).then((response) => response.blob());
        const result = await pool.processImage(
          item.id,
          imageBlob,
          modelUrl,
          model.resolution,
          (progress) => setBatchItemProgress(item.id, progress),
        );

        if (result.type === 'success' && result.blob) {
          updateBatchItemStatus(item.id, 'completed', URL.createObjectURL(result.blob));
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
    import('../workers/onnx-worker-pool').then((mod) => {
      if (cancelled) {
        return;
      }
      poolRef.current = mod.getOnnxWorkerPool();
      setIsPoolReady(true);
    });
    return () => {
      cancelled = true;
      poolRef.current?.cancelAll();
    };
  }, []);

  useEffect(() => {
    if (isPoolReady) {
      poolRef.current?.setConcurrency(batchConcurrency);
    }
  }, [batchConcurrency, isPoolReady]);

  useEffect(() => {
    if (isPoolReady) {
      poolRef.current?.setUseGpu(gpuAcceleration);
    }
  }, [gpuAcceleration, isPoolReady]);

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
        setGpuFallbackActive(true);
        setGpuAcceleration(false);
      }
    };

    return () => {
      pool.onGpuStatus = null;
    };
  }, [isPoolReady, setGpuAcceleration, setGpuFallbackActive]);

  const preloadedUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isPoolReady || !cachedModelUrl || !preloadEnabled) {
      return;
    }
    // 懒预热：仅当待处理队列超过并发数（确实会占用多个 worker）时才预热所有空闲 slot
    if (batchQueue.length <= batchConcurrency) {
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
  }, [cachedModelUrl, currentModel, isPoolReady, preloadEnabled, batchQueue, batchConcurrency]);

  useEffect(() => {
    if (!batchMode || !isPoolReady) {
      return;
    }

    const pool = poolRef.current;
    if (!pool) {
      return;
    }

    const available = Math.min(pool.poolSize, batchConcurrency) - inFlightRef.current.size;
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
  }, [batchMode, batchQueue, batchConcurrency, isPoolReady, runItem]);

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
