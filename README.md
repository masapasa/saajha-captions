# Saajha Captions / साझा क्याप्सन

A free, browser-local captioning pilot for short community learning recordings.
This is a separate web implementation of the local Whisper approach explored in
ScreenStudio Linux. It does not use the unfinished Tauri recording workflow.

## What works

- Nepali and English interface; Nepali, English or Hindi transcription selection.
- Multilingual Whisper tiny (39M parameters), q8 encoder and merged decoder.
- Audio never leaves the browser. No authentication, payment, analytics or audio API.
- 20 MiB / 3 minute audio limits, metadata check before decoding, silence check,
  Web Worker inference, cancellation and explicit memory cleanup.
- Editable caption text and times; reviewed SRT, WebVTT and text exports.
- Model download is explicit. About 61 MB of model, runtime and app assets on first
  use, before transfer compression. Cached offline use is checked in the browser.
- Self-hosted pinned model assets, restrictive CSP, no third-party runtime requests.

This is an **early pilot**, not an accuracy-validated product. English synthetic
speech in a desktop browser is an engineering smoke test, not community or Nepali
accuracy evidence. No real users or partner deployments are claimed. Anu must
review the Nepali wording and test with consenting community educators and women
using their actual phones before claims about product-community fit.

## Build and test

Use Node >=22.12 and Python 3. The pinned dependency lock is required.

```sh
npm ci --ignore-scripts
npm run models
npm test
npm run build
npm run preview
```

The fetcher downloads one immutable Hugging Face revision and verifies tracked
SHA-256 checksums. A mismatched model fails the build. No API token is required.
Npm script entry points use explicit paths to also work on network volumes that
cannot create functional symlinks. On such volumes build to a local directory:

```sh
CAPTIONS_DIST=/private/tmp/saajha-captions-build npm run build
CAPTIONS_DIST=/private/tmp/saajha-captions-build npm run preview
```

Browser tests use an installed Google Chrome (`CAPTIONS_BROWSER_CHANNEL` can
override). Generate the non-private synthetic fixtures on macOS with `say`, then
FFmpeg. On other platforms use any speech synthesizer and the same sentence:

```sh
mkdir -p tests/fixtures
say -v Samantha -o /private/tmp/saajha-lesson.aiff 'Welcome to our community learning session. Today we will learn how to save money and build a better future together.'
ffmpeg -y -i /private/tmp/saajha-lesson.aiff -ar 16000 -ac 1 tests/fixtures/lesson.wav
ffmpeg -y -f lavfi -i anullsrc=r=16000:cl=mono -t 181 tests/fixtures/long.wav
npm run test:browser
```

`CAPTIONS_TEST_URL=https://captions.nubri.co` tests the deployed build instead of
starting the preview server. Tests run real inference, validate reviewed Nepali
UTF-8 exports, reject bad inputs, check requests stay on the same origin, and
reload/infer offline. They do not measure Nepali recognition accuracy.

## Deployment

Serve `dist/` with the included Caddy configuration, which sets CSP and privacy
headers, permits only GET/HEAD, and returns 404 for missing assets. No server-side
speech processing is needed. Use HTTPS for service workers. `compose.yaml` runs
the existing pinned Caddy image without root, with a read-only filesystem, dropped
capabilities and a 192 MB memory limit on the `apps_default` network. This service
is isolated from the consolidated application compose project.

The release directory is immutable. Point `CAPTIONS_RELEASE` to the new directory,
and retain the previous release for rollback. A future domain change should add
the purchased hostname to the shared reverse proxy and DNS, preserving all other
sites and email records. Domain registration is a manual owner purchase.

## Community validation before the Mozilla application

Anu Bhattarai leads outreach and implementation, with AI-assisted development.
Her legal education, women's rights and disability-inclusive workshop experience
supports that role; no prior software engineering credentials are implied.

Start with 3–5 consenting educators or women from Anu's existing network. Ask them
to caption a non-sensitive 30–60 second learning recording, correct the output,
download it, and try cached use offline. Record device/browser, language, download
cost, elapsed time, usability barriers, corrections required and whether they
return without prompting. Keep observations separate from automated test results.
Do not record sensitive stories or participant identities in this repository.

If these sessions do not establish useful Nepali output or meaningful community
interest, the incubator application is premature. Deployment and automated tests
are not community traction. Mozilla also expects a distinctive technical approach;
using Whisper alone does not establish novelty. Applicant choice should follow the
actual project owner and restricted public benefit, not an invented success rate.

## License and provenance

MIT application code, same license as the parent repository. OpenAI Whisper model
and weights: MIT; ONNX conversion: onnx-community. Transformers.js: Apache-2.0;
ONNX Runtime: MIT. See `public/licenses.txt`, `public/model-notice.html`,
`model.json` and `model-lock.json` for notices, immutable revision and checksums.
The source archive served with the pilot excludes dependencies, model weights,
fixtures, recordings, credentials, Git metadata and test reports.
