import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "../../stores/appStore";
import { useTranslation } from "../../lib/i18n";
import { useLanguage } from "../../hooks/useLanguage";

export function ImagePreview() {
	const { originalImage, resultImage, isProcessing } = useAppStore();
	const { t } = useTranslation();
	useLanguage();
	const [sliderPosition, setSliderPosition] = useState(50);
	const [isDragging, setIsDragging] = useState(false);
	const [scale, setScale] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = useState(false);
	const [panStart, setPanStart] = useState({ x: 0, y: 0 });
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasWrapperRef = useRef<HTMLDivElement>(null);

	if (!originalImage) return null;

	const handleSliderMove = useCallback((clientX: number) => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const x = clientX - rect.left;
		const percentage = (x / rect.width) * 100;
		setSliderPosition(Math.max(0, Math.min(100, percentage)));
	}, []);

	const handleMouseDown = (e: React.MouseEvent) => {
		if (e.button === 0 && !isPanning) {
			setIsDragging(true);
			handleSliderMove(e.clientX);
		}
	};

	const handleMouseUp = () => {
		setIsDragging(false);
		setIsPanning(false);
	};

	const handleMouseMove = useCallback((e: React.MouseEvent) => {
		if (isDragging) {
			handleSliderMove(e.clientX);
		}
		if (isPanning) {
			const dx = e.clientX - panStart.x;
			const dy = e.clientY - panStart.y;
			setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
			setPanStart({ x: e.clientX, y: e.clientY });
		}
	}, [isDragging, isPanning, panStart, handleSliderMove]);

	const handleTouchMove = useCallback((e: React.TouchEvent) => {
		if (isDragging) {
			handleSliderMove(e.touches[0].clientX);
		}
	}, [isDragging, handleSliderMove]);

	const handleWheel = (e: React.WheelEvent) => {
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		setScale(prev => Math.max(0.1, Math.min(5, prev * delta)));
	};

	const handlePanStart = (e: React.MouseEvent) => {
		if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
			setIsPanning(true);
			setPanStart({ x: e.clientX, y: e.clientY });
		}
	};

	return (
		<div className="w-full h-full flex items-center justify-center">
			<div
				ref={containerRef}
				className="relative w-full h-full bg-gray-100 rounded-lg overflow-hidden cursor-crosshair select-none"
				onMouseDown={handleMouseDown}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
				onMouseMove={handleMouseMove}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleMouseUp}
				onWheel={handleWheel}
			>
				{/* Original Image (Background) */}
				<img
					src={originalImage}
					alt="Original"
					className="absolute inset-0 w-full h-full object-contain"
					draggable={false}
				/>

				{/* Result Image (Foreground with clip) */}
				{resultImage && (
					<div
						className="absolute inset-0"
						style={{
							clipPath: `inset(0 0 0 ${sliderPosition}%)`,
							backgroundImage: `
								linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
								linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
								linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
								linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
							`,
							backgroundSize: '20px 20px',
							backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
							backgroundColor: '#f3f4f6',
						}}
					>
						<img
							src={resultImage}
							alt="Result"
							className="w-full h-full object-contain"
							draggable={false}
						/>
					</div>
				)}

				{/* Slider Line */}
				{resultImage && (
					<div
						className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
						style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
					>
						<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center">
							<div className="flex gap-1">
								<div className="w-0.5 h-3 bg-gray-400" />
								<div className="w-0.5 h-3 bg-gray-400" />
							</div>
						</div>
					</div>
				)}

				{/* Processing Overlay */}
				{isProcessing && (
					<div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-4">
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
