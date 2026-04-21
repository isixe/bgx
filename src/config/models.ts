import type { ModelConfig } from '../types/app';

const HF_HOST = 'https://huggingface.co';
const HF_MIRROR_HOST = '';

const hfUrl = (repo: string, path: string) => ({
  downloadUrl: `${HF_HOST}/${repo}/resolve/main/${path}?download=true`,
  feedbackUrl: ``
});

const REMBG_REPO = 'tomjackson2023/rembg';
const BRIA_RMBG_REPO = 'briaai/RMBG-1.4';

export const MODELS: ModelConfig[] = [
  {
    id: 'u2netp',
    name: 'U2Netp',
    resolution: 320,
    size: '~4MB',
    filename: 'u2netp.onnx',
    descKey: 'model.u2netp.desc',
    ...hfUrl(REMBG_REPO, 'u2netp.onnx'),
    feedbackUrl: "https://unpkg.com/@rmbg/model-u2netp@0.0.1/u2netp.onnx",
  },
  {
    id: 'u2net',
    name: 'U2Net',
    resolution: 320,
    size: '~168MB',
    filename: 'u2net.onnx',
    descKey: 'model.u2net.desc',
    ...hfUrl(REMBG_REPO, 'u2net.onnx')
  },
  {
    id: 'u2net_human_seg',
    name: 'U2Net Human Seg',
    resolution: 320,
    size: '~168MB',
    filename: 'u2net_human_seg.onnx',
    descKey: 'model.u2net_human_seg.desc',
    ...hfUrl(REMBG_REPO, 'u2net_human_seg.onnx')
  },
  {
    id: 'silueta',
    name: 'Silueta',
    resolution: 320,
    size: '~42MB',
    filename: 'silueta.onnx',
    descKey: 'model.silueta.desc',
    ...hfUrl(REMBG_REPO, 'silueta.onnx')
  },
  {
    id: 'isnet-general-use',
    name: 'ISNet General',
    resolution: 1024,
    size: '~170MB',
    filename: 'isnet-general-use.onnx',
    descKey: 'model.isnet-general-use.desc',
    ...hfUrl(REMBG_REPO, 'isnet-general-use.onnx')
  },
  {
    id: 'isnet-anime',
    name: 'ISNet Anime',
    resolution: 1024,
    size: '~168MB',
    filename: 'isnet-anime.onnx',
    descKey: 'model.isnet-anime.desc',
    ...hfUrl(REMBG_REPO, 'isnet-anime.onnx')
  },
  {
    id: 'bria-rmbg-quantized',
    name: 'BRIA RMBG (Quantized)',
    resolution: 1024,
    size: '~44MB',
    filename: 'model_quantized.onnx',
    descKey: 'model.bria-rmbg-quantized.desc',
    ...hfUrl(BRIA_RMBG_REPO, 'onnx/model_quantized.onnx')
  },
  {
    id: 'bria-rmbg-fp16',
    name: 'BRIA RMBG (FP16)',
    resolution: 1024,
    size: '~88MB',
    filename: 'model_fp16.onnx',
    descKey: 'model.bria-rmbg-fp16.desc',
    ...hfUrl(BRIA_RMBG_REPO, 'onnx/model_fp16.onnx')
  },
  {
    id: 'bria-rmbg',
    name: 'BRIA RMBG',
    resolution: 1024,
    size: '~176MB',
    filename: 'model.onnx',
    descKey: 'model.bria-rmbg.desc',
    ...hfUrl(BRIA_RMBG_REPO, 'onnx/model.onnx')
  },
];
