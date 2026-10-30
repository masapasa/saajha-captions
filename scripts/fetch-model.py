"""Fetch one immutable model revision. No inference API or credentials required."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
model = json.loads((ROOT / 'model.json').read_text())
target = ROOT / 'public' / 'models' / model['revision'] / model['id']

def fetch(name):
    dst = target / name
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists():
        url = f"https://huggingface.co/{model['id']}/resolve/{model['revision']}/{name}"
        tmp = dst.with_suffix(dst.suffix + '.part')
        with urllib.request.urlopen(url, timeout=120) as r, tmp.open('wb') as out:
            while block := r.read(1024 * 1024):
                out.write(block)
        os.replace(tmp, dst)
    digest = hashlib.sha256(dst.read_bytes()).hexdigest()
    print(f'{name}: {dst.stat().st_size} bytes', flush=True)
    return {'path': name, 'bytes': dst.stat().st_size, 'sha256': digest}

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    files = list(pool.map(fetch, model['files']))
manifest = {**model, 'files': files, 'totalBytes': sum(f['bytes'] for f in files)}
# Tracked hashes allow later fetches to detect upstream corruption or local edits.
lock = ROOT / 'model-lock.json'
if lock.exists() and json.loads(lock.read_text()) != manifest:
    raise SystemExit('Model integrity mismatch; do not build or deploy.')
lock.write_text(json.dumps(manifest, indent=2) + '\n')
(target.parent.parent / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f"Verified {manifest['totalBytes']:,} bytes at {model['revision']}")
