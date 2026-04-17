import type { TranslationKey } from './i18n/translations';

export type ModelId = 'u2netp' | 'u2net' | 'isnet-anime';

export interface ModelConfig {
  id: ModelId;
  name: string;
  resolution: number;
  size: string;
  description: string;
  filename: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
}

export const MODELS: ModelConfig[] = [
  {
    id: 'u2netp',
    name: 'U²Netp',
    resolution: 320,
    size: '~4MB',
    description: '轻量级模型，速度快，适合大多数场景',
    filename: 'u2netp.onnx',
    nameKey: 'modelU2netpName',
    descKey: 'modelU2netpDesc',
  },
  {
    id: 'u2net',
    name: 'U²Net',
    resolution: 320,
    size: '~168MB',
    description: '高精度模型，质量更好但处理较慢',
    filename: 'u2net.onnx',
    nameKey: 'modelU2netName',
    descKey: 'modelU2netDesc',
  },
  {
    id: 'isnet-anime',
    name: 'ISNet Anime',
    resolution: 1024,
    size: '~168MB',
    description: '专为动漫/插画优化',
    filename: 'isnet-anime.onnx',
    nameKey: 'modelIsnetAnimeName',
    descKey: 'modelIsnetAnimeDesc',
  },
];

export function getModelPath(modelId: ModelId): string {
  const model = MODELS.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  return `/models/${model.filename}`;
}

export function getModelById(modelId: ModelId): ModelConfig {
  const model = MODELS.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  return model;
}

export function getLocalizedModel(
  modelId: ModelId,
  t: (key: TranslationKey) => string
): { name: string; description: string } {
  const model = getModelById(modelId);
  return {
    name: t(model.nameKey),
    description: t(model.descKey),
  };
}
