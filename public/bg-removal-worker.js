// Background Removal Web Worker
// Uses modern-rembg via dynamic import

let isCancelled = false;

self.onmessage = async function(e) {
  const { type, imageDataUrl, modelPath, resolution } = e.data;

  if (type === 'cancel') {
    isCancelled = true;
    return;
  }

  if (type === 'process') {
    isCancelled = false;

    try {
      // Dynamic import modern-rembg in worker
      const { removeBackground } = await import('https://cdn.jsdelivr.net/npm/modern-rembg@latest/dist/modern-rembg.esm.js');

      if (isCancelled) {
        self.postMessage({ type: 'cancelled' });
        return;
      }

      const blob = await removeBackground(imageDataUrl, {
        model: modelPath,
        resolution: resolution,
        debug: false,
      });

      if (isCancelled) {
        self.postMessage({ type: 'cancelled' });
        return;
      }

      // Convert blob to data URL
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isCancelled) {
          self.postMessage({ type: 'cancelled' });
          return;
        }
        self.postMessage({ type: 'success', result: reader.result });
      };
      reader.readAsDataURL(blob);

    } catch (error) {
      if (isCancelled) {
        self.postMessage({ type: 'cancelled' });
        return;
      }
      self.postMessage({ type: 'error', error: error.message || String(error) });
    }
  }
};
