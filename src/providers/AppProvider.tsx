import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { useRemoveBackground } from '../hooks/useRemoveBackground';
import { MainLayout } from '../components/layout/MainLayout';
import { useTranslation, i18n } from '../lib/i18n';
import { isModelCached, getCachedModelBlobUrl } from '../utils/modelCache';
import { getModelById } from '../utils/modelUtils';

export function AppProvider() {
  const { language, t } = useTranslation();
  const {
    currentModel,
    originalImage,
    isProcessing,
    isReadyToProcess,
    isDarkMode,
    processingTrigger,
    cachedModelUrl,
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
    batchMode,
    batchQueue,
    updateBatchItemStatus,
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
      setError(error.message);
      setIsProcessing(false);
    },
    [setError, setIsProcessing],
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

  const poolRef = useRef<ReturnType<
    (typeof import('../workers/onnx-worker-pool'))['getOnnxWorkerPool']
  > | null>(null);
  const submittedIdsRef = useRef(new Set<string>());

  useEffect(() => {
    import('../workers/onnx-worker-pool').then((mod) => {
      poolRef.current = mod.getOnnxWorkerPool();
    });
    return () => {
      poolRef.current?.cancelAll();
    };
  }, []);

  useEffect(() => {
    if (!batchMode) return;

    const pendingItems = batchQueue.filter(
      (item) => item.status === 'pending' && !submittedIdsRef.current.has(item.id),
    );
    if (pendingItems.length === 0) return;

    for (const item of pendingItems) {
      submittedIdsRef.current.add(item.id);

      const processItem = async () => {
        const isStillCached = await isModelCached(item.modelId);
        if (!isStillCached) {
          submittedIdsRef.current.delete(item.id);
          updateBatchItemStatus(item.id, 'error', null, 'Model not available');
          return;
        }

        const freshCachedUrl = await getCachedModelBlobUrl(item.modelId);
        if (!freshCachedUrl) {
          submittedIdsRef.current.delete(item.id);
          updateBatchItemStatus(item.id, 'error', null, 'Model URL unavailable');
          return;
        }

        updateBatchItemStatus(item.id, 'processing');

        const model = getModelById(item.modelId);

        poolRef
          .current!.processImage(
            item.id,
            item.originalImage,
            freshCachedUrl,
            model.resolution,
            () => {},
          )
          .then((result) => {
            submittedIdsRef.current.delete(item.id);
            if (result.type === 'success' && result.result) {
              updateBatchItemStatus(item.id, 'completed', result.result);
            } else if (result.type === 'error') {
              updateBatchItemStatus(item.id, 'error', null, result.error);
            } else {
              updateBatchItemStatus(item.id, 'pending');
            }
          })
          .catch(() => {
            submittedIdsRef.current.delete(item.id);
            updateBatchItemStatus(item.id, 'error', null, 'Unknown error');
          });
      };

      processItem();
    }
  }, [batchMode, batchQueue, updateBatchItemStatus]);

  useEffect(() => {
    const checkAndProcess = async () => {
      if (originalImage && !isProcessing && isReadyToProcess) {
        setIsProcessing(true);
        setIsReadyToProcess(false);
        setError(null);
        setProgress(0);

        // 预检模型是否仍然缓存可用
        const isStillCached = await isModelCached(currentModel);

        if (!isStillCached) {
          // 模型已被删除，需要重新下载
          setError(t('modelDeletedReDownload'));
          setIsProcessing(false);
          // 更新全局状态
          updateModelStatus(currentModel, 'not_downloaded');
          // 重新触发模型加载（会自动下载）
          setCurrentModel(currentModel);
          return;
        }

        // 模型可用，获取最新的 blob URL
        const freshCachedUrl = await getCachedModelBlobUrl(currentModel);

        // 传入最新的模型 URL
        processImage(originalImage, currentModel, freshCachedUrl);
      }
    };

    checkAndProcess();
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
    cachedModelUrl,
    t,
    setCurrentModel,
    updateModelStatus,
  ]);

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
