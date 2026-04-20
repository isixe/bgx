import { getModelPath, getModelById } from './modelUtils';

const DB_NAME = 'bgx-models-db';
const DB_VERSION = 1;
const STORE_NAME = 'models';

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

async function getModelUrl(modelId: string): Promise<string> {
	const model = getModelById(modelId);
	const localPath = `/models/${model.filename}`;

	try {
		const response = await fetch(localPath, { method: 'HEAD' });
		if (response.ok) {
			return localPath;
		}
	} catch {
	}

	return model.downloadUrl;
}

export async function downloadModel(
	modelId: string,
	onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
	const modelUrl = await getModelUrl(modelId);

	try {
		const response = await fetch(modelUrl, {
			headers: {
				Accept: '*/*',
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to download model: ${response.status} ${response.statusText}`);
		}

		const total = parseInt(response.headers.get('content-length') || '0', 10);
		const reader = response.body?.getReader();

		if (!reader) {
			throw new Error('Response body is not readable');
		}

		const chunks: Uint8Array[] = [];
		let loaded = 0;

		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

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

		const db = await openDB();
		const transaction = db.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		const record: ModelRecord = {
			modelId,
			data: allChunks.buffer,
			size: loaded,
			timestamp: Date.now(),
		};

		await new Promise<void>((resolve, reject) => {
			const request = store.put(record);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		db.close();

		if (onProgress) {
			onProgress({
				loaded,
				total: loaded,
				percentage: 100,
			});
		}
	} catch (error) {
		console.error(`Failed to download model ${modelId}:`, error);
		throw error;
	}
}

export async function deleteModel(modelId: string): Promise<void> {
	const db = await openDB();
	const transaction = db.transaction([STORE_NAME], 'readwrite');
	const store = transaction.objectStore(STORE_NAME);

	await new Promise<void>((resolve, reject) => {
		const request = store.delete(modelId);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});

	db.close();
}

export async function isModelCached(modelId: string): Promise<boolean> {
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
		return record !== undefined;
	} catch {
		return false;
	}
}

export async function getCachedModelBlobUrl(modelId: string): Promise<string | null> {
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

		const blob = new Blob([record.data], { type: 'application/octet-stream' });
		return URL.createObjectURL(blob);
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

export async function getAllCachedModels(): Promise<string[]> {
	try {
		const db = await openDB();
		const transaction = db.transaction([STORE_NAME], 'readonly');
		const store = transaction.objectStore(STORE_NAME);

		const records = await new Promise<ModelRecord[]>((resolve, reject) => {
			const request = store.getAll();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});

		db.close();
		return records.map((r) => r.modelId);
	} catch {
		return [];
	}
}

export async function clearAllModels(): Promise<void> {
	const db = await openDB();
	const transaction = db.transaction([STORE_NAME], 'readwrite');
	const store = transaction.objectStore(STORE_NAME);

	await new Promise<void>((resolve, reject) => {
		const request = store.clear();
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});

	db.close();
}

export function revokeCachedUrl(url: string): void {
	if (url.startsWith('blob:')) {
		URL.revokeObjectURL(url);
	}
}
