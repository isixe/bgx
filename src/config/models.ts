import type { ModelConfig, ModelGroup, ModelGroupId } from '../types/app';

/** 系列内模型的定义，省略 group 字段（由系列键名推断） */
type SeriesModel = Omit<ModelConfig, 'group'>;

interface ModelSeries {
  nameKey: string;
  descKey: string;
  models: SeriesModel[];
}

const MODEL_SERIES: Record<ModelGroupId, ModelSeries> = {
  u2net: {
    nameKey: 'modelGroup.u2net',
    descKey: 'modelGroup.u2netDesc',
    models: [
      {
        id: 'u2netp',
        name: 'U2Netp',
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
        preprocess: 'imagenet',
      },
      {
        id: 'u2net',
        name: 'U2Net',
        resolution: 320,
        size: '~168MB',
        filename: 'u2net.onnx',
        descKey: 'model.u2net.desc',
        downloadUrl:
          'https://huggingface.co/tomjackson2023/rembg/resolve/main/u2net.onnx?download=true',
        feedbackUrl: ['https://www.modelscope.cn/models/shiertier/rembg/resolve/master/u2net.onnx'],
        preprocess: 'imagenet',
      },
      {
        id: 'u2net_human_seg',
        name: 'U2Net Human Seg',
        resolution: 320,
        size: '~168MB',
        filename: 'u2net_human_seg.onnx',
        descKey: 'model.u2net_human_seg.desc',
        downloadUrl:
          'https://huggingface.co/tomjackson2023/rembg/resolve/main/u2net_human_seg.onnx?download=true',
        feedbackUrl: [
          'https://www.modelscope.cn/models/shiertier/rembg/resolve/master/u2net_human_seg.onnx',
        ],
        preprocess: 'imagenet',
      },
      {
        id: 'silueta',
        name: 'Silueta',
        resolution: 320,
        size: '~42MB',
        filename: 'silueta.onnx',
        descKey: 'model.silueta.desc',
        downloadUrl:
          'https://huggingface.co/tomjackson2023/rembg/resolve/main/silueta.onnx?download=true',
        feedbackUrl: [
          'https://www.modelscope.cn/models/shiertier/rembg/resolve/master/silueta.onnx',
        ],
        preprocess: 'imagenet',
      },
    ],
  },
  isnet: {
    nameKey: 'modelGroup.isnet',
    descKey: 'modelGroup.isnetDesc',
    models: [
      {
        id: 'isnet-general-use',
        name: 'ISNet General',
        resolution: 1024,
        size: '~170MB',
        filename: 'isnet-general-use.onnx',
        descKey: 'model.isnet-general-use.desc',
        downloadUrl:
          'https://huggingface.co/tomjackson2023/rembg/resolve/main/isnet-general-use.onnx?download=true',
        feedbackUrl: [
          'https://www.modelscope.cn/models/shiertier/rembg/resolve/master/isnet-general-use.onnx',
        ],
        preprocess: 'isnet',
      },
      {
        id: 'isnet-anime',
        name: 'ISNet Anime',
        resolution: 1024,
        size: '~168MB',
        filename: 'isnet-anime.onnx',
        descKey: 'model.isnet-anime.desc',
        downloadUrl:
          'https://huggingface.co/tomjackson2023/rembg/resolve/main/isnet-anime.onnx?download=true',
        feedbackUrl: [
          'https://www.modelscope.cn/models/shiertier/rembg/resolve/master/isnet-anime.onnx',
        ],
        preprocess: 'isnet',
      },
    ],
  },
  bria: {
    nameKey: 'modelGroup.bria',
    descKey: 'modelGroup.briaDesc',
    models: [
      {
        id: 'bria-rmbg-quantized',
        name: 'BRIA RMBG (Quantized)',
        resolution: 1024,
        size: '~44MB',
        filename: 'model_quantized.onnx',
        descKey: 'model.bria-rmbg-quantized.desc',
        downloadUrl:
          'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx?download=true',
        feedbackUrl: [
          'https://www.modelscope.cn/models/AI-ModelScope/RMBG-1.4/resolve/master/onnx/model_quantized.onnx',
        ],
        preprocess: 'isnet',
      },
      {
        id: 'bria-rmbg-fp16',
        name: 'BRIA RMBG (FP16)',
        resolution: 1024,
        size: '~88MB',
        filename: 'model_fp16.onnx',
        descKey: 'model.bria-rmbg-fp16.desc',
        downloadUrl:
          'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_fp16.onnx?download=true',
        feedbackUrl: [
          'https://www.modelscope.cn/models/AI-ModelScope/RMBG-1.4/resolve/master/onnx/model_fp16.onnx',
        ],
        preprocess: 'isnet',
      },
      {
        id: 'bria-rmbg',
        name: 'BRIA RMBG',
        resolution: 1024,
        size: '~176MB',
        filename: 'model.onnx',
        descKey: 'model.bria-rmbg.desc',
        downloadUrl:
          'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx?download=true',
        feedbackUrl: [
          'https://www.modelscope.cn/models/AI-ModelScope/RMBG-1.4/resolve/master/onnx/model.onnx',
        ],
        preprocess: 'isnet',
      },
    ],
  },
  ben2: {
    nameKey: 'modelGroup.ben2',
    descKey: 'modelGroup.ben2Desc',
    models: [
      {
        id: 'ben2-fp16',
        name: 'BEN2 (FP16)',
        resolution: 1024,
        size: '~209MB',
        filename: 'model_fp16.onnx',
        descKey: 'model.ben2-fp16.desc',
        downloadUrl:
          'https://huggingface.co/onnx-community/BEN2-ONNX/resolve/main/onnx/model_fp16.onnx?download=true',
        feedbackUrl: [
          'https://www.modelscope.cn/models/onnx-community/BEN2-ONNX/resolve/master/onnx/model_fp16.onnx',
        ],
        preprocess: 'imagenet',
        postprocess: 'minmax',
      },
      {
        id: 'ben2-fp32',
        name: 'BEN2 (FP32)',
        resolution: 1024,
        size: '~403MB',
        filename: 'model.onnx',
        descKey: 'model.ben2-fp32.desc',
        downloadUrl:
          'https://huggingface.co/Pezhgorski/BEN2-FP32-ONNX/resolve/main/onnx/model.onnx?download=true',
        feedbackUrl: [
          'https://www.modelscope.cn/models/Rokaa111/BEN2-FP32-ONNX/resolve/master/onnx/model.onnx',
        ],
        preprocess: 'imagenet',
        postprocess: 'minmax',
      },
    ],
  },
  modnet: {
    nameKey: 'modelGroup.modnet',
    descKey: 'modelGroup.modnetDesc',
    models: [
      {
        id: 'modnet',
        name: 'MODNet',
        resolution: 512,
        size: '~25MB',
        filename: 'modnet.onnx',
        descKey: 'model.modnet.desc',
        downloadUrl:
          'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx?download=true',
        feedbackUrl: [
          'https://www.modelscope.cn/models/Xenova/modnet/resolve/master/onnx/model.onnx',
        ],
        preprocess: 'modnet',
      },
    ],
  },
};

const SERIES_KEYS = Object.keys(MODEL_SERIES) as ModelGroupId[];

export const MODEL_GROUPS: ModelGroup[] = SERIES_KEYS.map((id) => ({
  id,
  nameKey: MODEL_SERIES[id].nameKey,
  descKey: MODEL_SERIES[id].descKey,
}));

export const MODELS: ModelConfig[] = SERIES_KEYS.flatMap((id) =>
  MODEL_SERIES[id].models.map((model) => ({ ...model, group: id })),
);
