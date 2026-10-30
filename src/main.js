import './style.css';
import { strings } from './i18n.js';
import { MAX_SECONDS, validateFile, normaliseChunks, validateCaptions, serializeCaptions } from './captions.js';

let locale = 'en';
try { locale = localStorage.getItem('caption-language') === 'ne' ? 'ne' : 'en'; } catch { /* private browsing */ }
const state = { file: null, url: null, duration: 0, language: 'nepali', captions: [], busy: false, reviewed: false, status: 'ready', statusData: {}, error: false };
let worker, job = 0, downloadMB = 80, pendingMetadata;
const app = document.querySelector('#app');
const $ = selector => document.querySelector(selector);
const t = key => strings[locale][key] ?? strings.en[key] ?? key;
const icon = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="3" y="5" width="26" height="20" rx="6" stroke="currentColor" stroke-width="2"/><path d="m10 29 6-4M9 13h6m2 0h6M9 18h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function status(key, data = {}, error = false) {
  Object.assign(state, { status: key, statusData: data, error });
  const box = $('#status');
  box.classList.toggle('error', error);
  box.textContent = Object.entries(data).reduce((s, [k, v]) => s.replace(`{${k}}`, v), t(key));
}

function render() {
  document.documentElement.lang = locale;
  document.title = `${t('brand')} · ${t('pilot')}`;
  app.innerHTML = `
    <header class="topbar"><a class="brand" href="/" aria-label="${t('brand')}">${icon}<span>${t('brand')}</span></a>
      <span class="nav-note">${t('nav')}</span><button class="locale quiet" type="button" lang="${locale === 'en' ? 'ne' : 'en'}">${locale === 'en' ? 'नेपाली' : 'English'}</button></header>
    <main id="main">
      <section class="hero"><div class="eyebrow"><span class="dot"></span>${t('eyebrow')}</div><h1>${t('title')}<br><span>${t('title2')}</span></h1>
        <p class="intro">${t('intro')}</p><div class="benefits"><span>◉ &nbsp;${t('privacy')}</span><span>◇ &nbsp;${t('free')}</span><span>अ &nbsp;${t('languages')}</span></div></section>
      <div class="workspace"><section class="tool" aria-labelledby="tool-title"><div class="section-label">${t('step')}</div>
        <h2 id="tool-title">${t('upload')}</h2><p>${t('uploadHint')}</p>
        <div class="file-box"><span class="file-icon" aria-hidden="true">↥</span><label for="audio-file" class="file-button">${t('choose')}</label>
          <input id="audio-file" type="file" accept=".wav,.mp3,.m4a,.ogg,.flac,audio/*" ${state.busy ? 'disabled' : ''}>
          <span id="file-name" class="filename"></span><small>${t('formats')}</small></div>
        <div id="player" ${state.file ? '' : 'hidden'}><label for="audio-player">${t('playing')}</label><audio id="audio-player" controls preload="metadata"></audio><small id="duration"></small></div>
        <label for="recording-language">${t('language')}</label><select id="recording-language" ${state.busy ? 'disabled' : ''}><option value="nepali">${t('nepali')}</option><option value="english">${t('english')}</option><option value="hindi">${t('hindi')}</option></select>
        <div class="download-note"><span aria-hidden="true">↓</span><p>${t('downloadNote').replace('{size}', downloadMB)}</p></div>
        <div class="actions"><button id="transcribe" class="primary" type="button">${t('transcribe')} <span aria-hidden="true">↗</span></button><button id="cancel" class="quiet" type="button" ${state.busy ? '' : 'hidden'}>${t('cancel')}</button><button id="clear" class="quiet" type="button" ${!state.busy && state.file ? '' : 'hidden'}>${t('clear')}</button></div>
        <div id="status" class="status" role="status" aria-live="polite" aria-atomic="true"></div><div id="busy-indicator" class="busy-line" ${state.busy ? '' : 'hidden'} aria-hidden="true"></div>
      </section>
      <aside class="guide"><div class="section-label">${t('process')}</div>${[1,2,3].map(n => `<div class="guide-step"><span>0${n}</span><div><h3>${t('process' + n)}</h3><p>${t('process' + n + 'p')}</p></div></div>`).join('')}
        <div class="review-note"><span class="star" aria-hidden="true">✳</span><h3>${t('reviewTitle')}</h3><p>${t('reviewNote')}</p></div></aside></div>
      <section id="editor" class="editor" ${state.captions.length ? '' : 'hidden'} aria-labelledby="editor-title"><div class="section-label">${t('reviewStep')}</div><h2 id="editor-title" tabindex="-1">${t('editor')}</h2><div id="caption-list"></div>
        <p id="validation" class="error" hidden>${t('invalid')}</p><label class="check-label"><input type="checkbox" id="reviewed" ${state.reviewed ? 'checked' : ''}><span>${t('checked')}</span></label>
        <div class="export-row"><span>${t('exports')}</span>${['srt','vtt','txt'].map(f => `<button class="download quiet" data-format="${f}" type="button">.${f}</button>`).join('')}</div></section>
      <section class="about"><div><div class="section-label">${t('pilot')}</div><h2>${t('about')}</h2><p>${t('aboutText')}</p></div><div class="contact"><a href="mailto:anu@nubri.co">${t('feedback')} ↗</a><p>${t('feedbackNote')}</p></div></section>
      <details class="technical"><summary>${t('technical')}</summary><p>${t('technicalText')}</p><p>${t('storage')}</p><div class="cache-actions"><button id="check-cache" class="quiet" type="button">${t('offlineCheck')}</button><button id="clear-cache" class="quiet" type="button">${t('clearCache')}</button></div><p id="cache-status" role="status"></p><p><a href="/model-notice.html">Model provenance & licenses</a></p></details>
    </main><footer><span>${t('projectStatus')}</span><div><a href="/source.html">${t('licence')}</a><a href="/privacy.html">${t('privacyLink')}</a></div></footer>`;
  $('.locale').onclick = () => {
    locale = locale === 'en' ? 'ne' : 'en';
    try { localStorage.setItem('caption-language', locale); } catch { /* preference is optional */ }
    render();
  };
  $('#audio-file').onchange = event => selectFile(event.target.files?.[0]);
  $('#recording-language').value = state.language;
  $('#recording-language').onchange = event => { state.language = event.target.value; invalidateReview(); };
  $('#transcribe').onclick = transcribe;
  $('#cancel').onclick = cancel;
  $('#clear').onclick = clearRecording;
  $('#reviewed').onchange = event => { state.reviewed = event.target.checked; updateExports(); };
  document.querySelectorAll('.download').forEach(button => { button.onclick = () => download(button.dataset.format); });
  $('#check-cache').onclick = checkCache;
  $('#clear-cache').onclick = clearCache;
  if (state.url) { $('#audio-player').src = state.url; $('#file-name').textContent = state.file.name; }
  if (state.duration) $('#duration').textContent = `${t('duration')}: ${state.duration.toFixed(1)} s`;
  renderCaptions(); updateControls(); status(state.status, state.statusData, state.error);
}

