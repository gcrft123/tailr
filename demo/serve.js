/* A stand-in dev server for the demo, so `npm run demo` is one command rather
   than two and a note about which port to use. Tailr's own `--` form starts
   this, then proxies it — which exercises that path as a side effect. */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8902);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  // The demo app is a single page with several routes drawn on it, so anything
  // that isn't a file on disk serves the page — there is somewhere to walk to
  // while marking things up, which is what a route-spanning batch needs.
  let file = join(HERE, path.replace(/^(\.\.[/\\])+/, ''));
  let body;
  try { body = readFileSync(file); }
  catch { file = join(HERE, 'index.html'); body = readFileSync(file); }

  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(body);
}).listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`  demo app on http://127.0.0.1:${PORT}\n`);
});
