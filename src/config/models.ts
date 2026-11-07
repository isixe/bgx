import type { ModelConfig, ModelGroup } from '../types/app';

const HF_HOST = 'https://huggingface.co';
const ML_HOST = 'https://www.modelscope.cn/models';

const HF_REMBG = 'tomjackson2023/rembg';
const HF_BRIA_RMBG_1_4 = 'briaai/RMBG-1.4';

const ML_SHIERTIER_REMBG = 'shiertier/rembg';
const ML_AI_MODEL_SCOPE_1_4 = 'AI-ModelScope/RMBG-1.4';

export const MODEL_GROUPS: ModelGroup[] = [
  { id: 'u2net', nameKey: 'modelGroup.u2net', descKey: 'modelGroup.u2netDesc' },
  { id: 'isnet', nameKey: 'modelGroup.isnet', descKey: 'modelGroup.isnetDesc' },
  { id: 'bria', nameKey: 'modelGroup.bria', descKey: 'modelGroup.briaDesc' },
];

const rembgHf = (filename: string) => `${HF_HOST}/${HF_REMBG}/resolve/main/${filename}?download=true`;
const rembgMl = (filename: string) => `${ML_HOST}/${ML_SHIERTIER_REMBG}/resolve/master/${filename}`;

const briaHf = (filename: string) => `${HF_HOST}/${HF_BRIA_RMBG_1_4}/resolve/main/onnx/${filename}?download=true`;
const briaMl = (filename: string) => `${ML_HOST}/${ML_AI_MODEL_SCOPE_1_4}/resolve/master/onnx/${filename}`;

export const MODELS: ModelConfig[] = [
  {
    id: 'u2netp',
    name: 'U2Netp',
    group: 'u2net',
    resolution: 320,
    size: '~4MB',
    filename: 'u2netp.onnx',
    descKey: 'model.u2netp.desc',
    downloadUrl: rembgHf('u2netp.onnx'),
    feedbackUrl: 'https://unpkg.com/@rmbg/model-u2netp@0.0.1/u2netp.onnx',
  },
  {
    id: 'u2net',
    name: 'U2Net',
    group: 'u2net',
    resolution: 320,
    size: '~168MB',
    filename: 'u2net.onnx',
    descKey: 'model.u2net.desc',
    downloadUrl: rembgHf('u2net.onnx'),
    feedbackUrl: rembgMl('u2net.onnx'),
  },
  {
    id: 'u2net_human_seg',
    name: 'U2Net Human Seg',
    group: 'u2net',
    resolution: 320,
    size: '~168MB',
    filename: 'u2net_human_seg.onnx',
    descKey: 'model.u2net_human_seg.desc',
    downloadUrl: rembgHf('u2net_human_seg.onnx'),
    feedbackUrl: rembgMl('u2net_human_seg.onnx'),
  },
  {
    id: 'silueta',
    name: 'Silueta',
    group: 'u2net',
    resolution: 320,
    size: '~42MB',
    filename: 'silueta.onnx',
    descKey: 'model.silueta.desc',
    downloadUrl: rembgHf('silueta.onnx'),
    feedbackUrl: rembgMl('silueta.onnx'),
  },
  {
    id: 'isnet-general-use',
    name: 'ISNet General',
    group: 'isnet',
    resolution: 1024,
    size: '~170MB',
    filename: 'isnet-general-use.onnx',
    descKey: 'model.isnet-general-use.desc',
    downloadUrl: rembgHf('isnet-general-use.onnx'),
    feedbackUrl: rembgMl('isnet-general-use.onnx'),
  },
  {
    id: 'isnet-anime',
    name: 'ISNet Anime',
    group: 'isnet',
    resolution: 1024,
    size: '~168MB',
    filename: 'isnet-anime.onnx',
    descKey: 'model.isnet-anime.desc',
    downloadUrl: rembgHf('isnet-anime.onnx'),
    feedbackUrl: rembgMl('isnet-anime.onnx'),
  },
  {
    id: 'bria-rmbg-quantized',
    name: 'BRIA RMBG (Quantized)',
    group: 'bria',
    resolution: 1024,
    size: '~44MB',
    filename: 'model_quantized.onnx',
    descKey: 'model.bria-rmbg-quantized.desc',
    downloadUrl: briaHf('model_quantized.onnx'),
    feedbackUrl: briaMl('model_quantized.onnx'),
  },
  {
    id: 'bria-rmbg-fp16',
    name: 'BRIA RMBG (FP16)',
    group: 'bria',
    resolution: 1024,
    size: '~88MB',
    filename: 'model_fp16.onnx',
    descKey: 'model.bria-rmbg-fp16.desc',
    downloadUrl: briaHf('model_fp16.onnx'),
    feedbackUrl: briaMl('model_fp16.onnx'),
  },
  {
    id: 'bria-rmbg',
    name: 'BRIA RMBG',
    group: 'bria',
    resolution: 1024,
    size: '~176MB',
    filename: 'model.onnx',
    descKey: 'model.bria-rmbg.desc',
    downloadUrl: briaHf('model.onnx'),
    feedbackUrl: briaMl('model.onnx'),
  },
];
