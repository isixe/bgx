import { useCallback, useEffect } from "react";
import { useAppStore } from "../stores/appStore";
import { useRemoveBackground } from "../hooks/useRemoveBackground";
import { MainLayout } from "../components/layout/MainLayout";
import { useTranslation, i18n } from "../lib/i18n";

export function AppProvider() {
	const { language } = useTranslation();
	const {
		currentModel,
		originalImage,
		resultImage,
		isProcessing,
		isReadyToProcess,
		isDarkMode,
		processingTrigger,
		setResultImage,
		setIsProcessing,
		setProgress,
		setError,
		setAbortFn,
		setIsReadyToProcess,
		setProcessedModel,
	} = useAppStore();

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
