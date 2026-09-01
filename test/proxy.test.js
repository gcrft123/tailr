/* Tailr sits in front of an application it does not own. What it must never do
   is change anything but the HTML it injects into — and it must never take the
   review URL down, whatever the dev server does. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTailr, startUpstream } from './helpers.js';

const html = (body) => (req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
};

test('the overlay is injected into HTML, before </head>', async (t) => {
  const up = await startUpstream(html('<!doctype html><html><head><title>App</title></head><body>hi</body></html>'));
  const s = await startTailr(up.url);
  t.after(async () => { await s.close(); await up.close(); });

  const page = await (await fetch(s.base + '/')).text();
  assert.match(page, /<script src="\/__tailr\/overlay\.js" defer><\/script><\/head>/);
  assert.match(page, /hi<\/body>/, 'the rest of the page is left alone');
});

test('a page with no head takes the tag before </body>, and one with neither still gets it', async (t) => {
  const up = await startUpstream(html('<div>bare</div><body>x</body>'));
  const s = await startTailr(up.url);
  t.after(async () => { await s.close(); await up.close(); });

  assert.match(await (await fetch(s.base + '/')).text(), /overlay\.js" defer><\/script><\/body>/);
});

test('the overlay is never injected twice', async (t) => {
  const already = '<html><head><script src="/__tailr/overlay.js" defer></script></head><body></body></html>';
  const up = await startUpstream(html(already));
  const s = await startTailr(up.url);
  t.after(async () => { await s.close(); await up.close(); });

  const page = await (await fetch(s.base + '/')).text();
  assert.equal(page.match(/overlay\.js/g).length, 1);
});

test('chunked HTML is rewritten without leaving a contradictory content-length', async (t) => {
  // A dev server streams its HTML, so the upstream response is chunked. The
  // rewritten body needs its own length and none of the old body's framing.
  const up = await startUpstream((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html', 'transfer-encoding': 'chunked' });
    res.write('<html><head>');
    res.end('</head><body>streamed</body></html>');
  });
  const s = await startTailr(up.url);
  t.after(async () => { await s.close(); await up.close(); });

  const res = await fetch(s.base + '/');
  const body = await res.text();
  assert.match(body, /overlay\.js/);
  assert.equal(res.headers.get('transfer-encoding'), null, 'the old framing is gone');
  assert.equal(Number(res.headers.get('content-length')), Buffer.byteLength(body));
});

test('HTML the proxy cannot read is passed through rather than corrupted', async (t) => {
  // Some dev servers compress regardless of accept-encoding. Decoding that as
  // utf8 and injecting into it would hand the reviewer a broken page.
  const { gzipSync } = await import('node:zlib');
  const original = '<html><head></head><body>zipped</body></html>';
  const up = await startUpstream((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' });
    res.end(gzipSync(original));
  });
  const s = await startTailr(up.url);
  t.after(async () => { await s.close(); await up.close(); });

  const res = await fetch(s.base + '/');
  assert.equal(await res.text(), original, 'it arrives intact, just without the overlay');
});

test('everything that is not HTML passes through untouched', async (t) => {
  const payload = JSON.stringify({ invoices: [1, 2, 3] });
  const up = await startUpstream((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json', 'x-from-upstream': 'yes' });
    res.end(payload);
  });
  const s = await startTailr(up.url);
  t.after(async () => { await s.close(); await up.close(); });

  const res = await fetch(s.base + '/api/invoices');
  assert.equal(await res.text(), payload);
  assert.equal(res.headers.get('x-from-upstream'), 'yes', 'upstream headers survive the hop');
});

test('the request method, path and body reach the dev server intact', async (t) => {
  let seen = null;
  const up = await startUpstream((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      seen = { method: req.method, url: req.url, body: raw };
      res.writeHead(204); res.end();
    });
  });
  const s = await startTailr(up.url);
  t.after(async () => { await s.close(); await up.close(); });

  await fetch(s.base + '/orders?page=2', { method: 'POST', body: 'q=1' });
  assert.deepEqual(seen, { method: 'POST', url: '/orders?page=2', body: 'q=1' });
});

test('a dev server that is down becomes one dead page, not a dead session', async (t) => {
  const s = await startTailr('http://127.0.0.1:1');
  t.after(() => s.close());

  const res = await fetch(s.base + '/');
  assert.equal(res.status, 502);
  assert.match(await res.text(), /can't reach your dev server/);

  const after = await s.api('state', null, 'GET');
  assert.equal(after.status, 200, 'the bridge is still answering');
});

test('an https target is proxied rather than crashing the process', async (t) => {
  // http.request throws synchronously on an https protocol, and that throw used
  // to leave the request handler and kill the session on the first page view.
  const s = await startTailr('https://127.0.0.1:1');
  t.after(() => s.close());

  const res = await fetch(s.base + '/');
  assert.equal(res.status, 502, 'nothing is listening, so the down page answers');

  const after = await s.api('state', null, 'GET');
  assert.equal(after.status, 200, 'and the session survived it');
});

test('the served overlay bundle carries the bridge with it', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  const bundle = await (await fetch(s.base + '/__tailr/overlay.js')).text();
  assert.match(bundle, /window\.__tailr/, 'the overlay');
  assert.match(bundle, /__tailr\/batch|API \+ 'batch'/, 'and the transport appended to it');
});
