import { getModelById } from './modelUtils';

const DB_NAME = 'bgx-models-db';
const DB_VERSION = 1;
const STORE_NAME = 'models';

// 内存缓存：用于在 savePromise 完成前临时保存模型数据
// 防止用户在模型写入 IndexedDB 期间点击模型导致重新下载
const inMemoryModelData = new Map<string, ArrayBuffer>();

// 同一模型在整个会话内复用同一个 URL，避免每张图都复制一份模型内存
const sharedModelBlobUrls = new Map<string, string>();

export type ModelCacheStatus = 'not_downloaded' | 'downloading' | 'downloaded' | 'error';

export interface DownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface ModelRecord {
  modelId: string;
  data: ArrayBuffer;
  size: number;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'modelId' });
      }
    };
  });
}

async function fetchWithFallback(
  model: { downloadUrl: string; feedbackUrl: string },
  signal?: AbortSignal,
): Promise<Response> {
  const errors: string[] = [];

  // 优先尝试 downloadUrl
  if (model.downloadUrl) {
    try {
      const response = await fetch(model.downloadUrl, {
        headers: { Accept: '*/*' },
        signal,
      });
      if (response.ok) return response;
      errors.push(`downloadUrl: HTTP ${response.status}`);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      errors.push(`downloadUrl: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    errors.push('downloadUrl: empty');
  }

  // 回退到 feedbackUrl
  if (!model.feedbackUrl) {
    errors.push('feedbackUrl: empty');
    throw new Error(`Failed to download model from all URLs: ${errors.join('; ')}`);
  }

  try {
    const response = await fetch(model.feedbackUrl, {
      headers: { Accept: '*/*' },
      signal,
    });
    if (response.ok) return response;
    errors.push(`feedbackUrl: HTTP ${response.status}`);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    errors.push(`feedbackUrl: ${err instanceof Error ? err.message : String(err)}`);
  }

  throw new Error(`Failed to download model from all URLs: ${errors.join('; ')}`);
}

export function cacheModelDataInMemory(modelId: string, data: ArrayBuffer): void {
  inMemoryModelData.set(modelId, data);
}

export function getModelDataFromMemory(modelId: string): ArrayBuffer | null {
  return inMemoryModelData.get(modelId) || null;
}

export function clearModelDataFromMemory(modelId: string): void {
  inMemoryModelData.delete(modelId);
}

function createSharedModelUrl(modelId: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  sharedModelBlobUrls.set(modelId, url);
  return url;
}

function releaseSharedModelUrl(modelId: string): void {
  const url = sharedModelBlobUrls.get(modelId);
  if (url) {
    URL.revokeObjectURL(url);
    sharedModelBlobUrls.delete(modelId);
  }
}

// 存儲正在進行的下載請求的 AbortController
const downloadControllers = new Map<string, AbortController>();

export function cancelDownload(modelId: string): void {
  const controller = downloadControllers.get(modelId);
  if (controller) {
    controller.abort();
    downloadControllers.delete(modelId);
  }
}

export function isDownloading(modelId: string): boolean {
  return downloadControllers.has(modelId);
}

async function persistModelToDB(modelId: string, data: ArrayBuffer, size: number): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  store.put({ modelId, data, size, timestamp: Date.now() });

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error('Transaction aborted'));
  });

  db.close();
}

export interface DownloadResult {
  blobUrl: string;
  savePromise: Promise<void>;
}

export async function downloadModel(
  modelId: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<DownloadResult> {
  cancelDownload(modelId);

  const controller = new AbortController();
  downloadControllers.set(modelId, controller);

  try {
    const model = getModelById(modelId);
    const response = await fetchWithFallback(model, controller.signal);

    const total = parseInt(response.headers.get('content-length') || '0', 10);
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      if (controller.signal.aborted) {
        throw new Error('Download cancelled');
      }

      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loaded += value.length;

      if (onProgress && total > 0) {
        onProgress({
          loaded,
          total,
          percentage: Math.round((loaded / total) * 100),
        });
      }
    }

    const allChunks = new Uint8Array(loaded);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    onProgress?.({ loaded, total: loaded, percentage: 100 });

    releaseSharedModelUrl(modelId);

    const blob = new Blob([allChunks], { type: 'application/octet-stream' });
    const blobUrl = createSharedModelUrl(modelId, blob);

    cacheModelDataInMemory(modelId, allChunks.buffer);
    const savePromise = persistModelToDB(modelId, allChunks.buffer, loaded);

    return { blobUrl, savePromise };
  } finally {
    downloadControllers.delete(modelId);
  }
}

export async function deleteModel(modelId: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  store.delete(modelId);

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error('Transaction aborted'));
  });

  db.close();

  inMemoryModelData.delete(modelId);
  releaseSharedModelUrl(modelId);
}

// 只读 key，避免把完整模型数据克隆到内存
export async function isModelCached(modelId: string): Promise<boolean> {
  if (inMemoryModelData.has(modelId) || sharedModelBlobUrls.has(modelId)) {
    return true;
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const key = await new Promise<IDBValidKey | undefined>((resolve, reject) => {
      const request = store.getKey(modelId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return key !== undefined;
  } catch {
    return false;
  }
}

// 返回共享 URL：同一个模型可同时喂给多个 worker，不产生额外内存副本
export async function getCachedModelBlobUrl(modelId: string): Promise<string | null> {
  const existing = sharedModelBlobUrls.get(modelId);
  if (existing) {
    return existing;
  }

  const memoryData = inMemoryModelData.get(modelId);
  if (memoryData) {
    return createSharedModelUrl(
      modelId,
      new Blob([memoryData], { type: 'application/octet-stream' }),
    );
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const record = await new Promise<ModelRecord | undefined>((resolve, reject) => {
      const request = store.get(modelId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();

    if (!record) {
      return null;
    }

    return createSharedModelUrl(
      modelId,
      new Blob([record.data], { type: 'application/octet-stream' }),
    );
  } catch (error) {
    console.error(`Failed to get cached model ${modelId}:`, error);
    return null;
  }
}

export async function getCachedModelData(modelId: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const record = await new Promise<ModelRecord | undefined>((resolve, reject) => {
      const request = store.get(modelId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();

    return record?.data || null;
  } catch (error) {
    console.error(`Failed to get cached model data ${modelId}:`, error);
    return null;
  }
}

// 只读 key 列表，避免 getAll() 加载全部模型数据
export async function getAllCachedModels(): Promise<string[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return keys.map((key) => String(key));
  } catch {
    return [];
  }
}

export async function clearAllModels(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  store.clear();

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error('Transaction aborted'));
  });

  db.close();

  for (const modelId of [...sharedModelBlobUrls.keys()]) {
    releaseSharedModelUrl(modelId);
  }
  inMemoryModelData.clear();
}

// 模型共享 URL 永不在这里释放：worker 可能正在使用它
export function revokeObjectUrl(url: string | null | undefined): void {
  if (!url || !url.startsWith('blob:')) return;
  for (const shared of sharedModelBlobUrls.values()) {
    if (shared === url) return;
  }
  URL.revokeObjectURL(url);
}

export function revokeCachedUrl(url: string): void {
  revokeObjectUrl(url);
}
