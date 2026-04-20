import type { TranslationKey } from '../lib/i18n';
import type { ModelConfig } from '../types/app';
import { MODELS } from '../config/models';

export function getModelPath(modelId: string): string {
  const model = MODELS.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  return `/models/${model.filename}`;
}

export function getModelById(modelId: string): ModelConfig {
  const model = MODELS.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  return model;
}

export function getLocalizedModel(
  modelId: string,
  t: (key: TranslationKey) => string
): { name: string; description: string } {
  const model = getModelById(modelId);
  return {
    name: model.name,
    description: t(model.descKey),
  };
}

export async function getModelUrl(modelId: string): Promise<string> {
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
