import { create } from 'zustand';
import { clampBatchConcurrency, DEFAULT_BATCH_CONCURRENCY } from '../utils/concurrency';
import type {
  AppState,
  ModelStatus,
  BatchItem,
  BatchItemStatus,
  SettingsTab,
  UpdateCheckState,
  GpuFallbackReason,
  KeyboardMode,
  PreviewBackground,
  PreviewBackgroundPosition,
} from '../types/app';
import {
  getCachedModelBlobUrl,
  revokeObjectUrl,
  downloadModel,
  cancelDownload,
  isModelCached,
  getAllCachedModels,
  clearModelDataFromMemory,
} from '../utils/modelCache';
import { createRememberedImageUrl, persistImageBlob, releaseImageUrl } from '../utils/imageStore';
import { createThumbnailBlob } from '../utils/thumbnail';
import { MODELS } from '../config/models';

// 入队后的收尾工作：先把原始图字节落到 IndexedDB，再释放内存里的活 URL；
// 缩略图串行生成，队列列表只显示它，全分辨率图只在预览时按需取回。
async function prepareBatchItem(id: string, file: File, originalImage: string): Promise<void> {
  const persisted = await persistImageBlob(originalImage, file);
  if (persisted) {
    releaseImageUrl(originalImage);
  }

  const thumbnail = await createThumbnailBlob(file);
  if (!thumbnail) {
    return;
  }

  const store = useAppStore.getState();
  if (!store.batchQueue.some((item) => item.id === id)) {
    return;
  }
  store.setBatchItemThumbnail(id, createRememberedImageUrl(thumbnail));
}

// 读取持久化的用户偏好。仅在客户端挂载后调用，不能在模块初始化阶段读取，
// 否则 SSR（无 localStorage）与客户端首帧会不一致，导致 React 水合不匹配。
function readPersistedPreferences(): Partial<AppState> {
  if (typeof window === 'undefined') {
    return {};
  }

  const prefs: Partial<AppState> = {};

  const storedDark = localStorage.getItem('bgx-dark-mode');
  prefs.isDarkMode =
    storedDark !== null
      ? storedDark === 'true'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;

  const storedCheck = localStorage.getItem('bgx-check-updates');
  if (storedCheck !== null) {
    prefs.checkUpdatesOnStartup = storedCheck === 'true';
  }

  prefs.dismissedUpdateVersion = localStorage.getItem('bgx-dismissed-update');

  const storedGpu = localStorage.getItem('bgx-gpu-acceleration');
  if (storedGpu !== null) {
    prefs.gpuAcceleration = storedGpu === 'true';
  }

  const storedConcurrency = Number(localStorage.getItem('bgx-batch-concurrency'));
  if (Number.isInteger(storedConcurrency) && storedConcurrency >= 1) {
    prefs.batchConcurrency = clampBatchConcurrency(storedConcurrency);
  }

  const storedPreload = localStorage.getItem('bgx-preload-enabled');
  if (storedPreload !== null) {
    prefs.preloadEnabled = storedPreload === 'true';
  }

  const storedKeyboardMode = localStorage.getItem('bgx-keyboard-mode');
  if (storedKeyboardMode === 'arrows' || storedKeyboardMode === 'wasd') {
    prefs.keyboardMode = storedKeyboardMode;
  }

  const storedPreviewBackground = localStorage.getItem('bgx-preview-background');
  if (
    storedPreviewBackground === 'transparent' ||
    storedPreviewBackground === 'black' ||
    storedPreviewBackground === 'white' ||
    storedPreviewBackground === 'custom'
  ) {
    prefs.previewBackground = storedPreviewBackground;
  }

  const storedPreviewBackgroundColor = localStorage.getItem('bgx-preview-background-color');
  if (storedPreviewBackgroundColor && /^#[0-9a-f]{6}$/i.test(storedPreviewBackgroundColor)) {
    prefs.previewBackgroundColor = storedPreviewBackgroundColor;
  }

  const storedPreviewBackgroundPosition = localStorage.getItem('bgx-preview-background-position');
  if (
    storedPreviewBackgroundPosition === 'top' ||
    storedPreviewBackgroundPosition === 'bottom' ||
    storedPreviewBackgroundPosition === 'left' ||
    storedPreviewBackgroundPosition === 'right'
  ) {
    prefs.previewBackgroundPosition = storedPreviewBackgroundPosition;
  }

  const storedDefaultModel = localStorage.getItem('bgx-default-model');
  if (storedDefaultModel && MODELS.some((model) => model.id === storedDefaultModel)) {
    prefs.defaultModel = storedDefaultModel;
    prefs.currentModel = storedDefaultModel;
  }

  return prefs;
}

