import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { PreviewBackground, PreviewBackgroundPosition } from '../../types/app';
import { useTranslation } from '../../lib/i18n';
import { downloadResultImage } from '../../utils/downloadImage';
import { GPU_CONCURRENCY, getBatchConcurrencyOptions } from '../../utils/concurrency';
import { Select } from '../ui/Select';
import { SelfHealingImage } from '../ui/SelfHealingImage';
import { getImageBlob } from '../../utils/imageStore';
import { useStoredImageSrc } from '../../hooks/useStoredImageSrc';

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0.0s';
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

function ProgressRing({ progress, isDarkMode }: { progress: number; isDarkMode: boolean }) {
  const size = 32;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
      title={`${Math.round(clamped)}%`}
    >
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={isDarkMode ? 'stroke-slate-500' : 'stroke-gray-300'}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="stroke-indigo-500 transition-[stroke-dashoffset] duration-200 ease-out"
        />
      </svg>
      <span
        className={`absolute inset-0 z-10 flex items-center justify-center text-[9px] leading-none font-semibold tabular-nums ${
          isDarkMode ? 'text-gray-100' : 'text-gray-700'
        }`}
      >
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

function getPreviewBackgroundStyle(
  mode: PreviewBackground,
  customColor: string,
  isDarkMode: boolean,
): React.CSSProperties {
  if (mode === 'black') {
    return { backgroundColor: '#000000', backgroundImage: 'none' };
  }
  if (mode === 'white') {
    return { backgroundColor: '#ffffff', backgroundImage: 'none' };
  }
  if (mode === 'custom') {
    return { backgroundColor: customColor, backgroundImage: 'none' };
  }

  const tile = isDarkMode ? '#334155' : '#e5e7eb';
  return {
    backgroundImage: `
			linear-gradient(45deg, ${tile} 25%, transparent 25%),
			linear-gradient(-45deg, ${tile} 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, ${tile} 75%),
			linear-gradient(-45deg, transparent 75%, ${tile} 75%)
		`,
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
    backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6',
  };
}

function getRelativeLuminance(hex: string): number | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    return null;
  }
  const value =
    match[1].length === 3
      ? match[1]
          .split('')
          .map((char) => char + char)
          .join('')
      : match[1];
  const channel = (offset: number) => {
    const srgb = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

// 叠加在预览区上的控件（返回/下载/翻页/背景切换）必须随底色切换明暗，
// 否则黑色或深色自定义背景上的黑色文字几乎不可见。0.35 是保证对比度的经验阈值。
function isLightPreviewBackground(
  mode: PreviewBackground,
  customColor: string,
  isDarkMode: boolean,
): boolean {
  if (mode === 'white') {
    return true;
  }
  if (mode === 'black') {
    return false;
  }
  if (mode === 'custom') {
    const luminance = getRelativeLuminance(customColor);
    return luminance === null ? true : luminance > 0.35;
  }
  return !isDarkMode;
}

function overlayPillClass(isLightBackground: boolean, disabled = false): string {
  if (isLightBackground) {
    return disabled
      ? 'bg-black/5 text-black/25 cursor-not-allowed'
      : 'bg-black/10 text-black/80 hover:bg-black/20';
  }
  return disabled
    ? 'bg-white/10 text-white/30 cursor-not-allowed'
    : 'bg-white/25 text-white hover:bg-white/40';
}

// 按住方向键时对比轴每秒移动的百分比，决定长按的滑动手感。
const SLIDER_HOLD_SPEED = 50;
const SLIDER_DOUBLE_PRESS_MS = 350;

function BatchNavButton({
  direction,
  disabled,
  label,
  isLightBackground,
  onClick,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  label: string;
  isLightBackground: boolean;
  onClick: () => void;
}) {
  const isPrev = direction === 'prev';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`absolute bottom-3 z-30 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
        isPrev ? 'left-3' : 'right-3'
      } ${overlayPillClass(isLightBackground, disabled)}`}
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d={isPrev ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
      </svg>
    </button>
  );
}

const SWATCH_BASE_CLASS =
  'relative flex-shrink-0 w-[18px] h-[18px] rounded-full transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';
const SWATCH_ACTIVE_CLASS = 'outline outline-2 outline-offset-1 outline-indigo-500';

const TRANSPARENT_SWATCH_STYLE: React.CSSProperties = {
  backgroundColor: '#ffffff',
  backgroundImage:
    'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)',
  backgroundSize: '5px 5px',
  backgroundPosition: '0 0, 0 2.5px, 2.5px -2.5px, -2.5px 0px',
};

