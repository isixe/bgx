import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// onnxruntime-web 的 webgpu bundle 内部用 `new URL('*.wasm', import.meta.url)`
// 引用多种 wasm 变体，Vite 会把这些资源额外产出到 _astro/ 下（例如 ~27MB 的
// asyncify 变体）。运行时我们统一从 public/ 根目录按 env.wasm.wasmBinary 加载，
// 这些 _astro 副本不会被请求，构建后直接移除以免污染产物。
function stripRedundantOrtWasm() {
  return {
    name: 'strip-redundant-ort-wasm',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (/ort-wasm.*\.wasm$/i.test(fileName)) {
          delete bundle[fileName];
        }
      }
    },
  };
}

export default defineConfig({
  integrations: [
    react({
      include: ['**/react/**/*', '**/*.tsx'],
    }),
    tailwind(),
  ],
  vite: {
    plugins: [stripRedundantOrtWasm()],
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
        // 使用 webgpu bundle：内置 WebGPU(JSEP) + WASM 执行后端，GPU 不可用时回退到 WASM
        'onnxruntime-web': 'onnxruntime-web/webgpu',
      },
    },
    worker: {
      format: 'es',
    },
  },
});