function updateControls() {
  $('#transcribe').disabled = state.busy || !state.file;
  $('#audio-file').disabled = state.busy;
  $('#recording-language').disabled = state.busy;
  $('#cancel').hidden = !state.busy;
  $('#clear').hidden = state.busy || !state.file;
  $('#busy-indicator').hidden = !state.busy;
  $('#clear-cache').disabled = state.busy;
  $('.tool').setAttribute('aria-busy', String(state.busy));
}

function renderCaptions() {
  $('#editor').hidden = !state.captions.length;
  $('#caption-list').replaceChildren();
  state.captions.forEach((caption, i) => {
    const row = document.createElement('div'); row.className = 'caption-row';
    row.innerHTML = `<span class="cue-number">${String(i + 1).padStart(2, '0')}</span><div class="times"><span>${t('timing')}</span><div><input class="start" type="number" min="0" max="${state.duration}" step="0.01" aria-label="${t('start')} ${i + 1}"><span aria-hidden="true">–</span><input class="end" type="number" min="0" max="${state.duration}" step="0.01" aria-label="${t('end')} ${i + 1}"></div></div><textarea rows="2" maxlength="5000" aria-label="${t('caption')} ${i + 1}" dir="auto"></textarea>`;
    row.querySelector('.start').value = caption.start;
    row.querySelector('.end').value = caption.end;
    row.querySelector('textarea').value = caption.text;
    row.querySelectorAll('input, textarea').forEach(input => {
      input.oninput = () => {
        caption.start = Number(row.querySelector('.start').value || NaN);
        caption.end = Number(row.querySelector('.end').value || NaN);
        caption.text = row.querySelector('textarea').value;
        invalidateReview();
      };
    });
    $('#caption-list').append(row);
  });
  updateExports();
}

function invalidateReview() { state.reviewed = false; $('#reviewed').checked = false; updateExports(); }
function updateExports() {
  const valid = validateCaptions(state.captions, state.duration);
  $('#validation').hidden = !state.captions.length || valid;
  document.querySelectorAll('.download').forEach(button => { button.disabled = !state.reviewed || !valid || state.busy; });
}

function clearRecording() {
  job++; worker?.terminate(); worker = undefined;
  if (state.url) URL.revokeObjectURL(state.url);
  pendingMetadata?.();
  Object.assign(state, { file: null, url: null, duration: 0, captions: [], busy: false, reviewed: false, status: 'ready', statusData: {}, error: false });
  render();
}

function selectFile(file) {
  clearRecording();
  if (!file) return;
  try { validateFile(file); }
  catch (e) { status(e.message + 'Error', {}, true); return; }
  state.file = file; state.url = URL.createObjectURL(file);
  render();
}

