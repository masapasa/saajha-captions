"""Publish only the explicit public source set; never crawl the parent workspace."""
from pathlib import Path
import tarfile

root = Path(__file__).resolve().parents[1]
names = ['README.md', 'LICENSE', '.gitignore', 'package.json', 'package-lock.json',
         'model.json', 'model-lock.json', 'Caddyfile', 'compose.yaml', 'index.html',
         'vite.config.js', 'playwright.config.js']
files = [root / name for name in names]
for folder, patterns in [('src', ['*.js', '*.css']), ('scripts', ['*.py', '*.mjs']),
                         ('tests', ['*.mjs', '*.spec.js']),
                         ('public', ['*.html', '*.css', '*.txt', '*.svg', '*.webmanifest'])]:
    for pattern in patterns:
        files.extend((root / folder).glob(pattern))
dst = root / 'public' / 'saajha-captions-source.tar.gz'
with tarfile.open(dst, 'w:gz', format=tarfile.PAX_FORMAT) as archive:
    for path in sorted(set(files)):
        if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(root):
            raise RuntimeError('Unexpected source path')
        archive.add(path, arcname='saajha-captions/' + str(path.relative_to(root)), recursive=False)
print(f'Public source archive: {dst.stat().st_size:,} bytes')
