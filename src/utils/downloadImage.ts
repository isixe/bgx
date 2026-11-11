import { getImageBlob } from './imageStore';

export async function downloadResultImage(
  originalImage: string,
  resultImage: string,
  filename: string,
  format: 'png' | 'jpg' | 'webp',
) {
  const originalImg = await loadImage(originalImage);
  const canvas = document.createElement('canvas');
  canvas.width = originalImg.width;
  canvas.height = originalImg.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (format === 'jpg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const resultImg = await loadImage(resultImage);
  ctx.drawImage(resultImg, 0, 0, canvas.width, canvas.height);

  const quality = format === 'webp' ? 0.9 : undefined;
  const baseName = filename.replace(/\.[^.]+$/, '');
  const downloadName = `${baseName}-removed.${format}`;
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, `image/${format}`, quality);
  });
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = downloadName;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

// 先取缓存里的字节再交给 <img>，避免直接引用已失效的 blob: URL。
async function loadImage(source: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(await getImageBlob(source));
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function renderResultBlob(
  originalImage: string,
  resultImage: string,
  format: 'png' | 'jpg' | 'webp',
): Promise<Blob> {
  if (format === 'png') {
    // 结果已是全分辨率 PNG，直接复用其字节，省去解码与重编码。
    try {
      return await getImageBlob(resultImage);
    } catch {
      // 取不到原始字节时退回画布重编码。
    }
  }
  const originalImg = await loadImage(originalImage);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  canvas.width = originalImg.width;
  canvas.height = originalImg.height;
  if (format === 'jpg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const resultImg = await loadImage(resultImage);
  ctx.drawImage(resultImg, 0, 0, canvas.width, canvas.height);
  const quality = format === 'webp' ? 0.9 : undefined;
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob failed'))),
      `image/${format}`,
      quality,
    );
  });
}

export interface BatchSaveItem {
  originalImage: string;
  resultImage: string | null;
  name: string;
}

export interface BatchSaveResult {
  canceled: boolean;
  saved: number;
}

export async function saveImagesBatchToDirectory(
  items: BatchSaveItem[],
  format: 'png' | 'jpg' | 'webp' = 'png',
  dialogTitle?: string,
): Promise<BatchSaveResult> {
  const valid = items.filter((item) => item.resultImage);
  if (valid.length === 0) return { canceled: false, saved: 0 };

  const bgx = typeof window !== 'undefined' ? window.bgx : undefined;
  if (bgx?.saveImages) {
    const used = new Set<string>();
    const files: { filename: string; bytes: Uint8Array }[] = [];
    for (const item of valid) {
      const blob = await renderResultBlob(item.originalImage, item.resultImage!, format);
      const baseName = item.name.replace(/\.[^.]+$/, '');
      let filename = `${baseName}-removed.${format}`;
      let n = 1;
      while (used.has(filename)) {
        filename = `${baseName}-removed (${n}).${format}`;
        n += 1;
      }
      used.add(filename);
      files.push({ filename, bytes: new Uint8Array(await blob.arrayBuffer()) });
    }
    const result = await bgx.saveImages(files, dialogTitle);
    if (result?.error) {
      throw new Error(result.error);
    }
    return { canceled: !!result?.canceled, saved: result?.saved ?? 0 };
  }

  for (const item of valid) {
    await downloadResultImage(item.originalImage, item.resultImage!, item.name, format);
  }
  return { canceled: false, saved: valid.length };
}
