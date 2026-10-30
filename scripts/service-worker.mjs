import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

async function walk(dir) {
  const all = await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? walk(join(dir, e.name)) : join(dir, e.name)));
  return all.flat();
}
const model = JSON.parse(await readFile('model-lock.json', 'utf8'));
const dist = process.env.CAPTIONS_DIST || 'dist';
const files = (await walk(dist)).map(p => p.slice(dist.length)).filter(p => !p.startsWith('/models/') && !p.startsWith('/wasm/') && !p.endsWith('.wasm') && !['/sw.js','/offline-files.json','/download-info.json'].includes(p));
const runtime = ['/wasm/ort-wasm-simd-threaded.mjs', '/wasm/ort-wasm-simd-threaded.wasm'];
const modelFiles = model.files.filter(f => !['merges.txt','vocab.json','added_tokens.json','special_tokens_map.json'].includes(f.path)).map(f => `/models/${model.revision}/${model.id}/${f.path}`);
await writeFile(dist + '/offline-files.json', JSON.stringify([...files, ...runtime, ...modelFiles]));
const runtimeBytes = (await Promise.all(runtime.map(p => stat(dist + p)))).reduce((n, s) => n + s.size, 0);
const appBytes = (await Promise.all(files.map(p => stat(dist + p)))).reduce((n, s) => n + s.size, 0);
await writeFile(dist + '/download-info.json', JSON.stringify({ bytes: model.totalBytes + runtimeBytes + appBytes, modelBytes: model.totalBytes, runtimeBytes }));
files.push('/offline-files.json','/download-info.json');
const hash = createHash('sha256');
for (const path of files) hash.update(await readFile(dist + path));
const version = hash.digest('hex').slice(0, 16);
await writeFile(dist + '/sw.js', `// Generated; model files download only after an explicit user action.
const APP = 'saajha-app-${version}';
const MODEL = 'saajha-model-${model.revision}';
const SHELL = ${JSON.stringify(files)};
self.addEventListener('install', event => event.waitUntil(caches.open(APP).then(c => c.addAll(SHELL))));
// Activation waits for existing tabs to close: avoid replacing a running transcription.
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('saajha-app-') && name !== APP) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== location.origin || request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(r => {
      // Do not cache arbitrary navigation paths or server error pages.
      return r;
    }).catch(async () => (await caches.match(url.pathname === '/' ? '/index.html' : url.pathname, { ignoreVary: true })) || Response.error()));
    return;
  }
  const isModel = url.pathname.startsWith('/models/${model.revision}/') || url.pathname.startsWith('/wasm/');
  if (!isModel && !SHELL.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(isModel ? MODEL : APP);
    // These public static assets do not vary by request headers. Module loads
    // include Origin, unlike cache.addAll; Vary: Origin must not break offline use.
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      // Cache quotas must never break an otherwise successful online transcription.
      const copy = response.clone();
      event.waitUntil(cache.put(request, copy).catch(() => {}));
    }
    return response;
  })());
});
`);
console.log(`Offline shell ${version}; model download ${model.totalBytes} bytes`);
