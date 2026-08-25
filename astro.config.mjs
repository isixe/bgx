import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  integrations: [
    react({
      include: ['**/react/**/*', '**/*.tsx'],
    }),
    tailwind(),
  ],
  vite: {
    optimizeDeps: {},
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // 强制使用 WASM-only bundle，避免 JSEP/WebGPU 加载失败
        'onnxruntime-web': 'onnxruntime-web/wasm',
      },
    },
    worker: {
      format: 'es',
    },
  },
});
