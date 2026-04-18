export const translations = {
  appName: 'BGX',
  appSubtitle: '背景移除工具',
  privacyBadge: '本地处理，保护隐私',

  heroBadge: '完全免费，无需注册',
  heroTitle: 'AI 智能移除图片背景',
  heroDescription: '利用先进的 AI 模型，自动识别并移除图片背景。支持人像、产品、电商主图等各种场景',

  featuresTitle: '功能特性',
  featurePrivacy: '隐私保护',
  featurePrivacyDesc: '所有处理在本地完成，图片不会上传到服务器',
  featureSpeed: '极速处理',
  featureSpeedDesc: '基于 WebAssembly 和 GPU 加速，快速出图',
  featureFormats: '多格式支持',
  featureFormatsDesc: '支持 JPG、PNG、WebP、BMP、TIFF 等常见格式',
  featureExport: '灵活导出',
  featureExportDesc: '支持 PNG、JPG、WebP 多种导出格式',

  benefitsTitle: '支持批量处理',
  benefitsSubtitle: '无需安装任何软件，打开浏览器即可使用',
  benefitNoInstall: '无需安装',
  benefitNoPayment: '无需付费',
  benefitNoRegister: '无需注册',
  benefitFree: '完全免费',

  useCasesTitle: '适用场景',
  useCaseCreative: '创意设计',
  useCaseCreativeDesc: '海报、Banner、合成图',
  useCaseBusiness: '企业办公',
  useCaseBusinessDesc: 'PPT、简历、宣传册',
  useCasePhoto: '摄影后期',
  useCasePhotoDesc: '人像精修、抠图换景',

  uploaderTitle: '点击或拖拽上传图片',
  uploaderSubtitle: '支持 JPG、PNG、WebP，最大 30MB',
  uploaderPaste: '也可以 Ctrl+V 粘贴图片',
  modelLabel: '模型:',
  uploaderDrop: '松开鼠标上传图片',
  errorUnsupportedFormat: '不支持的图片格式，请上传 JPG、PNG、WebP、BMP、TIFF、SVG、AVIF 或 HEIC 格式',
  errorFileTooLarge: '图片大小不能超过 30MB',
  errorReadFailed: '读取图片失败',

  modelSelectorTitle: '选择模型',
  modelOutputSize: '输出尺寸',
  modelSwitchHint: '切换后将自动重新处理',
  modelResolution: 'px',

  model: {
    u2netp: {
      desc: '轻量级模型，速度快，适合大多数场景',
    },
    u2net: {
      desc: '高精度模型，质量更好但处理较慢',
    },
    u2net_human_seg: {
      desc: '专门用于人像分割',
    },
    u2net_cloth_seg: {
      desc: '专门用于服装分割',
    },
    silueta: {
      desc: '轻量级剪影模型',
    },
    'isnet-general-use': {
      desc: '通用场景高精度模型',
    },
    'isnet-anime': {
      desc: '专为动漫/插画优化',
    },
    large: {
      desc: 'imgly 大模型，最高质量',
    },
    medium: {
      desc: 'imgly 中等模型，平衡质量与速度',
    },
    small: {
      desc: 'imgly 小模型，速度优先',
    },
    PPModnet_MobileNetV2: {
      desc: 'PaddlePaddle 轻量级人像分割',
    },
  },

  processingTitle: '处理中...',
  processingFirstTime: '首次使用需要下载模型文件，可能需要几分钟',
  processingInProgress: '处理进行中',
  processingWaitHint: '请稍候，导出功能将在处理完成后可用',
  cancel: '取消处理',
  cancelProcessing: '取消处理',
  startProcessing: '开始处理',
  reprocess: '重新处理',

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

  previewTitle: '预览对比',
  previewOriginal: '原图',
  previewResult: '结果',
  previewDragHint: '左右拖动滑块对比处理前后效果',
  processingHint: '处理中...',
  processingModelDownload: '首次使用需要下载模型文件',

  errorTitle: '错误',

  footerText: 'Powered by ONNX Runtime Web • 所有处理在本地完成',

  settings: '设置',
  modelsPageTitle: '模型设置',
  checkStatus: '检查',
  checking: '检查中...',
  available: '可用',
  unavailable: '不可用',

  language: '语言',
  languageZh: '中文',
  languageEn: 'English',

  darkMode: '深色模式',
  lightMode: '浅色模式',
} as const;

export type TranslationKey = keyof typeof translations;