// 贴边收起：在预览区选定的那条边上留一条不可见的感应区，鼠标移入或键盘聚焦时色板滑出。
// 这些类名必须写成完整字面量，Tailwind 才能扫描到。
const PREVIEW_BACKGROUND_LAYOUT: Record<
  PreviewBackgroundPosition,
  { wrapper: string; hint: string; panel: string; chevron: string }
> = {
  left: {
    wrapper: 'inset-y-0 left-0 w-3 items-center',
    hint: 'left-0 top-1/2 h-11 w-3.5 -translate-y-1/2 rounded-r-full',
    panel:
      'flex-col -translate-x-[calc(100%+8px)] group-hover:translate-x-3 group-focus-within:translate-x-3 [@media(hover:none)]:translate-x-3',
    chevron: '',
  },
  right: {
    wrapper: 'inset-y-0 right-0 w-3 items-center justify-end',
    hint: 'right-0 top-1/2 h-11 w-3.5 -translate-y-1/2 rounded-l-full',
    panel:
      'flex-col translate-x-[calc(100%+8px)] group-hover:-translate-x-3 group-focus-within:-translate-x-3 [@media(hover:none)]:-translate-x-3',
    chevron: 'rotate-180',
  },
  top: {
    wrapper: 'inset-x-0 top-0 h-3 justify-center items-start',
    hint: 'top-0 left-1/2 w-11 h-3.5 -translate-x-1/2 rounded-b-full',
    panel:
      'flex-row -translate-y-[calc(100%+8px)] group-hover:translate-y-3 group-focus-within:translate-y-3 [@media(hover:none)]:translate-y-3',
    chevron: 'rotate-90',
  },
  bottom: {
    wrapper: 'inset-x-0 bottom-0 h-3 justify-center items-end',
    hint: 'bottom-0 left-1/2 w-11 h-3.5 -translate-x-1/2 rounded-t-full',
    panel:
      'flex-row translate-y-[calc(100%+8px)] group-hover:-translate-y-3 group-focus-within:-translate-y-3 [@media(hover:none)]:-translate-y-3',
    chevron: '-rotate-90',
  },
};

const HINT_BASE_CLASS =
  'pointer-events-none absolute flex items-center justify-center shadow-sm backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-0 group-focus-within:opacity-0 [@media(hover:none)]:opacity-0';

const PANEL_BASE_CLASS =
  'flex items-center gap-1.5 rounded-full p-1.5 shadow-sm backdrop-blur-sm transition-transform duration-200 ease-out';

