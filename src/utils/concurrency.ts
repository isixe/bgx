const FALLBACK_CORES = 4;

export function getHardwareConcurrency(): number {
  if (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number') {
    return Math.max(1, navigator.hardwareConcurrency);
  }
  return FALLBACK_CORES;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Floor of 1: on tiny machines reserving a UI core would otherwise yield zero workers.
// 实测（8 逻辑核、u2netp@320）: 4 worker 吞吐已饱和，6 worker 持平，8 worker 反而退化；
// 每多一个 worker 都要多建一份 session，因此上限固定为 4。
export const MAX_BATCH_CONCURRENCY = clamp(getHardwareConcurrency() - 1, 1, 4);

export const DEFAULT_BATCH_CONCURRENCY = clamp(
  getHardwareConcurrency() >= 8 ? 3 : getHardwareConcurrency() >= 4 ? 2 : 1,
  1,
  MAX_BATCH_CONCURRENCY,
);

// GPU 任务提交到同一条设备队列，实测多开 worker 只把单图延迟从 401ms 拉到 847/1566ms，
// 吞吐没有提升，因此 GPU 路径固定单 worker。
export const GPU_CONCURRENCY = 1;

export function clampBatchConcurrency(value: number): number {
  return clamp(Math.round(value), 1, MAX_BATCH_CONCURRENCY);
}

// One logical core stays free for the UI thread and the worker's JS glue (decode/encode).
export function getMaxSessionThreads(): number {
  return Math.max(1, getHardwareConcurrency() - 1);
}

// Divides the cores between workers so the total thread count stays near the core count.
// Keeps at least one thread per worker even when the batch width exceeds the core count.
export function getSessionThreads(concurrency: number): number {
  const parallel = Math.max(1, Math.round(concurrency));
  const available = getMaxSessionThreads();
  if (parallel <= 1) {
    return available;
  }
  return clamp(Math.floor(available / parallel), 1, available);
}

// Each WASM worker copies the whole model into its own heap, so a wide batch of
// large models exhausts renderer memory. Cap the batch width from a fixed budget
// instead of only core count. Measured with u2net (168MB): ~838MB per worker,
// which is ~4x the model bytes plus a ~160MB runtime baseline; that lands at two
// workers for large models inside the 2GB budget.
const WORKER_MEMORY_BUDGET_MB = 2048;
const WORKER_MODEL_MULTIPLIER = 4;
const WORKER_BASE_MB = 160;

export function getMaxWorkersForModelBytes(modelBytes: number): number {
  const modelMB = Math.max(0, modelBytes) / (1024 * 1024);
  const perWorkerMB = modelMB * WORKER_MODEL_MULTIPLIER + WORKER_BASE_MB;
  return clamp(Math.floor(WORKER_MEMORY_BUDGET_MB / perWorkerMB), 1, MAX_BATCH_CONCURRENCY);
}

export function getBatchConcurrencyOptions(): number[] {
  const options: number[] = [];
  for (let value = 1; value <= MAX_BATCH_CONCURRENCY; value += 1) {
    options.push(value);
  }
  return options;
}

export function getGpuConcurrencyOptions(): number[] {
  return [GPU_CONCURRENCY];
}
