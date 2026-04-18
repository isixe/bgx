import { useCallback, useState, useRef, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { useTranslation } from "../../lib/i18n";

type ExportFormat = "png" | "jpg" | "webp";

type FormatOption = {
	value: ExportFormat;
	labelKey: "formatPng" | "formatJpg" | "formatWebp";
	descKey: "formatPngDesc" | "formatJpgDesc" | "formatWebpDesc";
};

const FORMAT_OPTIONS: FormatOption[] = [
	{ value: "png", labelKey: "formatPng", descKey: "formatPngDesc" },
	{ value: "jpg", labelKey: "formatJpg", descKey: "formatJpgDesc" },
	{ value: "webp", labelKey: "formatWebp", descKey: "formatWebpDesc" },
];

type ExportPanelProps = {
	disabled?: boolean;
};

export function ExportPanel({ disabled = false }: ExportPanelProps) {
	const { resultImage, originalImage, isDarkMode } = useAppStore();
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);
	const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("png");
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const selectedOption = FORMAT_OPTIONS.find((f) => f.value === selectedFormat)!;

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleDownload = useCallback(() => {
		if (!resultImage) return;

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const img = new Image();
		img.onload = () => {
			canvas.width = img.width;
			canvas.height = img.height;

			if (selectedFormat === "jpg") {
				ctx.fillStyle = "#FFFFFF";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
			}

			ctx.drawImage(img, 0, 0);

			const quality = selectedFormat === "webp" ? 0.9 : undefined;
			const dataUrl = canvas.toDataURL(`image/${selectedFormat}`, quality);
			const link = document.createElement("a");
			link.download = `bgx-removed-${Date.now()}.${selectedFormat}`;
			link.href = dataUrl;
			link.click();
		};
		img.src = resultImage;
	}, [resultImage, selectedFormat]);

	const handleCopy = useCallback(async () => {
		if (!resultImage) return;

		try {
			const response = await fetch(resultImage);
			const blob = await response.blob();
			await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Copy failed:", err);
			alert(t("copyFailed"));
		}
	}, [resultImage, t]);

	if (!originalImage) return null;

	return (
		<div
			className={`rounded-xl border p-4 shadow-sm ${disabled ? "opacity-60" : ""} ${isDarkMode ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
			<h3 className={`mb-3 text-sm font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
				{t("exportTitle")}
			</h3>

			<div className="relative">
				{disabled && <div className="absolute inset-0 z-10 cursor-not-allowed" />}

				<div className="relative mb-4" ref={dropdownRef}>
					<button
						onClick={() => !disabled && setIsOpen(!isOpen)}
						disabled={disabled}
						className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${isDarkMode ? "border-slate-600 bg-slate-700 hover:border-slate-500" : "border-slate-200 bg-white hover:border-slate-300"}`}>
						<div>
							<div className={`text-sm font-medium ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
								{t(selectedOption.labelKey)}
							</div>
							<div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
								{t(selectedOption.descKey)}
							</div>
						</div>
						<svg
							className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""} ${isDarkMode ? "text-slate-400" : "text-slate-400"}`}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
						</svg>
					</button>

					{isOpen && !disabled && (
						<div
							className={`absolute z-10 mt-1 w-full rounded-lg border shadow-lg ${isDarkMode ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
							<div className="py-1">
								{FORMAT_OPTIONS.map((format) => (
									<button
										key={format.value}
										onClick={() => {
											setSelectedFormat(format.value);
											setIsOpen(false);
										}}
										className={`w-full px-4 py-3 text-left transition-colors ${
											selectedFormat === format.value
												? isDarkMode
													? "bg-indigo-900/30"
													: "bg-indigo-50"
												: isDarkMode
													? "hover:bg-slate-700"
													: "hover:bg-slate-50"
										}`}>
										<div className="flex items-start justify-between">
											<div>
												<div
													className={`text-sm font-medium ${selectedFormat === format.value ? (isDarkMode ? "text-white" : "text-indigo-600") : isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
													{t(format.labelKey)}
												</div>
												<div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
													{t(format.descKey)}
												</div>
											</div>
											<div className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
												{selectedFormat === format.value && (
													<svg
														className={`h-4 w-4 ${isDarkMode ? "text-white" : "text-indigo-600"}`}
														fill="currentColor"
														viewBox="0 0 20 20">
														<path
															fillRule="evenodd"
															d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
															clipRule="evenodd"
														/>
													</svg>
												)}
											</div>
										</div>
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="space-y-2">
					<button
						onClick={handleDownload}
						disabled={disabled}
						className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
							/>
						</svg>
						{t("downloadImage")}
					</button>

					<button
						onClick={handleCopy}
						disabled={disabled}
						className={`
							flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all
							${
								copied
									? "bg-green-600 text-white"
									: isDarkMode
										? "border border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 hover:shadow-sm"
										: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:shadow-sm"
							}
							disabled:cursor-not-allowed disabled:opacity-50
						`}>
						{copied ? (
							<>
								<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
								</svg>
								{t("copied")}
							</>
						) : (
							<>
								<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
									/>
								</svg>
								{t("copyToClipboard")}
							</>
						)}
					</button>
				</div>

				<p className={`mt-3 text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{t("clipboardHint")}</p>
			</div>
		</div>
	);
}
