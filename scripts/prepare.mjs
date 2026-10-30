import { mkdir, readdir, copyFile, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const model = JSON.parse(await readFile('model-lock.json', 'utf8'));
for (const file of model.files) {
  const path = join('public/models', model.revision, model.id, file.path);
  const bytes = await readFile(path);
  if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
    throw new Error(`Model integrity check failed: ${file.path}`);
  }
}
await rm('public/wasm', { recursive: true, force: true });
await mkdir('public/wasm', { recursive: true });
const ort = 'node_modules/onnxruntime-web/dist';
for (const file of await readdir(ort)) {
  if (['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'].includes(file)) await copyFile(join(ort, file), join('public/wasm', file));
}
