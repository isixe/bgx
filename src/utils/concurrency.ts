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

// Leaves one core for the UI thread; each extra worker holds another model session.
export const MAX_BATCH_CONCURRENCY = clamp(getHardwareConcurrency() - 1, 2, 4);

export const DEFAULT_BATCH_CONCURRENCY = clamp(
  getHardwareConcurrency() >= 8 ? 3 : getHardwareConcurrency() >= 4 ? 2 : 1,
  1,
  MAX_BATCH_CONCURRENCY,
);

export const DEFAULT_GPU_BATCH_CONCURRENCY = 2;

// GPU 并发由显存决定而非 CPU 核数，需独立上限，否则会被 CPU 侧的上限掩盖而失去意义。
export const MAX_GPU_CONCURRENCY = 8;

// 每个 GPU worker 各自持有一份模型权重与推理缓冲，按约 1GB 显存估算；
// 另预留 0.5GB 给系统与显示合成，用于反推用户显存可支撑的最大并发数。
const GPU_VRAM_PER_WORKER_GB = 1;
const GPU_VRAM_RESERVE_GB = 0.5;

export function clampBatchConcurrency(value: number): number {
  return clamp(Math.round(value), 1, MAX_BATCH_CONCURRENCY);
}

// Divides the cores between workers so the total thread count stays near the core count.
// Keeps at least one thread per worker even when the batch width exceeds the core count.
export function getSessionThreads(concurrency: number): number {
  const parallel = Math.max(1, Math.round(concurrency));
  const cores = getHardwareConcurrency();
  const shared = cores - 1;
  if (parallel <= 1) {
    return clamp(shared, 1, 4);
  }
  return clamp(Math.floor(shared / parallel), 1, 4);
}

// Each WASM worker copies the whole model into its own heap (roughly an order of
// magnitude above the model bytes once activations and the emscripten heap are
// counted), so a wide batch of large models exhausts renderer memory. Cap the
// batch width from a fixed budget instead of only core count.
const WORKER_MEMORY_BUDGET_MB = 2048;
const WORKER_MODEL_MULTIPLIER = 10;
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

export function getMaxGpuConcurrency(vramGb: number | null): number {
  // 未填写显存时没有换算依据，默认只开放到常规默认值，避免把最宽松的上限当成默认推荐。
  if (vramGb === null || !Number.isFinite(vramGb) || vramGb <= 0) {
    return DEFAULT_GPU_BATCH_CONCURRENCY;
  }
  const usable = vramGb - GPU_VRAM_RESERVE_GB;
  return clamp(Math.floor(usable / GPU_VRAM_PER_WORKER_GB), 1, MAX_GPU_CONCURRENCY);
}

export function clampGpuConcurrency(value: number, vramGb: number | null): number {
  return clamp(Math.round(value), 1, getMaxGpuConcurrency(vramGb));
}

export function getGpuConcurrencyOptions(vramGb: number | null): number[] {
  const options: number[] = [];
  for (let value = 1; value <= getMaxGpuConcurrency(vramGb); value += 1) {
    options.push(value);
  }
  return options;
}