function PreviewBackgroundControl({
  value,
  customColor,
  isLightBackground,
  position,
  onChange,
  onCustomColorChange,
  t,
}: {
  value: PreviewBackground;
  customColor: string;
  isLightBackground: boolean;
  position: PreviewBackgroundPosition;
  onChange: (mode: PreviewBackground) => void;
  onCustomColorChange: (color: string) => void;
  t: (key: string) => string;
}) {
  const layout = PREVIEW_BACKGROUND_LAYOUT[position];
  return (
    <div
      role="group"
      aria-label={t('previewBackground')}
      title={t('previewBackground')}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className={`group absolute z-30 flex ${layout.wrapper}`}
    >
      <span
        aria-hidden="true"
        className={`${HINT_BASE_CLASS} ${layout.hint} ${
          isLightBackground ? 'bg-black/10 text-black/50' : 'bg-white/20 text-white/70'
        }`}
      >
        <svg
          className={`w-2.5 h-2.5 ${layout.chevron}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
        </svg>
      </span>
      <div
        className={`${PANEL_BASE_CLASS} ${layout.panel} ${
          isLightBackground ? 'bg-black/10' : 'bg-white/20'
        }`}
      >
        <button
          type="button"
          onClick={() => onChange('transparent')}
          aria-pressed={value === 'transparent'}
          aria-label={t('backgroundTransparent')}
          title={t('backgroundTransparent')}
          style={TRANSPARENT_SWATCH_STYLE}
          className={`${SWATCH_BASE_CLASS} border border-black/15 ${
            value === 'transparent' ? SWATCH_ACTIVE_CLASS : ''
          }`}
        />
        <button
          type="button"
          onClick={() => onChange('black')}
          aria-pressed={value === 'black'}
          aria-label={t('backgroundBlack')}
          title={t('backgroundBlack')}
          style={{ backgroundColor: '#000000' }}
          className={`${SWATCH_BASE_CLASS} border border-white/25 ${
            value === 'black' ? SWATCH_ACTIVE_CLASS : ''
          }`}
        />
        <button
          type="button"
          onClick={() => onChange('white')}
          aria-pressed={value === 'white'}
          aria-label={t('backgroundWhite')}
          title={t('backgroundWhite')}
          style={{ backgroundColor: '#ffffff' }}
          className={`${SWATCH_BASE_CLASS} border border-black/15 ${
            value === 'white' ? SWATCH_ACTIVE_CLASS : ''
          }`}
        />
        <label
          title={t('backgroundCustom')}
          aria-label={t('backgroundCustom')}
          style={{ backgroundColor: customColor }}
          onClick={() => onChange('custom')}
          className={`${SWATCH_BASE_CLASS} cursor-pointer border border-black/15 ${
            value === 'custom' ? SWATCH_ACTIVE_CLASS : ''
          }`}
        >
          <input
            type="color"
            value={customColor}
            aria-label={t('backgroundCustom')}
            onChange={(event) => {
              onCustomColorChange(event.target.value);
              onChange('custom');
            }}
            className="absolute inset-0 w-full h-full rounded-full opacity-0 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}

export function ImagePreview() {
  const {
    originalImage,
    resultImage,
    isProcessing,
    isDarkMode,
    batchMode,
    batchQueue,
    batchConcurrency,
    viewingBatchResult,
    activeBatchItemId,
    selectedBatchItemIds,
    currentModel,
    selectBatchItem,
    selectBatchQueueItem,
    selectAllBatchItems,
    backToBatchQueue,
    reprocessBatchItem,
    setBatchConcurrency,
    gpuAcceleration,
    keyboardMode,
    previewBackground,
    previewBackgroundColor,
    previewBackgroundPosition,
    setPreviewBackground,
    setPreviewBackgroundColor,
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
  const lastArrowRef = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const hasProcessingItem = batchQueue.some((item) => item.status === 'processing');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hasProcessingItem) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [hasProcessingItem]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  }, []);

  const copyImageToClipboard = useCallback(
    async (resultImageUrl: string) => {
      try {
        const blob = await getImageBlob(resultImageUrl);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast(t('copied'));
      } catch (err) {
        console.error('Copy failed:', err);
        alert(t('copyFailed'));
      }
    },
    [showToast, t],
  );

  const activeBatchItem = batchMode
    ? (batchQueue.find((item) => item.id === activeBatchItemId) ?? null)
    : null;

  const showQueueList = batchMode && !viewingBatchResult;
  const displayOriginal = activeBatchItem ? activeBatchItem.originalImage : originalImage;
  const displayResult = (activeBatchItem ? activeBatchItem.resultImage : resultImage) ?? undefined;

  // 批处理模式下 originalImage/resultImage 只是 imageStore 的 key，字节留在 IndexedDB。
  // 这里按需租一个活 URL，切换图片或卸载时立刻释放，内存中只保留当前显示的这两张。
  const leasedOriginalSrc = useStoredImageSrc(batchMode ? displayOriginal : null);
  const leasedResultSrc = useStoredImageSrc(batchMode ? displayResult : null);
  const originalSrcToRender = batchMode ? leasedOriginalSrc : displayOriginal;
  const resultSrcToRender = batchMode ? leasedResultSrc : displayResult;
  const isBatchProcessing = activeBatchItem
    ? activeBatchItem.status === 'processing'
    : isProcessing;

  const handleSliderMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  }, []);

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (isBatchProcessing) return;
    if (e.button === 1) {
      // 中键在对比区任意位置都能拖动对比轴；浏览器默认会把中键按下当成自动滚动。
      e.preventDefault();
      if (!displayResult) return;
      setIsDraggingSlider(true);
      handleSliderMove(e.clientX);
      return;
    }
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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingSlider) {
        handleSliderMove(e.clientX);
      }
      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    },
    [isDraggingSlider, isPanning, panStart, handleSliderMove],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      // onTouchMove 是 passive 监听器，不能 preventDefault；滚动已由容器的 touch-action: none 阻止。
      if (isDraggingSlider) {
        handleSliderMove(e.touches[0].clientX);
      }
      if (isPanning) {
        const touch = e.touches[0];
        const dx = touch.clientX - panStart.x;
        const dy = touch.clientY - panStart.y;
        setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        setPanStart({ x: touch.clientX, y: touch.clientY });
      }
    },
    [isDraggingSlider, isPanning, panStart, handleSliderMove],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isBatchProcessing) return;
      const touch = e.touches[0];
      const target = e.target as HTMLElement;
      if (target.closest('.slider-area')) return;
      setIsPanning(true);
      setPanStart({ x: touch.clientX, y: touch.clientY });
    },
    [isBatchProcessing],
  );

  const handleSliderTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      if (isBatchProcessing) return;
      setIsDraggingSlider(true);
      handleSliderMove(e.touches[0].clientX);
    },
    [isBatchProcessing, handleSliderMove],
  );

  const handleSliderAreaTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      if (isBatchProcessing) return;
      setIsDraggingSlider(true);
      handleSliderMove(e.touches[0].clientX);
    },
    [isBatchProcessing, handleSliderMove],
  );

  const handleWheel = (e: React.WheelEvent) => {
    if (isBatchProcessing) return;
    // onWheel 是 passive 监听器，不能 preventDefault；页面本身不可滚动。
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.max(0.1, Math.min(5, prev * delta)));
  };

  const previewableItems = batchMode
    ? batchQueue.filter((item) => item.status === 'completed' && item.resultImage)
    : [];
  const activePreviewIndex = previewableItems.findIndex((item) => item.id === activeBatchItemId);
  const previousBatchItem =
    activePreviewIndex > 0 ? previewableItems[activePreviewIndex - 1] : null;
  const nextBatchItem =
    activePreviewIndex >= 0 && activePreviewIndex < previewableItems.length - 1
      ? previewableItems[activePreviewIndex + 1]
      : null;
  const showBatchNav = batchMode && viewingBatchResult && previewableItems.length > 1;
  const hasComparison = !!displayResult;
  const previewIsLight = isLightPreviewBackground(
    previewBackground,
    previewBackgroundColor,
    isDarkMode,
  );
  const previewBackgroundStyle = getPreviewBackgroundStyle(
    previewBackground,
    previewBackgroundColor,
    isDarkMode,
  );

  useEffect(() => {
    if (!showBatchNav && !hasComparison) return;
    let frame: number | null = null;
    let direction = 0;
    let lastFrameAt = 0;

    const stopSliding = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      direction = 0;
      lastFrameAt = 0;
    };

    const step = (timestamp: number) => {
      if (direction === 0) {
        frame = null;
        return;
      }
      if (lastFrameAt !== 0) {
        const delta = ((timestamp - lastFrameAt) / 1000) * SLIDER_HOLD_SPEED * direction;
        setSliderPosition((current) => Math.max(0, Math.min(100, current + delta)));
      }
      lastFrameAt = timestamp;
      frame = requestAnimationFrame(step);
    };

    const startSliding = (next: number) => {
      direction = next;
      if (frame === null) {
        lastFrameAt = 0;
        frame = requestAnimationFrame(step);
      }
    };

    const isDoublePress = (key: string) => {
      const pressedAt = Date.now();
      const previous = lastArrowRef.current;
      const double = previous.key === key && pressedAt - previous.at < SLIDER_DOUBLE_PRESS_MS;
      lastArrowRef.current = { key: double ? '' : key, at: pressedAt };
      return double;
    };

    const keyMap =
      keyboardMode === 'wasd'
        ? { prev: 'w', next: 's', left: 'a', right: 'd' }
        : { prev: 'arrowup', next: 'arrowdown', left: 'arrowleft', right: 'arrowright' };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === keyMap.prev && previousBatchItem) {
        event.preventDefault();
        selectBatchItem(previousBatchItem.id);
        return;
      }
      if (key === keyMap.next && nextBatchItem) {
        event.preventDefault();
        selectBatchItem(nextBatchItem.id);
        return;
      }
      if (!hasComparison) return;
      const isLeft = key === keyMap.left;
      const isRight = key === keyMap.right;
      if (!isLeft && !isRight) return;
      event.preventDefault();
      const next = isLeft ? -1 : 1;
      if (event.repeat) {
        // 自动重复只用来保证动画在跑：对侧键的 keyup 可能晚于本键 keydown 到达，
        // 会把刚启动的滑动停掉，此时没有新的 keydown 能把它拉回来。
        startSliding(next);
        return;
      }
      if (isDoublePress(key)) {
        stopSliding();
        setSliderPosition(isLeft ? 0 : 100);
        return;
      }
      startSliding(next);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const released = key === keyMap.left ? -1 : key === keyMap.right ? 1 : 0;
      if (released !== 0 && released === direction) stopSliding();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', stopSliding);
    return () => {
      stopSliding();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', stopSliding);
    };
  }, [
    showBatchNav,
    hasComparison,
    previousBatchItem,
    nextBatchItem,
    selectBatchItem,
    keyboardMode,
  ]);

  if (!showQueueList && !displayOriginal) return null;

  if (showQueueList) {
    const selectableCount = batchQueue.filter(
      (item) => item.status === 'completed' || item.status === 'error',
    ).length;
    const allSelected = selectableCount > 0 && selectableCount === selectedBatchItemIds.length;
    const someSelected = selectedBatchItemIds.length > 0 && !allSelected;

    const totalCount = batchQueue.length;
    const failedCount = batchQueue.filter((item) => item.status === 'error').length;
    const processedCount = batchQueue.filter(
      (item) => item.status === 'completed' || item.status === 'error',
    ).length;
    const progressPercent = totalCount === 0 ? 0 : Math.round((processedCount / totalCount) * 100);
    const isGpu = gpuAcceleration;
    const activeConcurrency = isGpu ? GPU_CONCURRENCY : batchConcurrency;
    const concurrencyLabel = isGpu ? t('gpuConcurrency') : t('cpuConcurrency');
    const concurrencyOptions = getBatchConcurrencyOptions().map((value) => ({
      value,
      label: String(value),
    }));

    return (
      <div className="w-full h-full flex items-center justify-center relative">
        {toastMessage && (
          <div
            className={`absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all ${
              isDarkMode ? 'bg-green-600 text-white' : 'bg-green-600 text-white'
            }`}
          >
            {toastMessage}
          </div>
        )}
        <div
          className={`relative w-full h-full rounded-none sm:rounded-lg overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-gray-200'}`}
        >
          {batchQueue.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              {t('batchEmpty')}
            </div>
          ) : (
            <div className="flex flex-col w-full h-full">
              <div
                className={`px-3 pt-2.5 pb-2 border-b ${isDarkMode ? 'border-slate-600' : 'border-gray-300'}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
                    >
                      {t('batchProgress')}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Select
                        value={activeConcurrency}
                        options={concurrencyOptions}
                        onChange={setBatchConcurrency}
                        isDarkMode={isDarkMode}
                        readOnly={isGpu}
                        ariaLabel={concurrencyLabel}
                        title={concurrencyLabel}
                      />
                      <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {concurrencyLabel}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-xs tabular-nums flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                  >
                    {processedCount} / {totalCount}
                    {failedCount > 0 && (
                      <span className={isDarkMode ? 'text-red-400' : 'text-red-500'}>
                        {' · '}
                        {failedCount} {t('batchProgressFailed')}
                      </span>
                    )}
                    <span className="ml-1.5">{progressPercent}%</span>
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                  className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-600' : 'bg-gray-300'}`}
                >
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-[width] duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div
                className={`flex items-center gap-2 px-3 h-9 border-b ${isDarkMode ? 'border-slate-600' : 'border-gray-300'}`}
              >
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
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {someSelected && <div className="w-2 h-0.5 rounded-full bg-indigo-500" />}
                </button>
                <span
                  className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
                >
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
                  const isSelectable = item.status === 'completed' || item.status === 'error';
                  const statusLabel =
                    item.status === 'processing'
                      ? t('processingHint')
                      : item.status === 'completed'
                        ? t('batchStatusCompleted')
                        : item.status === 'error'
                          ? t('batchStatusFailed')
                          : t('batchStatusPending');
                  const statusColors =
                    item.status === 'processing'
                      ? isDarkMode
                        ? 'text-blue-400'
                        : 'text-blue-600'
                      : item.status === 'completed'
                        ? isDarkMode
                          ? 'text-green-400'
                          : 'text-green-600'
                        : item.status === 'error'
                          ? isDarkMode
                            ? 'text-red-400'
                            : 'text-red-600'
                          : isDarkMode
                            ? 'text-gray-400'
                            : 'text-gray-500';

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors select-none ${
                        isSelected
                          ? `${isDarkMode ? 'bg-slate-600 border-slate-500' : 'bg-white border-indigo-300 shadow-sm'}`
                          : item.status === 'processing'
                            ? `${isDarkMode ? 'bg-slate-600/50 border-transparent' : 'bg-gray-100 border-transparent'}`
                            : isSelectable
                              ? `${isDarkMode ? 'hover:bg-slate-600/50 border-transparent hover:border-slate-600 cursor-pointer' : 'hover:bg-gray-50 border-transparent hover:border-gray-300 cursor-pointer'}`
                              : 'border-transparent'
                      }`}
                    >
                      <button
                        onClick={(event) => {
                          selectBatchQueueItem(item.id, event.shiftKey);
                        }}
                        disabled={!isSelectable}
                        className={`w-[18px] h-[18px] rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500'
                            : !isSelectable
                              ? `${isDarkMode ? 'border-gray-600' : 'border-gray-300'} cursor-not-allowed`
                              : isDarkMode
                                ? 'border-gray-400 hover:border-gray-200'
                                : 'border-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-2.5 h-2.5 text-white"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
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
                        className="flex-1 min-w-0"
                      >
                        <div className="flex items-center gap-3">
                          {item.thumbnailImage ? (
                            <SelfHealingImage
                              src={item.thumbnailImage}
                              alt={item.name}
                              className="w-8 h-8 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-8 h-8 rounded flex-shrink-0 ${isDarkMode ? 'bg-slate-600' : 'bg-gray-300'}`}
                            />
                          )}
                          <span
                            className={`flex-1 text-sm truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}
                          >
                            {item.name}
                          </span>
                        </div>
                        {item.status !== 'pending' && (
                          <span
                            className={`block mt-0.5 text-[10px] tabular-nums ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                          >
                            {formatDuration(
                              item.startedAt === null
                                ? 0
                                : (item.finishedAt ?? now) - item.startedAt,
                            )}
                          </span>
                        )}
                      </div>

                      {item.status === 'completed' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyImageToClipboard(item.resultImage!);
                            }}
                            className={`flex-shrink-0 p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-slate-500 text-gray-300 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
                            title={t('copyToClipboard')}
                          >
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadResultImage(
                                item.originalImage,
                                item.resultImage!,
                                item.name,
                                'png',
                              );
                            }}
                            className={`flex-shrink-0 p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-slate-500 text-gray-300 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
                            title={t('batchExport')}
                          >
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                        </>
                      )}
                      {item.status === 'processing' ? (
                        <ProgressRing progress={item.progress} isDarkMode={isDarkMode} />
                      ) : isSelected && item.status === 'completed' ? (
                        <button
                          onClick={() => {
                            reprocessBatchItem(item.id, currentModel);
                            selectAllBatchItems(false);
                          }}
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
        style={previewBackgroundStyle}
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
            className={`absolute top-3 left-3 z-30 px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${overlayPillClass(previewIsLight)}`}
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {t('back')}
          </button>
        )}

        {batchMode && viewingBatchResult && displayResult && (
          <button
            onClick={() =>
              downloadResultImage(
                displayOriginal!,
                displayResult,
                activeBatchItem?.name ?? 'image',
                'png',
              )
            }
            onMouseDown={(e) => e.stopPropagation()}
            className={`absolute top-3 right-3 z-30 px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${overlayPillClass(previewIsLight)}`}
            title={t('downloadImage')}
            aria-label={t('downloadImage')}
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {t('downloadImage')}
          </button>
        )}

        <PreviewBackgroundControl
          value={previewBackground}
          customColor={previewBackgroundColor}
          isLightBackground={previewIsLight}
          position={previewBackgroundPosition}
          onChange={setPreviewBackground}
          onCustomColorChange={setPreviewBackgroundColor}
          t={t}
        />

        {showBatchNav && (
          <>
            <BatchNavButton
              direction="prev"
              disabled={!previousBatchItem}
              label={t('previousImage')}
              isLightBackground={previewIsLight}
              onClick={() => previousBatchItem && selectBatchItem(previousBatchItem.id)}
            />
            <BatchNavButton
              direction="next"
              disabled={!nextBatchItem}
              label={t('nextImage')}
              isLightBackground={previewIsLight}
              onClick={() => nextBatchItem && selectBatchItem(nextBatchItem.id)}
            />
          </>
        )}

        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDraggingSlider || isPanning ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <SelfHealingImage
            src={originalSrcToRender!}
            alt="Original"
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        </div>

        {resultSrcToRender && (
          <div
            className="absolute inset-0"
            style={{
              clipPath: `inset(0 0 0 ${sliderPosition}%)`,
              ...previewBackgroundStyle,
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
              <SelfHealingImage
                src={resultSrcToRender}
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
              <div
                className="absolute inset-2 rounded-full border-4 border-transparent border-r-indigo-300 animate-spin"
                style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
              />
            </div>
            <div className="text-white/70 text-sm">{t('processingHint')}</div>
          </div>
        )}
      </div>
    </div>
  );
}
