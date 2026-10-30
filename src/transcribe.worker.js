import { pipeline, env } from '@huggingface/transformers';
import model from '../model.json';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = `/models/${model.revision}/`;
// One same-origin cache is controlled by the service worker, including offline downloads.
env.useBrowserCache = false;
env.useWasmCache = false;
env.fetch = (input, options = {}) => {
  const url = new URL(input instanceof Request ? input.url : input, self.location.href);
  if (url.origin !== self.location.origin) throw new Error('External model requests are disabled');
  // The service worker manages offline caching. Avoid a second disk-cache copy
  // of large model files, which can fail in constrained browser profiles.
  return fetch(input, { ...options, cache: 'no-store' });
};
env.backends.onnx.wasm.wasmPaths = {
  mjs: '/wasm/ort-wasm-simd-threaded.mjs',
  wasm: '/wasm/ort-wasm-simd-threaded.wasm',
};
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;

let transcriber;
self.onmessage = async ({ data }) => {
  const { audio, language, id } = data;
  const send = (type, extra = {}) => self.postMessage({ id, type, ...extra });
  try {
    const files = new Map();
    transcriber ??= await pipeline('automatic-speech-recognition', model.id, {
      device: 'wasm', dtype: model.dtype,
      progress_callback: p => {
        if (p.status === 'progress') {
          files.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
          send('download', { loaded: [...files.values()].reduce((n, f) => n + f.loaded, 0) });
        }
      },
    });
    send('transcribing');
    const result = await transcriber(audio, {
      language, task: 'transcribe', return_timestamps: true,
      chunk_length_s: 30, stride_length_s: 5,
      // Bound generation on silence and very difficult recordings.
      max_new_tokens: 440,
      chunk_callback: () => send('chunk'),
    });
    send('result', { result });
  } catch (error) {
    // No recording details, model output or user file names in error telemetry.
    send('error', { reason: error?.name === 'RangeError' ? 'memory' : 'model' });
    console.error('Local captioning failed:', error?.message);
  }
};
