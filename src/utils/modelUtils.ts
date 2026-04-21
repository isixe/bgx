import type { TranslationKey } from '../lib/i18n';
import type { ModelConfig } from '../types/app';
import { MODELS } from '../config/models';

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
  return model.downloadUrl;
}
