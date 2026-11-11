export type ModelGroupId = 'u2net' | 'isnet' | 'bria' | 'ben2' | 'modnet' | 'inspyrenet';

// GPU 回退原因：insecure-context = 非安全上下文（如 LAN HTTP），no-adapter = 浏览器无 WebGPU，runtime = 运行期创建/运行失败
export type GpuFallbackReason = 'insecure-context' | 'no-adapter' | 'runtime';

// 预览区键盘操作模式：arrows = 方向键（↑↓←→），wasd = WASD 键
export type KeyboardMode = 'arrows' | 'wasd';

// 预览区背景：transparent = 棋盘格（表示透明），black/white = 纯色，custom = 用户自选颜色
export type PreviewBackground = 'transparent' | 'black' | 'white' | 'custom';

// 预览背景控件的贴边收起位置，控件始终在对应边缘上居中
export type PreviewBackgroundPosition = 'top' | 'bottom' | 'left' | 'right';

export interface ModelGroup {
  id: ModelGroupId;
  nameKey: string;
  descKey: string;
}

// 输入预处理方式（各模型归一化差异较大，不能统一处理）
// imagenet: U2Net 系列，按 ImageNet 均值/方差逐通道归一化
// isnet:    ISNet / BRIA RMBG，按 x/255 - 0.5 归一化
// modnet:   MODNet，按 (x/255 - 0.5) / 0.5 归一化，即 x/127.5 - 1，范围 [-1, 1]
export type PreprocessMode = 'imagenet' | 'isnet' | 'modnet';

// 输出后处理方式（不同模型输出的数值范围不同）
// linear: 输出已在 [0,1]，直接乘 255
// minmax: 输出为任意范围，先按最小值/最大值线性映射到 [0,1]
export type PostprocessMode = 'linear' | 'minmax';

export type ModelConfig = {
  id: string;
  name: string;
  group: ModelGroupId;
  resolution: number;
  size: string;
  filename: string;
  descKey: string;
  downloadUrl: string;
  feedbackUrl: string[];
  // 缺省视为 'isnet'
  preprocess?: PreprocessMode;
  // 缺省视为 'linear'
  postprocess?: PostprocessMode;
};

export type ModelStatus = 'not_downloaded' | 'downloading' | 'downloaded' | 'error';

export type SettingsTab = 'general' | 'performance' | 'models' | 'about' | 'relatedTools';

export type UpdateCheckState = 'idle' | 'checking' | 'available' | 'up-to-date' | 'error';

export interface DownloadProgressInfo {
  loaded: number;
  total: number;
  percentage: number;
}

