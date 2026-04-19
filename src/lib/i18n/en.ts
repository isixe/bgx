export const translations = {
  appName: 'BGX',
  appSubtitle: 'Background Remover',
  pageTitle: 'BGX - Background Remover',
  privacyBadge: 'Local Processing, Privacy Protected',

  heroBadge: 'Completely Free, No Registration',
  heroTitle: 'AI-Powered Background Removal',
  heroDescription: 'Use advanced AI models to automatically identify and remove image backgrounds. Supports portraits, products, e-commerce images, and more.',

  featuresTitle: 'Features',
  featurePrivacy: 'Privacy Protection',
  featurePrivacyDesc: 'All processing is done locally, images are never uploaded to servers',
  featureSpeed: 'Lightning Fast',
  featureSpeedDesc: 'Powered by WebAssembly and GPU acceleration for quick results',
  featureFormats: 'Multi-Format Support',
  featureFormatsDesc: 'Supports JPG, PNG, WebP, BMP, TIFF, and other common formats',
  featureExport: 'Flexible Export',
  featureExportDesc: 'Export in PNG, JPG, WebP formats',

  benefitsTitle: 'Batch Processing Supported',
  benefitsSubtitle: 'No software installation needed, just open your browser',
  benefitNoInstall: 'No Installation',
  benefitNoPayment: 'No Payment',
  benefitNoRegister: 'No Registration',
  benefitFree: 'Completely Free',

  useCasesTitle: 'Use Cases',
  useCaseCreative: 'Creative Design',
  useCaseCreativeDesc: 'Posters, Banners, Composites',
  useCaseBusiness: 'Business Office',
  useCaseBusinessDesc: 'PPT, Resumes, Brochures',
  useCasePhoto: 'Photo Editing',
  useCasePhotoDesc: 'Portrait retouching, Background replacement',

  uploaderTitle: 'Click or Drag to Upload',
  uploaderSubtitle: 'Supports JPG, PNG, WebP, up to 30MB',
  uploaderPaste: 'Or press Ctrl+V to paste image',
  modelLabel: 'Model:',
  uploaderDrop: 'Release to upload image',
  errorUnsupportedFormat: 'Unsupported image format. Please upload JPG, PNG, WebP, BMP, TIFF, SVG, AVIF, or HEIC.',
  errorFileTooLarge: 'Image size cannot exceed 30MB',
  errorReadFailed: 'Failed to read image',

  modelSelectorTitle: 'Select Model',
  modelOutputSize: 'Output Size',
  modelSwitchHint: 'Will automatically reprocess after switching',
  modelResolution: 'px',

  model: {
    u2netp: {
      desc: 'Lightweight model, fast speed, suitable for most scenarios',
    },
    u2net: {
      desc: 'High-precision model, better quality but slower processing',
    },
    u2net_human_seg: {
      desc: 'Specialized for human segmentation',
    },
    u2net_cloth_seg: {
      desc: 'Specialized for clothing segmentation',
    },
    silueta: {
      desc: 'Lightweight silhouette model',
    },
    'isnet-general-use': {
      desc: 'High-precision general purpose model',
    },
    'isnet-anime': {
      desc: 'Optimized for anime/illustrations',
    },
    large: {
      desc: 'imgly large model, highest quality',
    },
    medium: {
      desc: 'imgly medium model, balanced quality and speed',
    },
    small: {
      desc: 'imgly small model, speed prioritized',
    },
    PPModnet_MobileNetV2: {
      desc: 'PaddlePaddle lightweight portrait segmentation',
    },
  },

  processingTitle: 'Processing...',
  processingFirstTime: 'First use requires downloading model files, may take a few minutes',
  processingInProgress: 'Processing in Progress',
  processingWaitHint: 'Please wait, export will be available after processing completes',
  cancel: 'Cancel Processing',
  cancelProcessing: 'Cancel Processing',
  startProcessing: 'Start Processing',
  reprocess: 'Reprocess',

  exportTitle: 'Export Image',
  formatPng: 'PNG',
  formatPngDesc: 'Transparent background, lossless quality',
  formatJpg: 'JPG',
  formatJpgDesc: 'White background, good compatibility',
  formatWebp: 'WebP',
  formatWebpDesc: 'Smaller size, modern browsers',
  downloadImage: 'Download Image',
  copyToClipboard: 'Copy to Clipboard (PNG)',
  copied: 'Copied to Clipboard',
  copyFailed: 'Unable to copy to clipboard, possibly due to browser restrictions. Please click "Download Image" to save.',
  clipboardHint: '* Clipboard copy always uses PNG format to preserve transparency',
  processNewImage: 'Process New Image',

  previewTitle: 'Preview Comparison',
  previewOriginal: 'Original',
  previewResult: 'Result',
  previewDragHint: 'Drag slider to compare before and after',
  processingHint: 'Processing...',
  processingModelDownload: 'First use requires downloading model files',

  errorTitle: 'Error',

  footerText: 'Powered by ONNX Runtime Web • All processing done locally',

  settings: 'Settings',
  modelsPageTitle: 'Model Settings',
  checkStatus: 'Check',
  checking: 'Checking...',
  available: 'Available',
  unavailable: 'Unavailable',

  language: 'Language',
  languageZh: '中文',
  languageEn: 'English',

  darkMode: 'Dark Mode',
  lightMode: 'Light Mode',
} as const;

export type TranslationKey = keyof typeof translations;