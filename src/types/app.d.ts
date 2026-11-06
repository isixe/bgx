export type ModelConfig = {
  id: string;
  name: string;
  resolution: number;
  size: string;
  filename: string;
  descKey: string;
  downloadUrl: string;
  feedbackUrl: string;
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
  // 批处理数量超过并发数时，提前把模型加载进空闲 worker（懒预热）
  preloadEnabled: boolean;

  // 客户端挂载后应用持久化偏好，确保 SSR 与客户端首帧一致
  hydrateFromStorage: () => void;

  setGpuAcceleration: (enabled: boolean) => void;
  setGpuFallbackActive: (active: boolean) => void;
  // GPU 自动回退到 CPU：仅影响当前会话，不写入用户偏好（下次启动仍默认启用 GPU）
  applyGpuFallback: () => void;
  setPreloadEnabled: (enabled: boolean) => void;

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
  originalImage: string;
  resultImage: string | null;
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
