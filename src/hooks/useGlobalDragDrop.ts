import { useCallback, useRef, useState, useEffect } from "react";
import { useAppStore } from "../stores/appStore";
import { useTranslation } from "../lib/i18n";

const SUPPORTED_FORMATS = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/bmp",
	"image/tiff",
	"image/svg+xml",
	"image/avif",
	"image/heic",
	"image/heif",
];

interface UseGlobalDragDropOptions {
	disabled?: boolean;
	onFilesDropped?: (files: File[]) => void;
}

export function useGlobalDragDrop({ disabled = false, onFilesDropped }: UseGlobalDragDropOptions = {}) {
	const { setOriginalImage, setError, setBatchMode, addToBatchQueue, clearBatchQueue } = useAppStore();
	const { t } = useTranslation();
	const [isDragging, setIsDragging] = useState(false);
	const dragCounterRef = useRef(0);

	const isValidImageType = (file: File): boolean => {
		if (SUPPORTED_FORMATS.includes(file.type)) {
			return true;
		}
		const ext = file.name.split(".").pop()?.toLowerCase();
		const validExts = ["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "svg", "avif", "heic", "heif"];
		return ext ? validExts.includes(ext) : false;
	};

	const handleFiles = useCallback(
		(files: File[]) => {
			if (disabled) return;

			const validFiles: File[] = [];
			for (const file of files) {
				if (!isValidImageType(file)) {
					setError(t("errorUnsupportedFormat"));
					continue;
				}
				if (file.size > 30 * 1024 * 1024) {
					setError(t("errorFileTooLarge"));
					continue;
				}
				validFiles.push(file);
			}

			if (validFiles.length === 0) return;

			if (onFilesDropped) {
				onFilesDropped(validFiles);
				return;
			}

			if (validFiles.length === 1) {
				clearBatchQueue();
				setBatchMode(false);
				const reader = new FileReader();
				reader.onload = (e) => {
					const result = e.target?.result as string;
					if (result) {
						setOriginalImage(result);
						setError(null);
					}
				};
				reader.onerror = () => {
					setError(t("errorReadFailed"));
				};
				reader.readAsDataURL(validFiles[0]);
			} else {
				setBatchMode(true);
				validFiles.forEach((file) => addToBatchQueue(file));
			}
		},
		[setOriginalImage, setError, t, disabled, setBatchMode, addToBatchQueue, clearBatchQueue, onFilesDropped],
	);

	const handleDragEnter = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (disabled) return;
			dragCounterRef.current++;
			if (dragCounterRef.current === 1) {
				setIsDragging(true);
			}
		},
		[disabled],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current--;
		if (dragCounterRef.current === 0) {
			setIsDragging(false);
		}
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (disabled) return;
			dragCounterRef.current = 0;
			setIsDragging(false);

			const files = Array.from(e.dataTransfer.files);
			if (files.length > 0) {
				handleFiles(files);
			}
		},
		[handleFiles, disabled],
	);

	useEffect(() => {
		return () => {
			dragCounterRef.current = 0;
		};
	}, []);

	return {
		isDragging,
		dragProps: {
			onDragEnter: handleDragEnter,
			onDragOver: handleDragOver,
			onDragLeave: handleDragLeave,
			onDrop: handleDrop,
		},
	};
}
