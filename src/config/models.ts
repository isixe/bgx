import type { ModelConfig } from '../types/app';

const HF_HOST = 'https://huggingface.co';
const HF_MIRROR_HOST = 'https://hf-mirror.com';

const hfUrl = (repo: string, path: string) => ({
  downloadUrl: `${HF_HOST}/${repo}/resolve/main/${path}?download=true`,
  feedbackUrl: `${HF_MIRROR_HOST}/${repo}/resolve/main/${path}?download=true`
});

const REMBG_REPO = 'tomjackson2023/rembg';
const BRIA_REPO = 'briaai/RMBG-2.0';

export const MODELS: ModelConfig[] = [
  {
    id: 'u2netp',
    name: 'U2Netp',
    resolution: 320,
    size: '~4MB',
    filename: 'u2netp.onnx',
    descKey: 'model.u2netp.desc',
    ...hfUrl(REMBG_REPO, 'u2netp.onnx')
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
    id: 'bria-rmbg-2.0-fp16',
    name: 'BRIA RMBG 2.0 (FP16)',
    resolution: 1024,
    size: '~514MB',
    filename: 'model_fp16.onnx',
    descKey: 'model.bria_rmbg_2_0_fp16.desc',
    ...hfUrl(BRIA_REPO, 'model_fp16.onnx')
  },
  {
    id: 'bria-rmbg-2.0-q4f16',
    name: 'BRIA RMBG 2.0 (Q4F16)',
    resolution: 1024,
    size: '~234MB',
    filename: 'model_q4f16.onnx',
    descKey: 'model.bria_rmbg_2_0_q4f16.desc',
    ...hfUrl(BRIA_REPO, 'model_q4f16.onnx')
  },
  {
    id: 'bria-rmbg-2.0-int8',
    name: 'BRIA RMBG 2.0 (INT8)',
    resolution: 1024,
    size: '~366MB',
    filename: 'model_int8.onnx',
    descKey: 'model.bria_rmbg_2_0_int8.desc',
    ...hfUrl(BRIA_REPO, 'model_int8.onnx')
  },
  {
    id: 'bria-rmbg-2.0',
    name: 'BRIA RMBG 2.0',
    resolution: 1024,
    size: '~1.02GB',
    filename: 'model.onnx',
    descKey: 'model.bria_rmbg_2_0.desc',
    ...hfUrl(BRIA_REPO, 'model.onnx')
  },
];
