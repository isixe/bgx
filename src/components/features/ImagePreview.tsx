import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { useTranslation } from "../../lib/i18n";
import { useLanguage } from "../../lib/i18n/useLanguage";

export function ImagePreview() {
	const { originalImage, resultImage, isProcessing, startProcessing } = useAppStore();
	const { t } = useTranslation();
	useLanguage(); // Force re-render on language change
	const [sliderPosition, setSliderPosition] = useState(50);
	const [isDragging, setIsDragging] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	if (!originalImage) return null;

	const handleMove = (clientX: number) => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const x = clientX - rect.left;
		const percentage = (x / rect.width) * 100;
		setSliderPosition(Math.max(0, Math.min(100, percentage)));
	};

	const handleMouseDown = () => setIsDragging(true);
	const handleMouseUp = () => setIsDragging(false);

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!isDragging) return;
		handleMove(e.clientX);
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		handleMove(e.touches[0].clientX);
	};

	useEffect(() => {
		const handleGlobalMouseUp = () => setIsDragging(false);
		window.addEventListener("mouseup", handleGlobalMouseUp);
		return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
	}, []);

	return (
		<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<h3 className="mb-4 text-sm font-medium text-slate-700">{t("previewTitle")}</h3>

			<div
				ref={containerRef}
				className="relative select-none overflow-hidden rounded-lg bg-slate-50"
				onMouseDown={handleMouseDown}
				onMouseUp={handleMouseUp}
				onMouseMove={handleMouseMove}
				onTouchMove={handleTouchMove}
				onTouchStart={handleMouseDown}
				onTouchEnd={handleMouseUp}>
				{resultImage ? (
				<>
					{/* 底层：处理结果 */}
					<img
						src={resultImage}
						alt={t("previewResult")}
						className="block w-full"
						style={{ maxHeight: "600px", objectFit: "contain" }}
						draggable={false}
					/>

					{/* 上层：原图（通过clip控制显示区域） */}
					<div
						className="absolute inset-0 overflow-hidden"
						style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
						<img
							src={originalImage}
							alt={t("previewOriginal")}
							className="block h-full w-full object-contain"
							style={{ maxHeight: "600px" }}
							draggable={false}
						/>
					</div>

					{/* 滑块分割线 */}
					<div
						className="absolute inset-y-0 w-1 cursor-ew-resize bg-white shadow-md"
						style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}>
						{/* 滑块按钮 */}
						<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
							<div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md">
								<svg className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
								</svg>
							</div>
						</div>
					</div>

					{/* 标签 */}
					<div className="absolute bottom-3 left-3 rounded bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 shadow-sm">
						{t("previewOriginal")}
					</div>
					<div className="absolute bottom-3 right-3 rounded bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 shadow-sm">
						{t("previewResult")}
					</div>

					{/* 处理中遮罩 */}
					{isProcessing && (
						<div className="absolute inset-0 flex items-center justify-center bg-white/80">
							<div className="text-center">
								<div className="mx-auto mb-4 flex items-center justify-center gap-1">
									<div className="h-6 w-6 animate-bounce rounded-sm bg-indigo-600" style={{ animationDelay: '0ms' }} />
									<div className="h-6 w-6 animate-bounce rounded-sm bg-indigo-600" style={{ animationDelay: '150ms' }} />
									<div className="h-6 w-6 animate-bounce rounded-sm bg-indigo-600" style={{ animationDelay: '300ms' }} />
								</div>
								<p className="text-sm font-medium text-slate-700">{t("processingHint")}</p>
								<p className="mt-1 text-xs text-slate-500">{t("processingModelDownload")}</p>
							</div>
						</div>
					)}
				</>
			) : (
					<div className="relative">
						<img
							src={originalImage}
							alt={t("previewOriginal")}
							className="block w-full"
							style={{ maxHeight: "600px", objectFit: "contain" }}
							draggable={false}
						/>
						{isProcessing && (
							<div className="absolute inset-0 flex items-center justify-center bg-white/80">
								<div className="text-center">
									<div className="mx-auto mb-4 flex items-center justify-center gap-1">
										<div className="h-6 w-6 animate-bounce rounded-sm bg-indigo-600" style={{ animationDelay: '0ms' }} />
										<div className="h-6 w-6 animate-bounce rounded-sm bg-indigo-600" style={{ animationDelay: '150ms' }} />
										<div className="h-6 w-6 animate-bounce rounded-sm bg-indigo-600" style={{ animationDelay: '300ms' }} />
									</div>
									<p className="text-sm font-medium text-slate-700">{t("processingHint")}</p>
									<p className="mt-1 text-xs text-slate-500">{t("processingModelDownload")}</p>
								</div>
							</div>
						)}
					</div>
				)}
			</div>

			{resultImage ? (
				<p className="mt-3 text-center text-xs text-slate-400">{t("previewDragHint")}</p>
			) : !isProcessing ? (
				<button
					onClick={startProcessing}
					className="mt-4 w-full rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow">
					{t("startProcessing")}
				</button>
			) : null}
		</div>
	);
}
