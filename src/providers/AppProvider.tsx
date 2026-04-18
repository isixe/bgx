import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";
import { useRemoveBackground } from "../hooks/useRemoveBackground";
import { MainLayout } from "../components/layout/MainLayout";

export function AppProvider() {
	const {
		currentModel,
		originalImage,
		resultImage,
		isProcessing,
		isReadyToProcess,
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

	const handleCancelled = useCallback(() => {
		setIsProcessing(false);
		setProgress(0);
	}, [setIsProcessing, setProgress]);

	const { processImage, abort } = useRemoveBackground({
		onProgress: handleProgress,
		onError: handleError,
		onSuccess: handleSuccess,
		onCancelled: handleCancelled,
	});

	// Use a ref to keep the latest abort function
	const abortRef = useRef(abort);
	abortRef.current = abort;

	useEffect(() => {
		// Set a wrapper function that always calls the latest abort
		setAbortFn(() => () => abortRef.current());
		return () => {
			setAbortFn(null);
		};
	}, [setAbortFn]);

	useEffect(() => {
		if (originalImage && !isProcessing && isReadyToProcess) {
			setIsProcessing(true);
			setIsReadyToProcess(false);
			setError(null);
			setProgress(0);
			processImage(originalImage, currentModel);
		}
	}, [originalImage, currentModel, isProcessing, isReadyToProcess, processImage, setIsProcessing, setIsReadyToProcess, setError, setProgress]);

	useEffect(() => {
		return () => {
			abort();
		};
	}, [abort]);

	return <MainLayout />;
}
