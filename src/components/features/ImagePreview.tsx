import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "../../stores/appStore";
import { useTranslation } from "../../lib/i18n";

export function downloadResultImage(originalImage: string, resultImage: string, filename: string, format: 'png' | 'jpg' | 'webp') {
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const originalImg = new Image();
	originalImg.onload = () => {
		canvas.width = originalImg.width;
		canvas.height = originalImg.height;

		if (format === 'jpg') {
			ctx.fillStyle = "#FFFFFF";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
		}

		const resultImg = new Image();
		resultImg.onload = () => {
			ctx.drawImage(resultImg, 0, 0, canvas.width, canvas.height);

			const quality = format === 'webp' ? 0.9 : undefined;
			const dataUrl = canvas.toDataURL(`image/${format}`, quality);
			const link = document.createElement("a");
			const baseName = filename.replace(/\.[^.]+$/, '');
			link.download = `${baseName}-removed.${format}`;
			link.href = dataUrl;
			link.click();
		};
		resultImg.src = resultImage;
	};
	originalImg.src = originalImage;
}

export function ImagePreview() {
	const { originalImage, resultImage, isProcessing, isDarkMode,
		batchMode, batchQueue, viewingBatchResult, activeBatchItemId,
		selectedBatchItemIds, currentModel,
		selectBatchItem, selectBatchQueueItem, selectAllBatchItems, backToBatchQueue,
		reprocessBatchItem,
	} = useAppStore();
	const { t } = useTranslation();
	const [sliderPosition, setSliderPosition] = useState(50);
	const [isDraggingSlider, setIsDraggingSlider] = useState(false);
	const [scale, setScale] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = useState(false);
	const [panStart, setPanStart] = useState({ x: 0, y: 0 });
	const containerRef = useRef<HTMLDivElement>(null);
	const sliderRef = useRef<HTMLDivElement>(null);

	const activeBatchItem = batchMode
		? batchQueue.find(item => item.id === activeBatchItemId) ?? null
		: null;

	const showQueueList = batchMode && !viewingBatchResult;
	const displayOriginal = activeBatchItem ? activeBatchItem.originalImage : originalImage;
	const displayResult = (activeBatchItem ? activeBatchItem.resultImage : resultImage) ?? undefined;
	const isBatchProcessing = activeBatchItem ? activeBatchItem.status === 'processing' : isProcessing;

	const handleSliderMove = useCallback((clientX: number) => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const x = clientX - rect.left;
		const percentage = (x / rect.width) * 100;
		setSliderPosition(Math.max(0, Math.min(100, percentage)));
	}, []);

	const handleContainerMouseDown = (e: React.MouseEvent) => {
		if (isBatchProcessing) return;
		if (e.button !== 0) return;
		setIsPanning(true);
		setPanStart({ x: e.clientX, y: e.clientY });
	};

	const handleSliderMouseDown = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsDraggingSlider(true);
		handleSliderMove(e.clientX);
	};

	const handleSliderAreaMouseDown = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isBatchProcessing) return;
		if (sliderRef.current && sliderRef.current.contains(e.target as Node)) return;
		setIsDraggingSlider(true);
		handleSliderMove(e.clientX);
	};

	const handleMouseUp = () => {
		setIsDraggingSlider(false);
		setIsPanning(false);
	};

	const handleMouseMove = useCallback((e: React.MouseEvent) => {
		if (isDraggingSlider) {
			handleSliderMove(e.clientX);
		}
		if (isPanning) {
			const dx = e.clientX - panStart.x;
			const dy = e.clientY - panStart.y;
			setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
			setPanStart({ x: e.clientX, y: e.clientY });
		}
	}, [isDraggingSlider, isPanning, panStart, handleSliderMove]);

	const handleTouchMove = useCallback((e: React.TouchEvent) => {
		e.preventDefault();
		if (isDraggingSlider) {
			handleSliderMove(e.touches[0].clientX);
		}
		if (isPanning) {
			const touch = e.touches[0];
			const dx = touch.clientX - panStart.x;
			const dy = touch.clientY - panStart.y;
			setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
			setPanStart({ x: touch.clientX, y: touch.clientY });
		}
	}, [isDraggingSlider, isPanning, panStart, handleSliderMove]);

	const handleTouchStart = useCallback((e: React.TouchEvent) => {
		if (isBatchProcessing) return;
		const touch = e.touches[0];
		const target = e.target as HTMLElement;
		if (target.closest('.slider-area')) return;
		setIsPanning(true);
		setPanStart({ x: touch.clientX, y: touch.clientY });
	}, [isBatchProcessing]);

	const handleSliderTouchStart = useCallback((e: React.TouchEvent) => {
		e.stopPropagation();
		if (isBatchProcessing) return;
		setIsDraggingSlider(true);
		handleSliderMove(e.touches[0].clientX);
	}, [isBatchProcessing, handleSliderMove]);

	const handleSliderAreaTouchStart = useCallback((e: React.TouchEvent) => {
		e.stopPropagation();
		if (isBatchProcessing) return;
		setIsDraggingSlider(true);
		handleSliderMove(e.touches[0].clientX);
	}, [isBatchProcessing, handleSliderMove]);

	const handleWheel = (e: React.WheelEvent) => {
		if (isBatchProcessing) return;
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		setScale(prev => Math.max(0.1, Math.min(5, prev * delta)));
	};

	if (!showQueueList && !displayOriginal) return null;

	if (showQueueList) {
		const selectableCount = batchQueue.filter(item => item.status !== 'processing').length;
		const allSelected = selectableCount > 0 && selectableCount === selectedBatchItemIds.length;
		const someSelected = selectedBatchItemIds.length > 0 && !allSelected;

		return (
			<div className="w-full h-full flex items-center justify-center">
				<div className={`relative w-full h-full rounded-none sm:rounded-lg overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-gray-200'}`}>
			{batchQueue.length === 0 ? (
						<div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
							{t('batchEmpty')}
						</div>
					) : (
						<div className="flex flex-col w-full h-full">
							<div className={`flex items-center gap-2 px-3 h-9 border-b ${isDarkMode ? 'border-slate-600' : 'border-gray-300'}`}>
								<button
									onClick={() => selectAllBatchItems(!allSelected)}
									className={`w-[18px] h-[18px] rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
										allSelected
											? 'border-indigo-500 bg-indigo-500'
											: someSelected
											? 'border-indigo-400 bg-indigo-400/30'
											: isDarkMode
												? 'border-gray-400 hover:border-gray-200'
												: 'border-gray-400 hover:border-gray-600'
									}`}
								>
									{allSelected && (
										<svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
											<path d="M5 13l4 4L19 7" />
										</svg>
									)}
									{someSelected && (
										<div className="w-2 h-0.5 rounded-full bg-indigo-500" />
									)}
								</button>
								<span className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
									{t('selectAll')}
								</span>

								{selectedBatchItemIds.length > 0 && (
									<button
										onClick={() => {
											selectedBatchItemIds.forEach((id) => reprocessBatchItem(id, currentModel));
											selectAllBatchItems(false);
										}}
										className="ml-auto text-xs px-2.5 py-1 rounded bg-indigo-500 text-white hover:bg-indigo-600 transition-colors font-medium"
									>
										{t('reprocess')} ({selectedBatchItemIds.length})
									</button>
								)}
							</div>

							<div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
								{batchQueue.map((item) => {
									const isSelected = selectedBatchItemIds.includes(item.id);
								const statusLabel = item.status === 'processing' ? t('processingHint')
									: item.status === 'completed' ? t('batchStatusCompleted')
									: item.status === 'error' ? t('batchStatusFailed')
									: t('batchStatusPending');
									const statusColors = item.status === 'processing'
										? (isDarkMode ? 'text-blue-400' : 'text-blue-600')
										: item.status === 'completed'
										? (isDarkMode ? 'text-green-400' : 'text-green-600')
										: item.status === 'error'
										? (isDarkMode ? 'text-red-400' : 'text-red-600')
										: (isDarkMode ? 'text-gray-400' : 'text-gray-500');

									return (
										<div
											key={item.id}
											className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors ${
												isSelected
													? `${isDarkMode ? 'bg-slate-600 border-slate-500' : 'bg-white border-indigo-300 shadow-sm'}`
													: item.status === 'processing'
													? `${isDarkMode ? 'bg-slate-600/50 border-transparent' : 'bg-gray-100 border-transparent'}`
													: `${isDarkMode ? 'hover:bg-slate-600/50 border-transparent hover:border-slate-600' : 'hover:bg-gray-50 border-transparent hover:border-gray-300'} ${item.status === 'completed' ? 'cursor-pointer' : ''}`
											}`}
										>
											<button
												onClick={() => {
													selectBatchQueueItem(item.id);
												}}
												disabled={item.status === 'processing'}
												className={`w-[18px] h-[18px] rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
													isSelected
														? 'border-indigo-500 bg-indigo-500'
														: item.status === 'processing'
														? 'border-gray-500'
														: isDarkMode
															? 'border-gray-400 hover:border-gray-200'
															: 'border-gray-400 hover:border-gray-600'
												}`}
											>
												{isSelected && (
													<svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
														<path d="M5 13l4 4L19 7" />
													</svg>
												)}
											</button>

											<div
												onClick={() => {
													if (item.status === 'completed' && !isSelected) {
														selectBatchItem(item.id);
													}
												}}
												className="flex items-center gap-3 flex-1 min-w-0"
											>
												<img
													src={item.originalImage}
													alt={item.name}
													className="w-8 h-8 rounded object-cover flex-shrink-0"
												/>
												<span className={`flex-1 text-sm truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
													{item.name}
												</span>
											</div>

											{item.status === 'completed' && (
												<button
													onClick={(e) => {
														e.stopPropagation();
														downloadResultImage(item.originalImage, item.resultImage!, item.name, 'png');
													}}
													className={`flex-shrink-0 p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-slate-500 text-gray-300 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
													title={t('batchExport')}
												>
													<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
														<path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
													</svg>
												</button>
											)}
											{isSelected && item.status === 'completed' ? (
												<button
													onClick={() => { reprocessBatchItem(item.id, currentModel); selectAllBatchItems(false); }}
													className="text-xs px-2.5 py-1 rounded bg-indigo-500 text-white hover:bg-indigo-600 transition-colors flex-shrink-0 font-medium"
												>
													{t('reprocess')}
												</button>
											) : (
												<span className={`text-xs flex-shrink-0 font-medium ${statusColors}`}>
													{statusLabel}
												</span>
											)}
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="w-full h-full flex items-center justify-center">
			<div
				ref={containerRef}
				className={`relative w-full h-full rounded-none sm:rounded-lg overflow-hidden select-none touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'} ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`}
				style={{
					backgroundImage: `
						linear-gradient(45deg, ${isDarkMode ? '#334155' : '#e5e7eb'} 25%, transparent 25%),
						linear-gradient(-45deg, ${isDarkMode ? '#334155' : '#e5e7eb'} 25%, transparent 25%),
						linear-gradient(45deg, transparent 75%, ${isDarkMode ? '#334155' : '#e5e7eb'} 75%),
						linear-gradient(-45deg, transparent 75%, ${isDarkMode ? '#334155' : '#e5e7eb'} 75%)
					`,
					backgroundSize: '20px 20px',
					backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
					backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6',
				}}
				onMouseDown={handleContainerMouseDown}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
				onMouseMove={handleMouseMove}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleMouseUp}
				onWheel={handleWheel}
			>
				{/* Batch mode back button */}
				{batchMode && viewingBatchResult && (
					<button
						onClick={backToBatchQueue}
						className="absolute top-3 left-3 z-30 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-black/80 hover:bg-white/30 transition-colors flex items-center gap-1"
					>
						<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
							<path d="M15 18l-6-6 6-6" />
						</svg>
						{t('back')}
					</button>
				)}

				<div
					className="absolute inset-0 flex items-center justify-center"
					style={{
						transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
						transformOrigin: 'center center',
						transition: isDraggingSlider || isPanning ? 'none' : 'transform 0.1s ease-out',
					}}
				>
					<img
						src={displayOriginal!}
						alt="Original"
						className="max-w-full max-h-full object-contain"
						draggable={false}
					/>
				</div>

				{displayResult && (
					<div
						className="absolute inset-0"
						style={{
							clipPath: `inset(0 0 0 ${sliderPosition}%)`,
							backgroundImage: isDarkMode ? `
								linear-gradient(45deg, #334155 25%, transparent 25%),
								linear-gradient(-45deg, #334155 25%, transparent 25%),
								linear-gradient(45deg, transparent 75%, #334155 75%),
								linear-gradient(-45deg, transparent 75%, #334155 75%)
							` : `
								linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
								linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
								linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
								linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
							`,
							backgroundSize: '20px 20px',
							backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
							backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6',
						}}
					>
						<div
							className="w-full h-full flex items-center justify-center"
							style={{
								transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
								transformOrigin: 'center center',
								transition: isDraggingSlider || isPanning ? 'none' : 'transform 0.1s ease-out',
							}}
						>
							<img
								src={displayResult}
								alt="Result"
								className="max-w-full max-h-full object-contain"
								draggable={false}
							/>
						</div>
					</div>
				)}

				{displayResult && (
					<div
						className="slider-area absolute inset-y-0 w-20 cursor-ew-resize z-10"
						style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
						onMouseDown={handleSliderAreaMouseDown}
						onTouchStart={handleSliderAreaTouchStart}
					>
						<div
							ref={sliderRef}
							className="absolute top-0 bottom-0 left-1/2 w-1 bg-white shadow-lg -translate-x-1/2"
							onMouseDown={handleSliderMouseDown}
							onTouchStart={handleSliderTouchStart}
						>
							<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center pointer-events-none">
								<div className="flex gap-1">
									<div className="w-0.5 h-3 bg-gray-400" />
									<div className="w-0.5 h-3 bg-gray-400" />
								</div>
							</div>
						</div>
					</div>
				)}

				{isBatchProcessing && (
					<div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-5 z-20 animate-overlay-in">
						<div className="relative w-14 h-14">
							<div className="absolute inset-0 rounded-full border-4 border-white/10" />
							<div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-400 animate-spin" />
							<div className="absolute inset-2 rounded-full border-4 border-transparent border-r-indigo-300 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
						</div>
						<div className="text-white/70 text-sm">
							{t('processingHint')}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
