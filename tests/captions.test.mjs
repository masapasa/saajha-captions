import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFile, MAX_BYTES, normaliseChunks, validateCaptions, serializeCaptions } from '../src/captions.js';

test('reject empty, unsupported and oversized recordings before decoding', () => {
  for (const [file, code] of [[{name:'a.wav',size:0},'empty'],[{name:'a.mp4',size:12},'format'],[{name:'a.mp3',size:MAX_BYTES+1},'size']]) {
    assert.throws(() => validateFile(file), new RegExp(code));
  }
  assert.doesNotThrow(() => validateFile({name:'lesson.WAV',size:1000}));
});
test('normalize missing final timestamps and clamp model output to audio bounds', () => {
  const cues = normaliseChunks({chunks:[{text:'पहिलो',timestamp:[0,1.5]},{text:'दोस्रो',timestamp:[1.4,null]}]}, 3);
  assert.deepEqual(cues,[{start:0,end:1.5,text:'पहिलो'},{start:1.5,end:3,text:'दोस्रो'}]);
  assert.equal(validateCaptions(cues,3),true);
  assert.deepEqual(normaliseChunks({text:'   '}, 3), []);
});
test('reject overlapping, reversed, empty or out-of-range reviewed captions', () => {
  for (const cues of [[{start:0,end:4,text:'a'}],[{start:2,end:1,text:'a'}],[{start:0,end:1,text:''}],[{start:0,end:2,text:'a'},{start:1,end:3,text:'b'}],[{start:NaN,end:1,text:'x'}]]) assert.equal(validateCaptions(cues,3),false);
});
test('UTF-8 exports keep Nepali and prevent markup/cue injection', () => {
  const cues=[{start:0,end:1.025,text:'नमस्ते <script>\n\n00:00 --> 10'}];
  const srt=serializeCaptions(cues,'srt',2);
  assert.match(srt,/00:00:00,000 --> 00:00:01,025/);
  assert.match(srt,/नमस्ते &lt;script&gt;\n00:00 → 10/);
  assert.match(serializeCaptions(cues,'vtt',2),/^WEBVTT\n\n1\n00:00:00.000/);
  assert.match(serializeCaptions(cues,'txt',2),/नमस्ते/);
  assert.throws(()=>serializeCaptions(cues,'html',2),/format/);
});