// SSR 与客户端首帧统一使用确定性的默认值，持久化偏好在挂载后由 hydrateFromStorage 应用。
const DEFAULT_MODEL_ID = MODELS[0].id;

const initialState = {
  currentModel: DEFAULT_MODEL_ID,
  defaultModel: DEFAULT_MODEL_ID,
  originalImage: null as string | null,
  resultImage: null as string | null,
  isProcessing: false,
  progress: 0,
  error: null as string | null,
  success: null as string | null,
  isReadyToProcess: false,
  processedModel: null as string | null,
  currentPage: 'main' as 'main' | 'models' | 'settings',
  settingsTab: 'models' as SettingsTab,
  isDarkMode: false,
  checkUpdatesOnStartup: true,
  updateCheckState: 'idle' as UpdateCheckState,
  latestVersion: null as string | null,
  dismissedUpdateVersion: null as string | null,
  processingTrigger: 0,
  cachedModelUrl: null as string | null,
  isModelLoading: false,
  // 全局模型状态
  modelStatuses: {} as Record<string, ModelStatus>,
  isModelStatusesLoaded: false,
  // 全局下载进度状态（跨页面保持）
  modelDownloadProgresses: {} as Record<
    string,
    { loaded: number; total: number; percentage: number } | null
  >,
  savingModels: [] as string[],
  batchMode: false,
  batchQueue: [] as BatchItem[],
  batchConcurrency: DEFAULT_BATCH_CONCURRENCY,
  activeBatchItemId: null as string | null,
  viewingBatchResult: false,
  selectedBatchItemIds: [] as string[],
  selectionAnchorId: null as string | null,
  gpuAcceleration: true,
  gpuFallbackActive: false,
  gpuFallbackReason: null as GpuFallbackReason | null,
  preloadEnabled: true,
  keyboardMode: 'arrows' as KeyboardMode,
  previewBackground: 'transparent' as PreviewBackground,
  previewBackgroundColor: '#808080',
  previewBackgroundPosition: 'left' as PreviewBackgroundPosition,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  // 客户端挂载后应用持久化偏好（水合阶段调用一次）
  hydrateFromStorage: () => {
    set(readPersistedPreferences());
  },

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
  setModelDownloadProgress: (
    modelId: string,
    progress: { loaded: number; total: number; percentage: number } | null,
  ) => {
    set((state) => ({
      modelDownloadProgresses: { ...state.modelDownloadProgresses, [modelId]: progress },
    }));
  },

  addSavingModel: (modelId: string) => {
    set((state) => ({
      savingModels: state.savingModels.includes(modelId)
        ? state.savingModels
        : [...state.savingModels, modelId],
    }));
  },

  removeSavingModel: (modelId: string) => {
    set((state) => ({
      savingModels: state.savingModels.filter((id) => id !== modelId),
    }));
  },

  downloadModelWithProgress: async (modelId: string): Promise<string> => {
    const state = get();

    if (state.modelStatuses[modelId] === 'downloading') {
      return '';
    }

    get().updateModelStatus(modelId, 'downloading');
    get().setModelDownloadProgress(modelId, { loaded: 0, total: 0, percentage: 0 });

    try {
      const result = await downloadModel(modelId, (progress) => {
        get().setModelDownloadProgress(modelId, progress);
      });

      get().updateModelStatus(modelId, 'downloaded');
      get().setModelDownloadProgress(modelId, null);

      get().addSavingModel(modelId);
      result.savePromise
        .then(() => {
          get().removeSavingModel(modelId);
          clearModelDataFromMemory(modelId);
        })
        .catch(() => {
          get().removeSavingModel(modelId);
          clearModelDataFromMemory(modelId);
        });

      return result.blobUrl;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'Download cancelled' || error.name === 'AbortError')
      ) {
        get().updateModelStatus(modelId, 'not_downloaded');
        get().setModelDownloadProgress(modelId, null);
        return '';
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

  setDefaultModel: (modelId) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-default-model', modelId);
    }
    set({ defaultModel: modelId });
  },

  setCurrentModel: async (model) => {
    set({
      currentModel: model,
      isModelLoading: true,
      cachedModelUrl: null,
    });

    try {
      const isCached = await isModelCached(model);

      if (isCached) {
        const cachedUrl = await getCachedModelBlobUrl(model);
        set({
          cachedModelUrl: cachedUrl,
          isModelLoading: false,
        });
        get().updateModelStatus(model, 'downloaded');
      } else {
        set({ isModelLoading: false });

        const blobUrl = await get().downloadModelWithProgress(model);
        if (blobUrl) {
          set({ cachedModelUrl: blobUrl });
        }
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

  setOriginalImage: (image) => {
    const previous = get().originalImage;
    if (previous && previous !== image) {
      revokeObjectUrl(previous);
    }
    set({ originalImage: image, isReadyToProcess: !!image, error: null });
  },
  setResultImage: (image) => {
    const previous = get().resultImage;
    if (previous && previous !== image) {
      revokeObjectUrl(previous);
    }
    set({ resultImage: image });
  },
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),
  setSuccess: (success) => set({ success }),
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
  setCheckUpdatesOnStartup: (enabled) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-check-updates', String(enabled));
    }
    set({ checkUpdatesOnStartup: enabled });
  },
  setGpuAcceleration: (enabled) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-gpu-acceleration', String(enabled));
    }
    set({
      gpuAcceleration: enabled,
      gpuFallbackActive: enabled ? false : get().gpuFallbackActive,
      gpuFallbackReason: enabled ? null : get().gpuFallbackReason,
    });
  },
  setGpuFallbackActive: (active) =>
    set({
      gpuFallbackActive: active,
      gpuFallbackReason: active ? get().gpuFallbackReason : null,
    }),
  applyGpuFallback: (reason = 'runtime') =>
    set({ gpuAcceleration: false, gpuFallbackActive: true, gpuFallbackReason: reason }),
  setPreloadEnabled: (enabled) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-preload-enabled', String(enabled));
    }
    set({ preloadEnabled: enabled });
  },
  setKeyboardMode: (mode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-keyboard-mode', mode);
    }
    set({ keyboardMode: mode });
  },
  setPreviewBackground: (mode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-preview-background', mode);
    }
    set({ previewBackground: mode });
  },
  setPreviewBackgroundColor: (color) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-preview-background-color', color);
    }
    set({ previewBackgroundColor: color });
  },
  setPreviewBackgroundPosition: (position) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-preview-background-position', position);
    }
    set({ previewBackgroundPosition: position });
  },
  setUpdateCheckState: (state) => set({ updateCheckState: state }),
  setLatestVersion: (version) => set({ latestVersion: version }),
  dismissUpdateNotice: () => {
    const version = get().latestVersion;
    if (!version) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-dismissed-update', version);
    }
    set({ dismissedUpdateVersion: version });
  },
  startProcessing: () =>
    set((state) => ({ isReadyToProcess: true, processingTrigger: state.processingTrigger + 1 })),

  setBatchMode: (mode) => set({ batchMode: mode }),
  setBatchConcurrency: (value) => {
    const next = clampBatchConcurrency(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-batch-concurrency', String(next));
    }
    set({ batchConcurrency: next });
  },

  addToBatchQueue: async (file: File) => {
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const originalImage = createRememberedImageUrl(file);
    const item: BatchItem = {
      id,
      originalImage,
      resultImage: null,
      thumbnailImage: null,
      status: 'pending',
      modelId: get().currentModel,
      name: file.name,
      progress: 0,
      startedAt: null,
      finishedAt: null,
    };

    set((state) => ({
      batchQueue: [...state.batchQueue, item],
    }));

    // 自动触发处理
    get().updateBatchItemStatus(id, 'pending');

    void prepareBatchItem(id, file, originalImage);
  },

  selectBatchItem: (id: string) => {
    set({
      activeBatchItemId: id,
      viewingBatchResult: true,
      selectedBatchItemIds: [],
      selectionAnchorId: null,
    });
  },

  backToBatchQueue: () => {
    set({
      activeBatchItemId: null,
      viewingBatchResult: false,
      selectedBatchItemIds: [],
      selectionAnchorId: null,
    });
  },

  selectBatchQueueItem: (id: string, shiftKey = false) => {
    set((state) => {
      const selectableIds = state.batchQueue
        .filter((item) => item.status === 'completed' || item.status === 'error')
        .map((item) => item.id);

      const targetIndex = selectableIds.indexOf(id);
      if (targetIndex < 0) {
        return state;
      }

      if (shiftKey) {
        const anchorIndex = state.selectionAnchorId
          ? selectableIds.indexOf(state.selectionAnchorId)
          : -1;
        const hasAnchor = anchorIndex >= 0;
        const startIndex = hasAnchor ? Math.min(anchorIndex, targetIndex) : 0;
        const endIndex = hasAnchor ? Math.max(anchorIndex, targetIndex) : targetIndex;
        const rangeIds = selectableIds.slice(startIndex, endIndex + 1);

        return {
          selectedBatchItemIds: Array.from(new Set([...state.selectedBatchItemIds, ...rangeIds])),
          selectionAnchorId: id,
        };
      }

      return {
        selectedBatchItemIds: state.selectedBatchItemIds.includes(id)
          ? state.selectedBatchItemIds.filter((selectedId) => selectedId !== id)
          : [...state.selectedBatchItemIds, id],
        selectionAnchorId: id,
      };
    });
  },

  selectAllBatchItems: (selectAll: boolean) => {
    set((state) => {
      if (!selectAll) {
        return { selectedBatchItemIds: [], selectionAnchorId: null };
      }

      const selectableIds = state.batchQueue
        .filter((item) => item.status === 'completed' || item.status === 'error')
        .map((item) => item.id);

      return {
        selectedBatchItemIds: selectableIds,
        selectionAnchorId:
          selectableIds.length > 0 ? selectableIds[selectableIds.length - 1] : null,
      };
    });
  },

  setBatchItemProgress: (id: string, progress: number) => {
    const next = Math.max(0, Math.min(100, Math.round(progress)));
    const item = get().batchQueue.find((candidate) => candidate.id === id);
    if (!item || item.status !== 'processing' || item.progress === next) {
      return;
    }

    set((state) => ({
      batchQueue: state.batchQueue.map((candidate) =>
        candidate.id === id ? { ...candidate, progress: next } : candidate,
      ),
    }));
  },

  setBatchItemThumbnail: (id: string, thumbnailImage: string) => {
    set((state) => ({
      batchQueue: state.batchQueue.map((candidate) =>
        candidate.id === id && !candidate.thumbnailImage
          ? { ...candidate, thumbnailImage }
          : candidate,
      ),
    }));
  },

  removeBatchItem: (id: string) => {
    const item = get().batchQueue.find((candidate) => candidate.id === id);
    if (item) {
      revokeObjectUrl(item.originalImage);
      revokeObjectUrl(item.resultImage);
      revokeObjectUrl(item.thumbnailImage);
    }

    set((state) => ({
      batchQueue: state.batchQueue.filter((candidate) => candidate.id !== id),
      selectionAnchorId: state.selectionAnchorId === id ? null : state.selectionAnchorId,
    }));
  },

  clearBatchQueue: () => {
    for (const item of get().batchQueue) {
      revokeObjectUrl(item.originalImage);
      revokeObjectUrl(item.resultImage);
      revokeObjectUrl(item.thumbnailImage);
    }

    set({
      batchQueue: [],
      activeBatchItemId: null,
      viewingBatchResult: false,
      selectedBatchItemIds: [],
      selectionAnchorId: null,
    });
  },

  reprocessBatchItem: (id: string, modelId: string) => {
    const previous = get().batchQueue.find((item) => item.id === id);
    if (previous?.resultImage) {
      revokeObjectUrl(previous.resultImage);
    }

    set((state) => {
      const target = state.batchQueue.find((item) => item.id === id);
      if (!target) {
        return state;
      }

      const requeued: BatchItem = {
        ...target,
        status: 'pending' as BatchItemStatus,
        modelId,
        resultImage: null,
        error: null,
        progress: 0,
        startedAt: null,
        finishedAt: null,
      };

      const remaining = state.batchQueue.filter((item) => item.id !== id);
      let insertAt = 0;
      remaining.forEach((item, index) => {
        if (item.status === 'processing') {
          insertAt = index + 1;
        }
      });

      return {
        batchQueue: [...remaining.slice(0, insertAt), requeued, ...remaining.slice(insertAt)],
        selectedBatchItemIds: state.selectedBatchItemIds.filter((selectedId) => selectedId !== id),
        selectionAnchorId: state.selectionAnchorId === id ? null : state.selectionAnchorId,
      };
    });
  },

  updateBatchItemStatus: (
    id: string,
    status: BatchItemStatus,
    resultImage?: string | null,
    error?: string | null,
  ) => {
    const previous = get().batchQueue.find((item) => item.id === id);
    if (
      resultImage !== undefined &&
      previous?.resultImage &&
      previous.resultImage !== resultImage
    ) {
      revokeObjectUrl(previous.resultImage);
    }

    const now = Date.now();
    const isFinished = status === 'completed' || status === 'error';

    set((state) => ({
      batchQueue: state.batchQueue.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const next: BatchItem = {
          ...item,
          status,
          ...(resultImage !== undefined ? { resultImage } : {}),
          ...(error !== undefined ? { error } : {}),
        };

        if (status === 'processing') {
          next.startedAt = now;
          next.finishedAt = null;
        } else if (isFinished) {
          next.finishedAt = now;
          next.progress = 100;
        } else {
          next.startedAt = null;
          next.finishedAt = null;
          next.progress = 0;
        }

        return next;
      }),
      selectedBatchItemIds: isFinished
        ? state.selectedBatchItemIds
        : state.selectedBatchItemIds.filter((selectedId) => selectedId !== id),
      selectionAnchorId:
        !isFinished && state.selectionAnchorId === id ? null : state.selectionAnchorId,
    }));
  },

  reset: () => {
    const state = get();
    revokeObjectUrl(state.originalImage);
    revokeObjectUrl(state.resultImage);
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
