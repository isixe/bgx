import { create } from 'zustand';
import type { AppState } from '../types/app';

const initialState = {
  currentModel: 'u2netp' as const,
  originalImage: null,
  resultImage: null,
  isProcessing: false,
  progress: 0,
  error: null,
  abortFn: null as (() => void) | null,
  isReadyToProcess: false,
  processedModel: null as const,
  currentPage: 'main' as const,
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
  setCurrentPage: (page) => set({ currentPage: page }),
  startProcessing: () => set({ isReadyToProcess: true }),
  reset: () => set({ ...initialState }),
  cancelProcessing: () => {
    const { abortFn } = useAppStore.getState();
    if (abortFn) {
      abortFn();
    }
  },
}));
