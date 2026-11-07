import type { ModelConfig, ModelGroup } from '../types/app';
import { MODELS, MODEL_GROUPS } from '../config/models';

export interface ModelGroupWithModels {
  group: ModelGroup;
  models: ModelConfig[];
}

export function getModelGroups(): ModelGroupWithModels[] {
  return MODEL_GROUPS.map((group) => ({
    group,
    models: MODELS.filter((model) => model.group === group.id),
  })).filter((entry) => entry.models.length > 0);
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
  t: (key: string) => string,
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
