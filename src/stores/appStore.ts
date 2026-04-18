import { create } from 'zustand';
import type { AppState } from '../types/app';

function getInitialDarkMode(): boolean {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('bgx-dark-mode');
    if (stored !== null) {
      return stored === 'true';
    }
    // 如果没有存储设置，使用系统偏好
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

const initialState = {
  currentModel: 'u2netp' as const,
  originalImage: null,
  resultImage: null,
  isProcessing: false,
  progress: 0,
  error: null,
  isReadyToProcess: false,
  processedModel: null as const,
  currentPage: 'main' as const,
  isDarkMode: getInitialDarkMode(),
  processingTrigger: 0,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setCurrentModel: (model) => set({ currentModel: model }),
  setOriginalImage: (image) => set({ originalImage: image, isReadyToProcess: !!image, error: null }),
  setResultImage: (image) => set({ resultImage: image }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),
  setIsReadyToProcess: (isReady) => set({ isReadyToProcess: isReady }),
  setProcessedModel: (model) => set({ processedModel: model }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setIsDarkMode: (isDark) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-dark-mode', String(isDark));
    }
    set({ isDarkMode: isDark });
  },
  startProcessing: () => set((state) => ({ isReadyToProcess: true, processingTrigger: state.processingTrigger + 1 })),
  reset: () => set({ ...initialState }),
}));
