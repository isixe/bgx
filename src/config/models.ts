import type { ModelConfig } from '../types/app';

const HF_HOST = 'https://huggingface.co';
const ML_HOST = 'https://www.modelscope.cn/models';

const HF_REMBG = 'tomjackson2023/rembg';
const HF_BRIA_RMBG_1_4 = 'briaai/RMBG-1.4';

const ML_SHIERTIER_REMBG = "shiertier/rembg"
const ML_AI_MODEL_SCOPE_1_4 = "AI-ModelScope/RMBG-1.4"

export const MODELS: ModelConfig[] = [
  {
    id: 'u2netp',
    name: 'U2Netp',
    resolution: 320,
    size: '~4MB',
    filename: 'u2netp.onnx',
    descKey: 'model.u2netp.desc',
    downloadUrl: `${HF_HOST}/${HF_REMBG}/resolve/main/u2netp.onnx?download=true`,
    feedbackUrl: "https://unpkg.com/@rmbg/model-u2netp@0.0.1/u2netp.onnx",
  },
  {
    id: 'u2net',
    name: 'U2Net',
    resolution: 320,
    size: '~168MB',
    filename: 'u2net.onnx',
    descKey: 'model.u2net.desc',
    downloadUrl: `${HF_HOST}/${HF_REMBG}/resolve/main/u2net.onnx?download=true`,
    feedbackUrl: `${ML_HOST}/${ML_SHIERTIER_REMBG}/resolve/master/u2net.onnx`,
  },
  {
    id: 'u2net_human_seg',
    name: 'U2Net Human Seg',
    resolution: 320,
    size: '~168MB',
    filename: 'u2net_human_seg.onnx',
    descKey: 'model.u2net_human_seg.desc',
    downloadUrl: `${HF_HOST}/${HF_REMBG}/resolve/main/u2net_human_seg.onnx?download=true`,
    feedbackUrl: `${ML_HOST}/${ML_SHIERTIER_REMBG}/resolve/master/u2net_human_seg.onnx`,
  },
  {
    id: 'silueta',
    name: 'Silueta',
    resolution: 320,
    size: '~42MB',
    filename: 'silueta.onnx',
    descKey: 'model.silueta.desc',
    downloadUrl: `${HF_HOST}/${HF_REMBG}/resolve/main/silueta.onnx?download=true`,
    feedbackUrl: `${ML_HOST}/${ML_SHIERTIER_REMBG}/resolve/master/silueta.onnx`,
  },
  {
    id: 'isnet-general-use',
    name: 'ISNet General',
    resolution: 1024,
    size: '~170MB',
    filename: 'isnet-general-use.onnx',
    descKey: 'model.isnet-general-use.desc',
    downloadUrl: `${HF_HOST}/${HF_REMBG}/resolve/main/isnet-general-use.onnx?download=true`,
    feedbackUrl: `${ML_HOST}/${ML_SHIERTIER_REMBG}/resolve/master/isnet-general-use.onnx`,
  },
  {
    id: 'isnet-anime',
    name: 'ISNet Anime',
    resolution: 1024,
    size: '~168MB',
    filename: 'isnet-anime.onnx',
    descKey: 'model.isnet-anime.desc',
    downloadUrl: `${HF_HOST}/${HF_REMBG}/resolve/main/isnet-anime.onnx?download=true`,
    feedbackUrl: `${ML_HOST}/${ML_SHIERTIER_REMBG}/resolve/master/isnet-anime.onnx`,
  },
  {
    id: 'bria-rmbg-quantized',
    name: 'BRIA RMBG (Quantized)',
    resolution: 1024,
    size: '~44MB',
    filename: 'model_quantized.onnx',
    descKey: 'model.bria-rmbg-quantized.desc',
    downloadUrl: `${HF_HOST}/${HF_BRIA_RMBG_1_4}/resolve/main/onnx/model_quantized.onnx?download=true`,
    feedbackUrl: `${ML_HOST}/${ML_AI_MODEL_SCOPE_1_4}/resolve/master/onnx/model_quantized.onnx`,
  },
  {
    id: 'bria-rmbg-fp16',
    name: 'BRIA RMBG (FP16)',
    resolution: 1024,
    size: '~88MB',
    filename: 'model_fp16.onnx',
    descKey: 'model.bria-rmbg-fp16.desc',
    downloadUrl: `${HF_HOST}/${HF_BRIA_RMBG_1_4}/resolve/main/onnx/model_fp16.onnx?download=true`,
    feedbackUrl: `${ML_HOST}/${ML_AI_MODEL_SCOPE_1_4}/resolve/master/onnx/model_fp16.onnx`,
  },
  {
    id: 'bria-rmbg',
    name: 'BRIA RMBG',
    resolution: 1024,
    size: '~176MB',
    filename: 'model.onnx',
    descKey: 'model.bria-rmbg.desc',
    downloadUrl: `${HF_HOST}/${HF_BRIA_RMBG_1_4}/resolve/main/onnx/model.onnx?download=true`,
    feedbackUrl: `${ML_HOST}/${ML_AI_MODEL_SCOPE_1_4}/resolve/master/onnx/model.onnx`,
  }
];
