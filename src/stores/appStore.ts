import { create } from 'zustand';
import type { AppState, ModelStatus } from '../types/app';
import { getCachedModelBlobUrl, revokeCachedUrl, downloadModel, isModelCached, getAllCachedModels } from '../utils/modelCache';
import { MODELS } from '../config/models';

function getInitialDarkMode(): boolean {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('bgx-dark-mode');
    if (stored !== null) {
      return stored === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

const initialState = {
  currentModel: 'u2netp' as string,
  originalImage: null as string | null,
  resultImage: null as string | null,
  isProcessing: false,
  progress: 0,
  error: null as string | null,
  isReadyToProcess: false,
  processedModel: null as string | null,
  currentPage: 'main' as 'main' | 'models',
  isDarkMode: getInitialDarkMode(),
  processingTrigger: 0,
  cachedModelUrl: null as string | null,
  isModelLoading: false,
  modelDownloadProgress: 0,
  isModelDownloading: false,
  // 全局模型状态
  modelStatuses: {} as Record<string, ModelStatus>,
  isModelStatusesLoaded: false,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  // 初始化所有模型状态（应用启动时调用）
  initializeModelStatuses: async () => {
    try {
      const cachedModels = await getAllCachedModels();
      const statuses: Record<string, ModelStatus> = {};

      for (const model of MODELS) {
        statuses[model.id] = cachedModels.includes(model.id) ? 'downloaded' : 'not_downloaded';
      }

      set({ modelStatuses: statuses, isModelStatusesLoaded: true });
    } catch (error) {
      console.error('Failed to initialize model statuses:', error);
      // 初始化失败时，所有模型标记为未下载
      const statuses: Record<string, ModelStatus> = {};
      for (const model of MODELS) {
        statuses[model.id] = 'not_downloaded';
      }
      set({ modelStatuses: statuses, isModelStatusesLoaded: true });
    }
  },

  // 更新单个模型状态
  updateModelStatus: (modelId: string, status: ModelStatus) => {
    set((state) => ({
      modelStatuses: { ...state.modelStatuses, [modelId]: status },
    }));
  },

  setCurrentModel: async (model) => {
    const state = get();

    // 清理之前的缓存 URL
    if (state.cachedModelUrl) {
      revokeCachedUrl(state.cachedModelUrl);
    }

    set({
      currentModel: model,
      isModelLoading: true,
      cachedModelUrl: null,
      modelDownloadProgress: 0,
      isModelDownloading: false,
    });

    try {
      // 先检查模型是否已在 IndexedDB 中
      const isCached = await isModelCached(model);

      if (isCached) {
        // 已缓存，直接加载
        const cachedUrl = await getCachedModelBlobUrl(model);
        set({
          cachedModelUrl: cachedUrl,
          isModelLoading: false,
        });
        // 更新全局状态
        get().updateModelStatus(model, 'downloaded');
      } else {
        // 未缓存，需要下载
        set({ isModelDownloading: true, isModelLoading: false });
        get().updateModelStatus(model, 'downloading');

        await downloadModel(model, (progress) => {
          set({ modelDownloadProgress: progress.percentage });
        });

        // 下载完成，加载到内存
        const cachedUrl = await getCachedModelBlobUrl(model);
        set({
          cachedModelUrl: cachedUrl,
          isModelDownloading: false,
          modelDownloadProgress: 0,
        });
        // 更新全局状态为已下载
        get().updateModelStatus(model, 'downloaded');
      }
    } catch (error) {
      console.error('Failed to load/download model:', error);
      set({
        isModelLoading: false,
        isModelDownloading: false,
        modelDownloadProgress: 0,
      });
      // 更新全局状态为错误
      get().updateModelStatus(model, 'error');
    }
  },

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
  reset: () => {
    const state = get();
    if (state.cachedModelUrl) {
      revokeCachedUrl(state.cachedModelUrl);
    }
    set({ ...initialState });
  },
}));
