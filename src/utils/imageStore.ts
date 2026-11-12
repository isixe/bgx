// blob: URL 只在该文档内有效，浏览器在内存压力或长时间挂起后会丢弃其底层数据，
// 再次访问就得到 net::ERR_FILE_NOT_FOUND。这里把图片字节放到 IndexedDB（磁盘）里，
// 内存只留最近几张做 LRU，避免队列里图片很多时把堆撑爆。

const DB_NAME = 'bgx-image-store';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FORGET_DELAY_MS = 30 * 1000;
const MAX_MEMORY_BYTES = 64 * 1024 * 1024;
const MAX_MEMORY_ENTRIES = 6;

// 上传拿到的 File 只是磁盘上的句柄：用户在资源管理器里删掉源文件后，
// 这个句柄、由它派生出的 blob: URL、以及写进 IndexedDB 的记录都读不出字节。
// 所以拿到文件的第一时间就把字节复制成真正的 Blob，之后全靠这份副本。
export const SOURCE_FILE_MISSING = 'source_file_missing';

export class SourceFileMissingError extends Error {
  constructor() {
    super(SOURCE_FILE_MISSING);
    this.name = 'SourceFileMissingError';
  }
}

export async function snapshotImageBlob(source: Blob): Promise<Blob> {
  if (typeof File === 'undefined' || !(source instanceof File)) {
    return source;
  }

  try {
    const buffer = await source.arrayBuffer();
    return new Blob([buffer], { type: source.type || 'application/octet-stream' });
  } catch {
    throw new SourceFileMissingError();
  }
}

// 内存/IndexedDB 里可能躺着早期写入的 File 句柄，读不出来就当作没命中，继续往下找。
async function materializeBlob(blob: Blob): Promise<Blob | null> {
  if (typeof File === 'undefined' || !(blob instanceof File)) {
    return blob;
  }

  try {
    return await snapshotImageBlob(blob);
  } catch {
    return null;
  }
}

interface StoredImage {
  url: string;
  blob: Blob;
  createdAt: number;
}

const memoryBlobs = new Map<string, Blob>();
let memoryBytes = 0;
// 重建出来的新 URL 指回原始 URL，避免连续失效后找不到同一份字节。
const urlOrigins = new Map<string, string>();
const healedUrls = new Map<string, string>();
const pendingForget = new Map<string, ReturnType<typeof setTimeout>>();

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