export type AppState = {
  currentModel: string;
  // 持久化的默认模型（应用启动时使用）
  defaultModel: string;
  originalImage: string | null;
  resultImage: string | null;
  isProcessing: boolean;
  progress: number;
  error: string | null;
  success: string | null;
  isReadyToProcess: boolean;
  processedModel: string | null;
  currentPage: 'main' | 'models' | 'settings';
  settingsTab: SettingsTab;
  isDarkMode: boolean;
  checkUpdatesOnStartup: boolean;
  updateCheckState: UpdateCheckState;
  latestVersion: string | null;
  dismissedUpdateVersion: string | null;
  processingTrigger: number;
  cachedModelUrl: string | null;
  isModelLoading: boolean;
  // 全局模型状态
  modelStatuses: Record<string, ModelStatus>;
  isModelStatusesLoaded: boolean;
  // 全局下载进度状态（跨页面保持）
  modelDownloadProgresses: Record<string, DownloadProgressInfo | null>;
  // 正在静默写入 IndexedDB 的模型
  savingModels: string[];
  // GPU (WebGPU) 加速：用户偏好，失败时自动回退到 CPU
  gpuAcceleration: boolean;
  // 运行期状态：GPU 已启用但实际回退到 CPU
  gpuFallbackActive: boolean;
  // 回退原因，决定提示文案（安全上下文 / 无 WebGPU / 运行期失败）
  gpuFallbackReason: GpuFallbackReason | null;
  // 批处理数量超过并发数时，提前把模型加载进空闲 worker（懒预热）
  preloadEnabled: boolean;
  // 预览区键盘操作模式，用户偏好，持久化到 localStorage
  keyboardMode: KeyboardMode;
  // 预览区背景模式与自定义颜色，用户偏好，持久化到 localStorage
  previewBackground: PreviewBackground;
  previewBackgroundColor: string;
  // 预览背景控件的贴边收起位置，用户偏好，持久化到 localStorage
  previewBackgroundPosition: PreviewBackgroundPosition;

  // 客户端挂载后应用持久化偏好，确保 SSR 与客户端首帧一致
  hydrateFromStorage: () => void;

  setGpuAcceleration: (enabled: boolean) => void;
  setGpuFallbackActive: (active: boolean) => void;
  // GPU 自动回退到 CPU：仅影响当前会话，不写入用户偏好（下次启动仍默认启用 GPU）
  applyGpuFallback: (reason?: GpuFallbackReason) => void;
  setPreloadEnabled: (enabled: boolean) => void;
  setKeyboardMode: (mode: KeyboardMode) => void;
  setPreviewBackground: (mode: PreviewBackground) => void;
  setPreviewBackgroundColor: (color: string) => void;
  setPreviewBackgroundPosition: (position: PreviewBackgroundPosition) => void;

  setCurrentModel: (model: string) => Promise<void>;
  setDefaultModel: (modelId: string) => void;
  setCurrentPage: (page: 'main' | 'models' | 'settings') => void;
  setSettingsTab: (tab: SettingsTab) => void;
  setOriginalImage: (image: string | null) => void;
  setResultImage: (image: string | null) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
  setIsReadyToProcess: (isReady: boolean) => void;
  setProcessedModel: (model: string | null) => void;
  setIsDarkMode: (isDark: boolean) => void;
  setCheckUpdatesOnStartup: (enabled: boolean) => void;
  setUpdateCheckState: (state: UpdateCheckState) => void;
  setLatestVersion: (version: string | null) => void;
  dismissUpdateNotice: () => void;
  startProcessing: () => void;
  reset: () => void;
  // 全局模型状态管理
  initializeModelStatuses: () => Promise<void>;
  updateModelStatus: (modelId: string, status: ModelStatus) => void;
  // 全局下载进度管理
  setModelDownloadProgress: (modelId: string, progress: DownloadProgressInfo | null) => void;
  addSavingModel: (modelId: string) => void;
  removeSavingModel: (modelId: string) => void;
  downloadModelWithProgress: (modelId: string) => Promise<string>;
  cancelModelDownload: (modelId: string) => void;

  // 批量处理
  batchMode: boolean;
  batchQueue: BatchItem[];
  batchConcurrency: number;
  activeBatchItemId: string | null;
  viewingBatchResult: boolean;
  selectedBatchItemIds: string[];
  selectionAnchorId: string | null;

  setBatchMode: (mode: boolean) => void;
  setBatchConcurrency: (value: number) => void;
  addToBatchQueue: (file: File) => Promise<void>;
  selectBatchItem: (id: string) => void;
  selectBatchQueueItem: (id: string, shiftKey?: boolean) => void;
  selectAllBatchItems: (selectAll: boolean) => void;
  setBatchItemProgress: (id: string, progress: number) => void;
  setBatchItemThumbnail: (id: string, thumbnailImage: string) => void;
  backToBatchQueue: () => void;
  removeBatchItem: (id: string) => void;
  clearBatchQueue: () => void;
  reprocessBatchItem: (id: string, modelId: string) => void;
  updateBatchItemStatus: (
    id: string,
    status: BatchItemStatus,
    resultImage?: string | null,
    error?: string | null,
  ) => void;
};

export type BatchItemStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface BatchItem {
  id: string;
  // 原始图在 imageStore 里的 key（blob: URL 字符串），活的 URL 会在落盘后释放
  originalImage: string;
  // 同上，结果图的 key
  resultImage: string | null;
  // 队列列表专用的小图，只有它常驻内存
  thumbnailImage: string | null;
  status: BatchItemStatus;
  modelId: string;
  name: string;
  error?: string | null;
  progress: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export type UseRemoveBackgroundOptions = {
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onSuccess?: (result: string) => void;
};

export type UseRemoveBackgroundReturn = {
  processImage: (imageUrl: string, modelId: string) => Promise<void>;
};
