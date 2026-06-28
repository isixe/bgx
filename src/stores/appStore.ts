import { create } from 'zustand';
import type { AppState, ModelStatus, BatchItem, BatchItemStatus } from '../types/app';
import { getCachedModelBlobUrl, revokeCachedUrl, downloadModel, cancelDownload, isModelCached, getAllCachedModels } from '../utils/modelCache';
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
  currentPage: 'main' as 'main' | 'models' | 'settings',
  settingsTab: 'models' as 'models' | 'about' | 'relatedTools',
  isDarkMode: getInitialDarkMode(),
  processingTrigger: 0,
  cachedModelUrl: null as string | null,
  isModelLoading: false,
  // 全局模型状态
  modelStatuses: {} as Record<string, ModelStatus>,
  isModelStatusesLoaded: false,
  // 全局下载进度状态（跨页面保持）
  modelDownloadProgresses: {} as Record<string, { loaded: number; total: number; percentage: number } | null>,
  batchMode: false,
  batchQueue: [] as BatchItem[],
  activeBatchItemId: null as string | null,
  viewingBatchResult: false,
    selectedBatchItemIds: [] as string[],
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

  // 设置模型下载进度
  setModelDownloadProgress: (modelId: string, progress: { loaded: number; total: number; percentage: number } | null) => {
    set((state) => ({
      modelDownloadProgresses: { ...state.modelDownloadProgresses, [modelId]: progress },
    }));
  },

  // 共享的模型下载方法
  downloadModelWithProgress: async (modelId: string) => {
    const state = get();

    // 如果已经在下载中，不重复下载
    if (state.modelStatuses[modelId] === 'downloading') {
      return;
    }

    get().updateModelStatus(modelId, 'downloading');
    get().setModelDownloadProgress(modelId, { loaded: 0, total: 0, percentage: 0 });

    try {
      await downloadModel(modelId, (progress) => {
        get().setModelDownloadProgress(modelId, progress);
      });

      get().updateModelStatus(modelId, 'downloaded');
      get().setModelDownloadProgress(modelId, null);
    } catch (error) {
      // 檢查是否是用戶取消
      if (
        error instanceof Error &&
        (error.message === 'Download cancelled' || error.name === 'AbortError')
      ) {
        console.log(`Model ${modelId} download cancelled by user`);
        get().updateModelStatus(modelId, 'not_downloaded');
        get().setModelDownloadProgress(modelId, null);
        return;
      }
      console.error(`Failed to download model ${modelId}:`, error);
      get().updateModelStatus(modelId, 'error');
      get().setModelDownloadProgress(modelId, null);
      throw error;
    }
  },

  // 取消模型下載
  cancelModelDownload: (modelId: string) => {
    cancelDownload(modelId);
    get().updateModelStatus(modelId, 'not_downloaded');
    get().setModelDownloadProgress(modelId, null);
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
        set({ isModelLoading: false });
        
        // 使用共享的下载方法
        await get().downloadModelWithProgress(model);

        // 下载完成，加载到内存
        const cachedUrl = await getCachedModelBlobUrl(model);
        set({
          cachedModelUrl: cachedUrl,
        });
      }
    } catch (error) {
      console.error('Failed to load/download model:', error);
      set({
        isModelLoading: false,
        error: 'model_download_failed',
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
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  setIsDarkMode: (isDark) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-dark-mode', String(isDark));
    }
    set({ isDarkMode: isDark });
  },
  startProcessing: () => set((state) => ({ isReadyToProcess: true, processingTrigger: state.processingTrigger + 1 })),

  setBatchMode: (mode) => set({ batchMode: mode }),

  addToBatchQueue: async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    const id = crypto.randomUUID();
    const item: BatchItem = {
      id,
      originalImage: dataUrl,
      resultImage: null,
      status: 'pending',
      modelId: get().currentModel,
      name: file.name,
    };

    set((state) => ({
      batchQueue: [...state.batchQueue, item],
    }));

    // 自动触发处理
    get().updateBatchItemStatus(id, 'pending');
  },

  selectBatchItem: (id: string) => {
    set({
      activeBatchItemId: id,
      viewingBatchResult: true,
      selectedBatchItemIds: [],
    });
  },

  backToBatchQueue: () => {
    set({
      activeBatchItemId: null,
      viewingBatchResult: false,
      selectedBatchItemIds: [],
    });
  },

  selectBatchQueueItem: (id: string) => {
    set((state) => ({
      selectedBatchItemIds: state.selectedBatchItemIds.includes(id)
        ? state.selectedBatchItemIds.filter((i) => i !== id)
        : [...state.selectedBatchItemIds, id],
    }));
  },

  selectAllBatchItems: (selectAll: boolean) => {
    set((state) => ({
      selectedBatchItemIds: selectAll
        ? state.batchQueue.filter((item) => item.status !== 'processing').map((item) => item.id)
        : [],
    }));
  },

  removeBatchItem: (id: string) => {
    set((state) => ({
      batchQueue: state.batchQueue.filter((item) => item.id !== id),
    }));
  },

  clearBatchQueue: () => {
    set({
      batchQueue: [],
      activeBatchItemId: null,
      viewingBatchResult: false,
      selectedBatchItemIds: [],
    });
  },

  reprocessBatchItem: (id: string, modelId: string) => {
    set((state) => ({
      batchQueue: state.batchQueue.map((item) =>
        item.id === id
          ? { ...item, status: 'pending' as BatchItemStatus, modelId, resultImage: null, error: null }
          : item
      ),
    }));
  },

  updateBatchItemStatus: (id: string, status: BatchItemStatus, resultImage?: string | null, error?: string | null) => {
    set((state) => ({
      batchQueue: state.batchQueue.map((item) =>
        item.id === id
          ? { ...item, status, ...(resultImage !== undefined ? { resultImage } : {}), ...(error !== undefined ? { error } : {}) }
          : item
      ),
    }));
  },

  reset: () => {
    const state = get();
    if (state.cachedModelUrl) {
      revokeCachedUrl(state.cachedModelUrl);
    }
    // 保留当前选中的模型和模型状态，只重置图片相关状态
    set({
      originalImage: null,
      resultImage: null,
      isProcessing: false,
      progress: 0,
      error: null,
      isReadyToProcess: false,
      processedModel: null,
      cachedModelUrl: null,
      isModelLoading: false,
    });
    // 重新加载当前模型
    get().setCurrentModel(state.currentModel);
  },
}));
