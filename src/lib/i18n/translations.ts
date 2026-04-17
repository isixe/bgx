export type Language = 'zh' | 'en';

export const translations = {
  zh: {
    // Header
    appName: 'BGX',
    appSubtitle: '背景移除工具',
    privacyBadge: '本地处理，保护隐私',

    // Hero Section
    heroBadge: '完全免费，无需注册',
    heroTitle: 'AI 智能移除图片背景',
    heroDescription: '利用先进的 AI 模型，自动识别并移除图片背景。支持人像、产品、电商主图等各种场景',

    // Features
    featuresTitle: '功能特性',
    featurePrivacy: '隐私保护',
    featurePrivacyDesc: '所有处理在本地完成，图片不会上传到服务器',
    featureSpeed: '极速处理',
    featureSpeedDesc: '基于 WebAssembly 和 GPU 加速，快速出图',
    featureFormats: '多格式支持',
    featureFormatsDesc: '支持 JPG、PNG、WebP、BMP、TIFF 等常见格式',
    featureExport: '灵活导出',
    featureExportDesc: '支持 PNG、JPG、WebP 多种导出格式',

    // Benefits
    benefitsTitle: '支持批量处理',
    benefitsSubtitle: '无需安装任何软件，打开浏览器即可使用',
    benefitNoInstall: '无需安装',
    benefitNoPayment: '无需付费',
    benefitNoRegister: '无需注册',
    benefitFree: '完全免费',

    // Use Cases
    useCasesTitle: '适用场景',
    useCaseCreative: '创意设计',
    useCaseCreativeDesc: '海报、Banner、合成图',
    useCaseBusiness: '企业办公',
    useCaseBusinessDesc: 'PPT、简历、宣传册',
    useCasePhoto: '摄影后期',
    useCasePhotoDesc: '人像精修、抠图换景',

    // Image Uploader
    uploaderTitle: '点击或拖拽上传图片',
    uploaderSubtitle: '支持 JPG、PNG、WebP，最大 30MB',
    uploaderPaste: '也可以 Ctrl+V 粘贴图片',
    modelLabel: '模型:',
    uploaderDrop: '松开鼠标上传图片',
    errorUnsupportedFormat: '不支持的图片格式，请上传 JPG、PNG、WebP、BMP、TIFF、SVG、AVIF 或 HEIC 格式',
    errorFileTooLarge: '图片大小不能超过 30MB',
    errorReadFailed: '读取图片失败',

    // Model Selector
    modelSelectorTitle: '选择模型版本',
    modelOutputSize: '输出尺寸',
    modelSwitchHint: '切换后将自动重新处理',
    modelResolution: 'px',

    // Models
    modelU2netpName: 'U²Netp',
    modelU2netpDesc: '轻量级模型，速度快，适合大多数场景',
    modelU2netName: 'U²Net',
    modelU2netDesc: '高精度模型，质量更好但处理较慢',
    modelIsnetAnimeName: 'ISNet Anime',
    modelIsnetAnimeDesc: '专为动漫/插画优化',

    // Processing
    processingTitle: '处理中...',
    processingFirstTime: '首次使用需要下载模型文件，可能需要几分钟',
    processingInProgress: '处理进行中',
    processingWaitHint: '请稍候，导出功能将在处理完成后可用',
    cancelProcessing: '取消处理',
    startProcessing: '开始处理',
    reprocess: '重新处理',

    // Export Panel
    exportTitle: '导出图片',
    formatPng: 'PNG',
    formatPngDesc: '透明背景，无损质量',
    formatJpg: 'JPG',
    formatJpgDesc: '白色背景，兼容性好',
    formatWebp: 'WebP',
    formatWebpDesc: '更小体积，现代浏览器',
    downloadImage: '下载图片',
    copyToClipboard: '复制到剪贴板 (PNG)',
    copied: '已复制到剪贴板',
    copyFailed: '无法复制到剪贴板，可能是浏览器限制。请点击「下载图片」保存文件。',
    clipboardHint: '* 剪贴板复制始终使用 PNG 格式，保留透明背景',
    processNewImage: '处理新图片',

    // Image Preview
    previewTitle: '预览对比',
    previewOriginal: '原图',
    previewResult: '结果',
    previewDragHint: '左右拖动滑块对比处理前后效果',
    processingHint: '处理中...',
    processingModelDownload: '首次使用需要下载模型文件',

    // Error
    errorTitle: '错误',

    // Footer
    footerText: 'Powered by ONNX Runtime Web • 所有处理在本地完成',

    // Language Switcher
    language: '语言',
    languageZh: '中文',
    languageEn: 'English',
  },
  en: {
    // Header
    appName: 'BGX',
    appSubtitle: 'Background Remover',
    privacyBadge: 'Local Processing, Privacy Protected',

    // Hero Section
    heroBadge: 'Completely Free, No Registration',
    heroTitle: 'AI-Powered Background Removal',
    heroDescription: 'Use advanced AI models to automatically identify and remove image backgrounds. Supports portraits, products, e-commerce images, and more.',

    // Features
    featuresTitle: 'Features',
    featurePrivacy: 'Privacy Protection',
    featurePrivacyDesc: 'All processing is done locally, images are never uploaded to servers',
    featureSpeed: 'Lightning Fast',
    featureSpeedDesc: 'Powered by WebAssembly and GPU acceleration for quick results',
    featureFormats: 'Multi-Format Support',
    featureFormatsDesc: 'Supports JPG, PNG, WebP, BMP, TIFF, and other common formats',
    featureExport: 'Flexible Export',
    featureExportDesc: 'Export in PNG, JPG, WebP formats',

    // Benefits
    benefitsTitle: 'Batch Processing Supported',
    benefitsSubtitle: 'No software installation needed, just open your browser',
    benefitNoInstall: 'No Installation',
    benefitNoPayment: 'No Payment',
    benefitNoRegister: 'No Registration',
    benefitFree: 'Completely Free',

    // Use Cases
    useCasesTitle: 'Use Cases',
    useCaseCreative: 'Creative Design',
    useCaseCreativeDesc: 'Posters, Banners, Composites',
    useCaseBusiness: 'Business Office',
    useCaseBusinessDesc: 'PPT, Resumes, Brochures',
    useCasePhoto: 'Photo Editing',
    useCasePhotoDesc: 'Portrait retouching, Background replacement',

    // Image Uploader
    uploaderTitle: 'Click or Drag to Upload',
    uploaderSubtitle: 'Supports JPG, PNG, WebP, up to 30MB',
    uploaderPaste: 'Or press Ctrl+V to paste image',
    modelLabel: 'Model:',
    uploaderDrop: 'Release to upload image',
    errorUnsupportedFormat: 'Unsupported image format. Please upload JPG, PNG, WebP, BMP, TIFF, SVG, AVIF, or HEIC.',
    errorFileTooLarge: 'Image size cannot exceed 30MB',
    errorReadFailed: 'Failed to read image',

    // Model Selector
    modelSelectorTitle: 'Select Model',
    modelOutputSize: 'Output Size',
    modelSwitchHint: 'Will automatically reprocess after switching',
    modelResolution: 'px',

    // Models
    modelU2netpName: 'U²Netp',
    modelU2netpDesc: 'Lightweight model, fast speed, suitable for most scenarios',
    modelU2netName: 'U²Net',
    modelU2netDesc: 'High-precision model, better quality but slower processing',
    modelIsnetAnimeName: 'ISNet Anime',
    modelIsnetAnimeDesc: 'Optimized for anime/illustrations',

    // Processing
    processingTitle: 'Processing...',
    processingFirstTime: 'First use requires downloading model files, may take a few minutes',
    processingInProgress: 'Processing in Progress',
    processingWaitHint: 'Please wait, export will be available after processing completes',
    cancelProcessing: 'Cancel Processing',
    startProcessing: 'Start Processing',
    reprocess: 'Reprocess',

    // Export Panel
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

    // Image Preview
    previewTitle: 'Preview Comparison',
    previewOriginal: 'Original',
    previewResult: 'Result',
    previewDragHint: 'Drag slider to compare before and after',
    processingHint: 'Processing...',
    processingModelDownload: 'First use requires downloading model files',

    // Error
    errorTitle: 'Error',

    // Footer
    footerText: 'Powered by ONNX Runtime Web • All processing done locally',

    // Language Switcher
    language: 'Language',
    languageZh: '中文',
    languageEn: 'English',
  },
} as const;

export type Translations = typeof translations;
export type TranslationKey = keyof Translations['zh'];
