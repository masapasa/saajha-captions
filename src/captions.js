export const MAX_BYTES = 20 * 1024 * 1024;
export const MAX_SECONDS = 180;

export function validateFile(file) {
  if (!file || file.size === 0) throw new Error('empty');
  if (file.size > MAX_BYTES) throw new Error('size');
  if (!/\.(wav|mp3|m4a|ogg|flac)$/i.test(file.name)) throw new Error('format');
}

export function normaliseChunks(result, duration) {
  const chunks = result.chunks?.length ? result.chunks : [{ text: result.text, timestamp: [0, duration] }];
  const cleaned = [];
  for (const [i, chunk] of chunks.entries()) {
    const text = String(chunk.text ?? '').trim();
    if (!text) continue;
    const start = Math.max(cleaned.at(-1)?.end ?? 0, Number(chunk.timestamp?.[0]) || 0);
    const next = chunks[i + 1]?.timestamp?.[0];
    const rawEnd = chunk.timestamp?.[1] ?? next ?? duration;
    const end = Math.min(duration, Math.max(start + 0.01, Number(rawEnd) || duration));
    if (start < duration && end > start) cleaned.push({ start: round(start), end: round(end), text });
  }
  return cleaned;
}

const round = n => Math.round(n * 1000) / 1000;

export function validateCaptions(captions, duration) {
  if (!captions.length) return false;
  return captions.every((c, i) => Number.isFinite(c.start) && Number.isFinite(c.end)
    && c.start >= 0 && c.end > c.start && c.end <= duration + 0.001
    && (i === 0 || c.start >= captions[i - 1].end)
    && c.text.trim().length > 0 && c.text.length <= 5000);
}

function timestamp(seconds, separator) {
  const ms = Math.round(seconds * 1000);
  const part = (n, width = 2) => String(n).padStart(width, '0');
  return `${part(Math.floor(ms / 3600000))}:${part(Math.floor(ms / 60000) % 60)}:${part(Math.floor(ms / 1000) % 60)}${separator}${part(ms % 1000, 3)}`;
}

// Treat user edits as plain text: prevent injected cues / WebVTT markup.
const cueText = text => text.trim().replace(/\r\n?/g, '\n').replace(/\n\s*\n/g, '\n').replace(/-->/g, '→');
export function serializeCaptions(captions, format, duration) {
  if (!validateCaptions(captions, duration)) throw new Error('invalid');
  if (format === 'txt') return captions.map(c => c.text.trim()).join('\n') + '\n';
  if (!['srt', 'vtt'].includes(format)) throw new Error('format');
  const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sep = format === 'srt' ? ',' : '.';
  return (format === 'vtt' ? 'WEBVTT\n\n' : '') + captions.map((c, i) =>
    `${i + 1}\n${timestamp(c.start, sep)} --> ${timestamp(c.end, sep)}\n${escape(cueText(c.text))}\n`
  ).join('\n');
}