async function readAudio(file, url) {
  // Read metadata before allocating a decoded PCM buffer for compressed audio.
  await new Promise((resolve, reject) => {
    const probe = new Audio();
    const done = (error) => { clearTimeout(timer); probe.removeAttribute('src'); probe.load(); pendingMetadata = undefined; error ? reject(error) : resolve(); };
    const timer = setTimeout(() => done(new Error('decode')), 12000);
    pendingMetadata = () => done(new Error('cancelled'));
    probe.onloadedmetadata = () => {
      if (!Number.isFinite(probe.duration) || probe.duration <= 0) return done(new Error('decode'));
      if (probe.duration > MAX_SECONDS + 0.05) return done(new Error('duration'));
      done();
    };
    probe.onerror = () => done(new Error('decode'));
    probe.preload = 'metadata'; probe.src = url;
  });
  const context = new OfflineAudioContext(1, 16000, 16000);
  const decoded = await context.decodeAudioData(await file.arrayBuffer()).catch(() => { throw new Error('decode'); });
  if (decoded.duration > MAX_SECONDS + 0.05 || decoded.duration <= 0) throw new Error('duration');
  const resampler = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const source = resampler.createBufferSource(); source.buffer = decoded; source.connect(resampler.destination); source.start();
  const pcm = (await resampler.startRendering()).getChannelData(0);
  // Avoid hallucinated text from entirely silent recordings.
  let energy = 0;
  for (let i = 0; i < pcm.length; i++) energy += pcm[i] ** 2;
  if (Math.sqrt(energy / pcm.length) < 0.0001) throw new Error('emptyAudio');
  return { pcm, duration: decoded.duration };
}

async function transcribe() {
  if (state.busy || !state.file) return;
  if (!globalThis.WebAssembly || !globalThis.Worker || !globalThis.OfflineAudioContext) return status('browserError', {}, true);
  const id = ++job;
  state.busy = true; state.reviewed = false; state.captions = [];
  renderCaptions(); updateControls(); status('preparing');
  try {
    const { pcm, duration } = await readAudio(state.file, state.url);
    if (id !== job) return;
    state.duration = duration;
    $('#duration').textContent = `${t('duration')}: ${state.duration.toFixed(1)} s`;
    // Wait for control on the first visit so model files can be cached for offline use.
    if ('serviceWorker' in navigator) {
      await Promise.race([navigator.serviceWorker.ready, new Promise(resolve => setTimeout(resolve, 3000))]);
    }
    if (id !== job) return;
    status('loading', { mb: 0 });
    worker ??= new Worker(new URL('./transcribe.worker.js', import.meta.url), { type: 'module' });
    let lastUpdate = 0;
    worker.onmessage = ({ data }) => {
      if (id !== job || data.id !== id) return;
      if (data.type === 'download' && performance.now() - lastUpdate > 700) {
        status('loading', { mb: (data.loaded / 1e6).toFixed(1) }); lastUpdate = performance.now();
      } else if (data.type === 'transcribing' || data.type === 'chunk') status('working');
      else if (data.type === 'result') {
        state.captions = normaliseChunks(data.result, state.duration);
        state.busy = false; renderCaptions(); updateControls();
        status(state.captions.length ? 'finished' : 'empty');
        if (state.captions.length) $('#editor-title').focus({ preventScroll: false });
      } else if (data.type === 'error') fail(data.reason + 'Error');
    };
    worker.onerror = () => { if (id === job) fail('modelError'); };
    worker.postMessage({ id, audio: pcm, language: state.language }, [pcm.buffer]);
  } catch (error) {
    if (id !== job) return;
    fail(error.message === 'emptyAudio' ? 'empty' : ['decode','duration'].includes(error.message) ? error.message + 'Error' : 'modelError');
  }
}

function fail(key) { worker?.terminate(); worker = undefined; state.busy = false; updateControls(); status(key, {}, true); }
function cancel() { job++; pendingMetadata?.(); worker?.terminate(); worker = undefined; state.busy = false; updateControls(); status('cancelled'); }

function download(format) {
  if (!state.reviewed || state.busy) return;
  try {
    const content = serializeCaptions(state.captions, format, state.duration);
    const url = URL.createObjectURL(new Blob([content], { type: format === 'vtt' ? 'text/vtt;charset=utf-8' : 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `captions.${format}`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { status('invalid', {}, true); }
}

async function checkCache() {
  const text = $('#cache-status');
  try {
    const response = await fetch('/offline-files.json', { cache: 'no-store' });
    const paths = await response.json();
    const all = await Promise.all(paths.map(path => caches.match(path, { ignoreVary: true })));
    text.textContent = t(all.every(Boolean) ? 'offlineReady' : 'offlineMissing');
  } catch { text.textContent = t('offlineMissing'); }
}

async function clearCache() {
  if (state.busy) return;
  worker?.terminate(); worker = undefined;
  try {
    for (const name of await caches.keys()) if (name.startsWith('saajha-')) await caches.delete(name);
    $('#cache-status').textContent = t('cacheRemoved');
  } catch { $('#cache-status').textContent = t('offlineMissing'); }
}

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
fetch('/download-info.json').then(r => r.json()).then(info => { downloadMB = Math.ceil(info.bytes / 1e6); if (!state.busy) render(); }).catch(() => {});
window.addEventListener('pagehide', event => {
  job++; worker?.terminate(); worker = undefined;
  if (!event.persisted && state.url) URL.revokeObjectURL(state.url);
});
window.addEventListener('pageshow', event => {
  if (event.persisted && state.busy) { state.busy = false; updateControls(); status('cancelled'); }
});
