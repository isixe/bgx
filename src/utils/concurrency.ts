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

export function clampBatchConcurrency(value: number): number {
  return clamp(Math.round(value), 1, MAX_BATCH_CONCURRENCY);
}

// Divides the cores between workers so the total thread count stays near the core count.
export function getSessionThreads(concurrency: number): number {
  const parallel = Math.max(1, Math.round(concurrency));
  return clamp(Math.floor(getHardwareConcurrency() / parallel), 1, 4);
}

export function getBatchConcurrencyOptions(): number[] {
  const options: number[] = [];
  for (let value = 1; value <= MAX_BATCH_CONCURRENCY; value += 1) {
    options.push(value);
  }
  return options;
}
