import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "../../stores/appStore";
import { useTranslation } from "../../lib/i18n";

export function ImagePreview() {
	const { originalImage, resultImage, isProcessing, isDarkMode } = useAppStore();
	const { t } = useTranslation();
	const [sliderPosition, setSliderPosition] = useState(50);
	const [isDraggingSlider, setIsDraggingSlider] = useState(false);
	const [scale, setScale] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = useState(false);
	const [panStart, setPanStart] = useState({ x: 0, y: 0 });
	const containerRef = useRef<HTMLDivElement>(null);
	const sliderRef = useRef<HTMLDivElement>(null);

	if (!originalImage) return null;

	const handleSliderMove = useCallback((clientX: number) => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const x = clientX - rect.left;
		const percentage = (x / rect.width) * 100;
		setSliderPosition(Math.max(0, Math.min(100, percentage)));
	}, []);

	const handleContainerMouseDown = (e: React.MouseEvent) => {
		// 处理中时禁止拖拽
		if (isProcessing) return;
		// 只处理左键
		if (e.button !== 0) return;

		// 直接进入拖拽模式（无延迟）
		setIsPanning(true);
		setPanStart({ x: e.clientX, y: e.clientY });
	};

	const handleSliderMouseDown = (e: React.MouseEvent) => {
		e.stopPropagation(); // 阻止冒泡到容器
		setIsDraggingSlider(true);
		handleSliderMove(e.clientX);
	};

	const handleSliderAreaMouseDown = (e: React.MouseEvent) => {
		// 阻止冒泡到容器，防止图片被拖拽
		e.stopPropagation();
		// 处理中时禁止操作
		if (isProcessing) return;
		// 如果点击的是滑块本身，不处理（让滑块自己的事件处理）
		if (sliderRef.current && sliderRef.current.contains(e.target as Node)) return;

		// 点击滑块区域直接设置位置
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
		if (isDraggingSlider) {
			handleSliderMove(e.touches[0].clientX);
		}
	}, [isDraggingSlider, handleSliderMove]);

	const handleWheel = (e: React.WheelEvent) => {
		// 处理中时禁止缩放
		if (isProcessing) return;
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		setScale(prev => Math.max(0.1, Math.min(5, prev * delta)));
	};

	return (
		<div className="w-full h-full flex items-center justify-center">
			<div
				ref={containerRef}
				className={`relative w-full h-full rounded-lg overflow-hidden select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'} ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`}
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
				onTouchMove={handleTouchMove}
				onTouchEnd={handleMouseUp}
				onWheel={handleWheel}
			>
				{/* Original Image (Background) */}
				<div
					className="absolute inset-0 flex items-center justify-center"
					style={{
						transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
						transformOrigin: 'center center',
						transition: isDraggingSlider || isPanning ? 'none' : 'transform 0.1s ease-out',
					}}
				>
					<img
						src={originalImage}
						alt="Original"
						className="max-w-full max-h-full object-contain"
						draggable={false}
					/>
				</div>

				{/* Result Image (Foreground with clip) */}
				{resultImage && (
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
								src={resultImage}
								alt="Result"
								className="max-w-full max-h-full object-contain"
								draggable={false}
							/>
						</div>
					</div>
				)}

				{/* Slider Area - 扩大点击触发区域 */}
				{resultImage && (
					<div
						className="absolute inset-y-0 w-20 cursor-ew-resize z-10"
						style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
						onMouseDown={handleSliderAreaMouseDown}
					>
						{/* Slider Line */}
						<div
							ref={sliderRef}
							className="absolute top-0 bottom-0 left-1/2 w-1 bg-white shadow-lg -translate-x-1/2"
							onMouseDown={handleSliderMouseDown}
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

				{/* Processing Overlay */}
				{isProcessing && (
					<div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-4 z-20">
						<div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
						<div className="text-white text-lg font-medium">
							{t('processingHint')}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
