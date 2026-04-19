import { useCallback, useEffect } from "react";
import { useAppStore } from "../stores/appStore";
import { useRemoveBackground } from "../hooks/useRemoveBackground";
import { MainLayout } from "../components/layout/MainLayout";
import { useTranslation, i18n } from "../lib/i18n";
import { isModelCached, getCachedModelBlobUrl } from "../utils/modelCache";

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
		modelStatuses,
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
	} = useAppStore();

	// 应用启动时初始化所有模型状态
	useEffect(() => {
		initializeModelStatuses();
	}, [initializeModelStatuses]);

	// 初始化时预加载默认模型
	useEffect(() => {
		if (isModelStatusesLoaded) {
			// 组件挂载时，预加载当前选中的模型
			setCurrentModel(currentModel);
		}
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
					setError(t("modelDeletedReDownload"));
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
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}, [isDarkMode]);

	// Update page title based on language
	useEffect(() => {
		document.title = i18n.t('pageTitle');
	}, [language]);

	return <MainLayout />;
}
