/* Builds the landing page into site/dist, which is what Cloudflare serves:
   the page, its favicon, and the wide-framed intro with its poster from media/.

   `node site/build.mjs --serve [port]` also serves dist for a local look. */
import { cpSync, mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DIST = join(HERE, 'dist');

export function build() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(join(DIST, 'media'), { recursive: true });
  cpSync(join(HERE, 'index.html'), join(DIST, 'index.html'));
  cpSync(join(HERE, 'favicon.svg'), join(DIST, 'favicon.svg'));
  for (const f of ['tailr-intro-website.mp4', 'tailr-intro-website-poster.jpg']) {
    cpSync(join(ROOT, 'media', f), join(DIST, 'media', f));
  }
  return DIST;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.css': 'text/css; charset=utf-8'
};
export function serve(port) {
  return createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(DIST, path === '/' || path === '\\' ? 'index.html' : path);
    if (!existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    const body = readFileSync(file);
    const type = TYPES[extname(file)] || 'application/octet-stream';
    // the video wants ranges so the browser can seek
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range && type === 'video/mp4') {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : body.length - 1;
      res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes',
        'content-range': `bytes ${start}-${end}/${body.length}`, 'content-length': end - start + 1 });
      return res.end(body.subarray(start, end + 1));
    }
    res.writeHead(200, { 'content-type': type, 'content-length': body.length, 'cache-control': 'no-store' });
    res.end(body);
  }).listen(port, '127.0.0.1', () => {
    process.stdout.write(`  landing page on http://127.0.0.1:${port}\n`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  build();
  process.stdout.write(`  built ${DIST}\n`);
  const i = process.argv.indexOf('--serve');
  if (i !== -1) serve(Number(process.argv[i + 1]) || 4200);
}
