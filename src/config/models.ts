import type { ModelConfig, ModelGroup } from '../types/app';

export const MODEL_GROUPS: ModelGroup[] = [
  { id: 'u2net', nameKey: 'modelGroup.u2net', descKey: 'modelGroup.u2netDesc' },
  { id: 'isnet', nameKey: 'modelGroup.isnet', descKey: 'modelGroup.isnetDesc' },
  { id: 'bria', nameKey: 'modelGroup.bria', descKey: 'modelGroup.briaDesc' },
];

export const MODELS: ModelConfig[] = [
  {
    id: 'u2netp',
    name: 'U2Netp',
    group: 'u2net',
    resolution: 320,
    size: '~4MB',
    filename: 'u2netp.onnx',
    descKey: 'model.u2netp.desc',
    downloadUrl:
      'https://huggingface.co/tomjackson2023/rembg/resolve/main/u2netp.onnx?download=true',
    feedbackUrl: [
      'https://www.modelscope.cn/models/shiertier/rembg/resolve/master/u2netp.onnx',
      'https://unpkg.com/@rmbg/model-u2netp@0.0.1/u2netp.onnx',
    ],
  },
  {
    id: 'u2net',
    name: 'U2Net',
    group: 'u2net',
    resolution: 320,
    size: '~168MB',
    filename: 'u2net.onnx',
    descKey: 'model.u2net.desc',
    downloadUrl:
      'https://huggingface.co/tomjackson2023/rembg/resolve/main/u2net.onnx?download=true',
    feedbackUrl: ['https://www.modelscope.cn/models/shiertier/rembg/resolve/master/u2net.onnx'],
  },
  {
    id: 'u2net_human_seg',
    name: 'U2Net Human Seg',
    group: 'u2net',
    resolution: 320,
    size: '~168MB',
    filename: 'u2net_human_seg.onnx',
    descKey: 'model.u2net_human_seg.desc',
    downloadUrl:
      'https://huggingface.co/tomjackson2023/rembg/resolve/main/u2net_human_seg.onnx?download=true',
    feedbackUrl: [
      'https://www.modelscope.cn/models/shiertier/rembg/resolve/master/u2net_human_seg.onnx',
    ],
  },
  {
    id: 'silueta',
    name: 'Silueta',
    group: 'u2net',
    resolution: 320,
    size: '~42MB',
    filename: 'silueta.onnx',
    descKey: 'model.silueta.desc',
    downloadUrl:
      'https://huggingface.co/tomjackson2023/rembg/resolve/main/silueta.onnx?download=true',
    feedbackUrl: ['https://www.modelscope.cn/models/shiertier/rembg/resolve/master/silueta.onnx'],
  },
  {
    id: 'isnet-general-use',
    name: 'ISNet General',
    group: 'isnet',
    resolution: 1024,
    size: '~170MB',
    filename: 'isnet-general-use.onnx',
    descKey: 'model.isnet-general-use.desc',
    downloadUrl:
      'https://huggingface.co/tomjackson2023/rembg/resolve/main/isnet-general-use.onnx?download=true',
    feedbackUrl: [
      'https://www.modelscope.cn/models/shiertier/rembg/resolve/master/isnet-general-use.onnx',
    ],
  },
  {
    id: 'isnet-anime',
    name: 'ISNet Anime',
    group: 'isnet',
    resolution: 1024,
    size: '~168MB',
    filename: 'isnet-anime.onnx',
    descKey: 'model.isnet-anime.desc',
    downloadUrl:
      'https://huggingface.co/tomjackson2023/rembg/resolve/main/isnet-anime.onnx?download=true',
    feedbackUrl: [
      'https://www.modelscope.cn/models/shiertier/rembg/resolve/master/isnet-anime.onnx',
    ],
  },
  {
    id: 'bria-rmbg-quantized',
    name: 'BRIA RMBG (Quantized)',
    group: 'bria',
    resolution: 1024,
    size: '~44MB',
    filename: 'model_quantized.onnx',
    descKey: 'model.bria-rmbg-quantized.desc',
    downloadUrl:
      'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx?download=true',
    feedbackUrl: [
      'https://www.modelscope.cn/models/AI-ModelScope/RMBG-1.4/resolve/master/onnx/model_quantized.onnx',
    ],
  },
  {
    id: 'bria-rmbg-fp16',
    name: 'BRIA RMBG (FP16)',
    group: 'bria',
    resolution: 1024,
    size: '~88MB',
    filename: 'model_fp16.onnx',
    descKey: 'model.bria-rmbg-fp16.desc',
    downloadUrl:
      'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_fp16.onnx?download=true',
    feedbackUrl: [
      'https://www.modelscope.cn/models/AI-ModelScope/RMBG-1.4/resolve/master/onnx/model_fp16.onnx',
    ],
  },
  {
    id: 'bria-rmbg',
    name: 'BRIA RMBG',
    group: 'bria',
    resolution: 1024,
    size: '~176MB',
    filename: 'model.onnx',
    descKey: 'model.bria-rmbg.desc',
    downloadUrl:
      'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx?download=true',
    feedbackUrl: [
      'https://www.modelscope.cn/models/AI-ModelScope/RMBG-1.4/resolve/master/onnx/model.onnx',
    ],
  },
];
