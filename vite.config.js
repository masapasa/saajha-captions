import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
const csp = readFileSync(new URL('./Caddyfile', import.meta.url), 'utf8').match(/Content-Security-Policy "([^"]+)"/)[1];
const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Content-Security-Policy': csp,
};
export default defineConfig({
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: false, outDir: process.env.CAPTIONS_DIST || 'dist', emptyOutDir: true },
  server: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
  preview: { headers },
});
