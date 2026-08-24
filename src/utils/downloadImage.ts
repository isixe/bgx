export function downloadResultImage(
  originalImage: string,
  resultImage: string,
  filename: string,
  format: 'png' | 'jpg' | 'webp',
) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const originalImg = new Image();
  originalImg.onload = () => {
    canvas.width = originalImg.width;
    canvas.height = originalImg.height;

    if (format === 'jpg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const resultImg = new Image();
    resultImg.onload = () => {
      ctx.drawImage(resultImg, 0, 0, canvas.width, canvas.height);

      const quality = format === 'webp' ? 0.9 : undefined;
      const dataUrl = canvas.toDataURL(`image/${format}`, quality);
      const link = document.createElement('a');
      const baseName = filename.replace(/\.[^.]+$/, '');
      link.download = `${baseName}-removed.${format}`;
      link.href = dataUrl;
      link.click();
    };
    resultImg.src = resultImage;
  };
  originalImg.src = originalImage;
}
