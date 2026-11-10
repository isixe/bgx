import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// onnxruntime-web 的 webgpu bundle 内部用 `new URL('*.wasm', import.meta.url)`
// 引用 WASM，Vite 会把这些资源额外产出到 _astro/ 下。运行时我们统一从 public/ 根目录
// 按 env.wasm.wasmBinary 加载 asyncify 版 WASM（该 bundle 内置的正是 asyncify 胶水），
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
  server: {
    port: 8971,
    host: '127.0.0.1',
    // 開發伺服器同樣需要這兩個標頭，否則 dev 下不是 cross-origin isolated，
    // SharedArrayBuffer 不存在，多執行緒 WASM 與共享模型緩衝都會退化。
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
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
      // Fail loudly instead of silently drifting to 8972+; dev:electron waits on a fixed port.
      strictPort: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // 使用 webgpu bundle：内置 WebGPU + asyncify WASM 执行后端，GPU 不可用时回退到 WASM
        'onnxruntime-web': 'onnxruntime-web/webgpu',
      },
    },
    worker: {
      format: 'es',
    },
  },
});