async function runTransaction(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => void,
): Promise<boolean> {
  const db = await openDB();
  if (!db) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, mode);
      work(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function readBlobFromDB(url: string): Promise<Blob | null> {
  const db = await openDB();
  if (!db) return null;

  return new Promise<Blob | null>((resolve) => {
    try {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(url);
      request.onsuccess = () => {
        const record = request.result as StoredImage | undefined;
        resolve(record?.blob ?? null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeBlobToDB(url: string, blob: Blob): Promise<boolean> {
  const record: StoredImage = { url, blob, createdAt: Date.now() };
  if (await runTransaction('readwrite', (store) => store.put(record))) {
    return true;
  }

  // 配额写满时先丢掉最旧的四分之一再试，失败就只靠内存层。
  await pruneOldestRecords(0.25);
  return runTransaction('readwrite', (store) => store.put(record));
}

// 同一个 key 的落盘只做一次：调用方可能同时需要「异步确认写入成功」和「后台落盘」，
// 重复 put 会把几十 MB 的字节写两遍。
const pendingWrites = new Map<string, Promise<boolean>>();

function persistBlobToDB(url: string, blob: Blob): Promise<boolean> {
  const inFlight = pendingWrites.get(url);
  if (inFlight) {
    return inFlight;
  }

  const task = writeBlobToDB(url, blob);
  pendingWrites.set(url, task);
  task.then(
    () => {
      if (pendingWrites.get(url) === task) {
        pendingWrites.delete(url);
      }
    },
    () => {
      if (pendingWrites.get(url) === task) {
        pendingWrites.delete(url);
      }
    },
  );
  return task;
}

function resolveKey(url: string): string {
  return urlOrigins.get(url) ?? url;
}

function rememberInMemory(key: string, blob: Blob): void {
  const previous = memoryBlobs.get(key);
  if (previous) {
    memoryBytes -= previous.size;
    memoryBlobs.delete(key);
  }

  memoryBlobs.set(key, blob);
  memoryBytes += blob.size;

  for (const [oldKey, oldBlob] of memoryBlobs) {
    if (memoryBlobs.size <= MAX_MEMORY_ENTRIES && memoryBytes <= MAX_MEMORY_BYTES) {
      break;
    }
    if (oldKey === key) {
      continue;
    }
    memoryBlobs.delete(oldKey);
    memoryBytes -= oldBlob.size;
  }
}

function takeFromMemory(key: string): Blob | null {
  const blob = memoryBlobs.get(key);
  if (!blob) {
    return null;
  }
  memoryBlobs.delete(key);
  memoryBlobs.set(key, blob);
  return blob;
}

export function rememberImageBlob(url: string, blob: Blob): void {
  const pending = pendingForget.get(url);
  if (pending) {
    clearTimeout(pending);
    pendingForget.delete(url);
  }

  rememberInMemory(url, blob);
  void persistBlobToDB(url, blob);
}

export function createRememberedImageUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  rememberImageBlob(url, blob);
  return url;
}

// 等待字节真正写进 IndexedDB 后再返回结果，调用方才有依据决定能否撤销活 URL。
export function persistImageBlob(url: string, blob: Blob): Promise<boolean> {
  rememberImageBlob(url, blob);
  return persistBlobToDB(url, blob);
}

// 只释放内存里的活 URL 与 JS 句柄，IndexedDB 里的字节保留：
// 之后 preview / 处理流程仍能用同一个 key 把图片重新取回来。
// 注意与 revokeObjectUrl 的区别：那个会连 IndexedDB 记录一起删掉。
export function releaseImageUrl(url: string | null | undefined): void {
  if (!url || !url.startsWith('blob:')) {
    return;
  }

  const key = resolveKey(url);

  const pending = pendingForget.get(key);
  if (pending) {
    clearTimeout(pending);
    pendingForget.delete(key);
  }

  URL.revokeObjectURL(url);

  const healed = healedUrls.get(key);
  if (healed && healed !== url) {
    URL.revokeObjectURL(healed);
  }
  healedUrls.delete(key);

  const blob = memoryBlobs.get(key);
  if (blob) {
    memoryBlobs.delete(key);
    memoryBytes -= blob.size;
  }

  urlOrigins.delete(url);
}

export async function getImageBlob(url: string): Promise<Blob> {
  const key = resolveKey(url);

  const cached = takeFromMemory(key);
  if (cached) {
    const materialized = await materializeBlob(cached);
    if (materialized) {
      return materialized;
    }
  }

  const stored = await readBlobFromDB(key);
  if (stored) {
    const materialized = await materializeBlob(stored);
    if (materialized) {
      rememberInMemory(key, materialized);
      return materialized;
    }
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new SourceFileMissingError();
    }

    const blob = await response.blob();
    rememberImageBlob(key, blob);
    return blob;
  } catch {
    throw new SourceFileMissingError();
  }
}

export async function renewImageUrl(url: string): Promise<string | null> {
  try {
    const blob = await getImageBlob(url);
    const origin = resolveKey(url);
    const previous = healedUrls.get(origin);
    if (previous) {
      URL.revokeObjectURL(previous);
    }

    const nextUrl = URL.createObjectURL(blob);
    urlOrigins.set(nextUrl, origin);
    healedUrls.set(origin, nextUrl);
    return nextUrl;
  } catch {
    return null;
  }
}

// 撤销 URL 后可能还有在途读取，延迟删缓存，避免自己制造新的 ERR_FILE_NOT_FOUND。
export function forgetImageBlob(url: string | null | undefined): void {
  if (!url || !url.startsWith('blob:')) {
    return;
  }

  const key = resolveKey(url);
  const existing = pendingForget.get(key);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    pendingForget.delete(key);
    const blob = memoryBlobs.get(key);
    if (blob) {
      memoryBlobs.delete(key);
      memoryBytes -= blob.size;
    }
    const healed = healedUrls.get(key);
    if (healed) {
      URL.revokeObjectURL(healed);
      healedUrls.delete(key);
    }
    urlOrigins.delete(url);
    void runTransaction('readwrite', (store) => store.delete(key));
  }, FORGET_DELAY_MS);

  pendingForget.set(key, timer);
}

async function pruneOldestRecords(ratio: number): Promise<void> {
  const db = await openDB();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const records: { url: string; createdAt: number }[] = [];
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          records.sort((a, b) => a.createdAt - b.createdAt);
          const dropCount = Math.max(1, Math.ceil(records.length * ratio));
          records.slice(0, dropCount).forEach((record) => store.delete(record.url));
          return;
        }
        const record = cursor.value as StoredImage;
        records.push({ url: record.url, createdAt: record.createdAt });
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

// 彻底清空图片库：内存句柄、活 URL、待删除定时器与 IndexedDB 记录一并清掉。
// 只作用于本模块的 'images' store，绝不碰模型库（bgx-models-db）与 localStorage 里的设置。
export async function clearImageStore(): Promise<void> {
  for (const timer of pendingForget.values()) {
    clearTimeout(timer);
  }
  pendingForget.clear();

  for (const healed of healedUrls.values()) {
    URL.revokeObjectURL(healed);
  }
  healedUrls.clear();
  urlOrigins.clear();
  memoryBlobs.clear();
  memoryBytes = 0;

  await runTransaction('readwrite', (store) => store.clear());
}

export async function pruneImageStore(maxAgeMs = DEFAULT_MAX_AGE_MS): Promise<void> {
  const db = await openDB();
  if (!db) return;

  const deadline = Date.now() - maxAgeMs;

  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const record = cursor.value as StoredImage;
        if (record.createdAt < deadline) {
          cursor.delete();
        }
        cursor.continue();
      };
      request.onerror = () => resolve();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
