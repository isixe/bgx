// onnxruntime-web/webgpu 内置的是 asyncify 版 WASM 胶水，必须加载与之 ABI 匹配的
// ort-wasm-simd-threaded.asyncify.wasm（由 postinstall 复制到 public/），否则后端初始化会失败。
// 主线程与 worker 共用同一常量，避免两处路径不一致。
export const ORT_WASM_URL = '/ort-wasm-simd-threaded.asyncify.wasm';
