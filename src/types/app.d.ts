export type ModelConfig = {
  id: string;
  name: string;
  resolution: number;
  size: string;
  filename: string;
  descKey: TranslationKey;
};

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

  setCurrentModel: (model: string) => void;
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
};

export type UseRemoveBackgroundOptions = {
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onSuccess?: (result: string) => void;
};

export type UseRemoveBackgroundReturn = {
  processImage: (imageDataUrl: string, modelId: string) => Promise<void>;
};

type TranslationKey = string;
