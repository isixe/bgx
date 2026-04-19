import { useCallback, useRef, useState, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { useTranslation } from "../../lib/i18n";
import { getModelById, getLocalizedModel } from "../../utils/modelUtils";

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

const SUPPORTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.bmp,.tiff,.tif,.svg,.avif,.heic,.heif";

interface ImageUploaderProps {
	disabled?: boolean;
	disabledMessage?: string;
}

export function ImageUploader({ disabled = false, disabledMessage }: ImageUploaderProps) {
	const { setOriginalImage, setError, currentModel, setCurrentModel, isDarkMode } = useAppStore();
	const { t } = useTranslation();
	const [isDragging, setIsDragging] = useState(false);
	const [isModelOpen, setIsModelOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const modelDropdownRef = useRef<HTMLDivElement>(null);

	const currentModelInfo = getModelById(currentModel);
	const localizedCurrentModel = getLocalizedModel(currentModel, t);

	const handleModelSelect = (modelId: string) => {
		setCurrentModel(modelId);
		setIsModelOpen(false);
	};

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
				setIsModelOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const isValidImageType = (file: File): boolean => {
		if (SUPPORTED_FORMATS.includes(file.type)) {
			return true;
		}
		const ext = file.name.split(".").pop()?.toLowerCase();
		const validExts = ["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "svg", "avif", "heic", "heif"];
		return ext ? validExts.includes(ext) : false;
	};

	const handleFile = useCallback(
		(file: File) => {
			if (disabled) return;

			if (!isValidImageType(file)) {
				setError(t("errorUnsupportedFormat"));
				return;
			}

			if (file.size > 30 * 1024 * 1024) {
				setError(t("errorFileTooLarge"));
				return;
			}

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
			reader.readAsDataURL(file);
		},
		[setOriginalImage, setError, t, disabled],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			if (disabled) return;
			setIsDragging(false);

			const file = e.dataTransfer.files[0];
			if (file) {
				handleFile(file);
			}
		},
		[handleFile, disabled],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		if (disabled) return;
		setIsDragging(true);
	}, [disabled]);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const handleClick = useCallback(() => {
		if (disabled) return;
		fileInputRef.current?.click();
	}, [disabled]);

	const handleFileInput = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				handleFile(file);
			}
		},
		[handleFile],
	);

	useEffect(() => {
		const handlePaste = (e: ClipboardEvent) => {
			if (disabled) return;
			const items = e.clipboardData?.items;
			if (!items) return;

			for (let i = 0; i < items.length; i++) {
				if (items[i].type.startsWith("image/")) {
					const blob = items[i].getAsFile();
					if (blob) {
						handleFile(blob);
						break;
					}
				}
			}
		};

		document.addEventListener("paste", handlePaste);
		return () => {
			document.removeEventListener("paste", handlePaste);
		};
	}, [handleFile, disabled]);

	return (
		<div
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onClick={handleClick}
			className={`
        relative mx-4 sm:mx-6 lg:mx-auto max-w-3xl px-6 sm:px-10 lg:px-40 py-14 rounded-xl border-2 border-dashed text-center transition-all duration-200
        ${
					disabled
						? isDarkMode
							? "border-slate-700 bg-slate-800/50 cursor-not-allowed"
							: "border-slate-300 bg-slate-100/50 cursor-not-allowed"
						: isDragging
							? isDarkMode
								? "border-indigo-400 bg-indigo-900/30 cursor-pointer"
								: "border-indigo-500 bg-indigo-50 cursor-pointer"
							: isDarkMode
								? "border-slate-600 bg-slate-800 hover:border-slate-500 hover:bg-slate-700 cursor-pointer"
								: "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white cursor-pointer"
				}
      `}>
			<input
				ref={fileInputRef}
				type="file"
				accept={SUPPORTED_EXTENSIONS}
				onChange={handleFileInput}
				className="hidden"
				disabled={disabled}
			/>

			<div
				className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${
					disabled
						? isDarkMode
							? "bg-slate-700"
							: "bg-slate-200"
						: isDarkMode
							? "bg-indigo-900/50"
							: "bg-indigo-100"
				}`}>
				<svg
					className={`h-8 w-8 ${
						disabled ? (isDarkMode ? "text-slate-500" : "text-slate-400") : isDarkMode ? "text-indigo-400" : "text-indigo-600"
					}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={1.5}
						d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			</div>

			<h3 className={`mb-2 text-base font-medium ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
				{disabled && disabledMessage ? disabledMessage : t("uploaderTitle")}
			</h3>
			{!disabled && (
				<>
					<p className={`mb-3 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{t("uploaderSubtitle")}</p>
					<p className={`mb-4 text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{t("uploaderPaste")}</p>
				</>
			)}

			{isDragging && !disabled && (
				<div
					className={`absolute inset-0 flex items-center justify-center rounded-xl ${isDarkMode ? "bg-indigo-900/50" : "bg-indigo-50/80"}`}>
					<span className={`text-sm font-medium ${isDarkMode ? "text-indigo-400" : "text-indigo-600"}`}>
						{t("uploaderDrop")}
					</span>
				</div>
			)}
		</div>
	);
}
