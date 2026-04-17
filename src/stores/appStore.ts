import { create } from 'zustand';

export type ModelId = 'u2netp' | 'u2net' | 'isnet-anime';

export interface AppState {
  currentModel: ModelId;
  originalImage: string | null;
  resultImage: string | null;
  isProcessing: boolean;
  progress: number;
  error: string | null;
  abortFn: (() => void) | null;
  isReadyToProcess: boolean;
  processedModel: ModelId | null;

  setCurrentModel: (model: ModelId) => void;
  setOriginalImage: (image: string | null) => void;
  setResultImage: (image: string | null) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  setAbortFn: (abort: (() => void) | null) => void;
  setIsReadyToProcess: (isReady: boolean) => void;
  setProcessedModel: (model: ModelId | null) => void;
  startProcessing: () => void;
  reset: () => void;
  cancelProcessing: () => void;
}

const initialState = {
  currentModel: 'u2netp' as ModelId,
  originalImage: null,
  resultImage: null,
  isProcessing: false,
  progress: 0,
  error: null,
  abortFn: null as (() => void) | null,
  isReadyToProcess: false,
  processedModel: null as ModelId | null,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setCurrentModel: (model) => set({ currentModel: model }),
  setOriginalImage: (image) => set({ originalImage: image, isReadyToProcess: !!image, error: null }),
  setResultImage: (image) => set({ resultImage: image }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),
  setAbortFn: (abort) => set({ abortFn: abort }),
  setIsReadyToProcess: (isReady) => set({ isReadyToProcess: isReady }),
  setProcessedModel: (model) => set({ processedModel: model }),
  startProcessing: () => set({ isReadyToProcess: true }),
  reset: () => set({ ...initialState }),
  cancelProcessing: () => {
    const { abortFn } = useAppStore.getState();
    if (abortFn) {
      abortFn();
    }
  },
}));
