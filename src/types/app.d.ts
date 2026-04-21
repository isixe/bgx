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

export interface DownloadProgressInfo {
  loaded: number;
  total: number;
  percentage: number;
}

export type AppState = {
  currentModel: string;
  originalImage: string | null;
  resultImage: string | null;
  isProcessing: boolean;
  progress: number;
  error: string | null;
  isReadyToProcess: boolean;
  processedModel: string | null;
  currentPage: 'main' | 'models';
  isDarkMode: boolean;
  processingTrigger: number;
  cachedModelUrl: string | null;
  isModelLoading: boolean;
  // 全局模型状态
  modelStatuses: Record<string, ModelStatus>;
  isModelStatusesLoaded: boolean;
  // 全局下载进度状态（跨页面保持）
  modelDownloadProgresses: Record<string, DownloadProgressInfo | null>;

  setCurrentModel: (model: string) => Promise<void>;
  setCurrentPage: (page: 'main' | 'models') => void;
  setOriginalImage: (image: string | null) => void;
  setResultImage: (image: string | null) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  setIsReadyToProcess: (isReady: boolean) => void;
  setProcessedModel: (model: string | null) => void;
  setIsDarkMode: (isDark: boolean) => void;
  startProcessing: () => void;
  reset: () => void;
  // 全局模型状态管理
  initializeModelStatuses: () => Promise<void>;
  updateModelStatus: (modelId: string, status: ModelStatus) => void;
  // 全局下载进度管理
  setModelDownloadProgress: (modelId: string, progress: DownloadProgressInfo | null) => void;
  // 共享的模型下载方法
  downloadModelWithProgress: (modelId: string) => Promise<void>;
  // 取消模型下载
  cancelModelDownload: (modelId: string) => void;
};

export type UseRemoveBackgroundOptions = {
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onSuccess?: (result: string) => void;
};

export type UseRemoveBackgroundReturn = {
  processImage: (imageDataUrl: string, modelId: string, preloadedModelUrl?: string | null) => Promise<void>;
};


