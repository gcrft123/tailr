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

test('a dev server that compresses anyway still gets the overlay', async (t) => {
  /* Tailr asks for `identity`; plenty of dev servers compress regardless.
     That used to mean a page with no overlay and nothing anywhere saying so,
     which is the worst of the three outcomes available. */
  const { gzipSync, deflateSync, brotliCompressSync } = await import('node:zlib');
  const original = '<html><head></head><body>zipped</body></html>';
  for (const [encoding, compress] of [
    ['gzip', gzipSync], ['deflate', deflateSync], ['br', brotliCompressSync]
  ]) {
    const up = await startUpstream((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': encoding });
      res.end(compress(original));
    });
    const s = await startTailr(up.url);

    const res = await fetch(s.base + '/');
    const page = await res.text();
    assert.match(page, /overlay\.js" defer><\/script><\/head>/, `${encoding} was not injected into`);
    assert.match(page, /zipped<\/body>/, `${encoding} lost the page around the tag`);
    assert.equal(res.headers.get('content-encoding'), null,
      `${encoding} is no longer what the body is in, so it must not still be claimed`);
    assert.equal(Number(res.headers.get('content-length')), Buffer.byteLength(page));

    await s.close();
    await up.close();
  }
});

test('an encoding this Node cannot undo is passed through rather than corrupted', async (t) => {
  // Decoding a body Tailr cannot actually read, and injecting into the result,
  // would hand the reviewer a broken page. Intact and bare is the better half.
  const original = Buffer.from('\u0000\u0001 not really encoded this way \u0002', 'utf8');
  const up = await startUpstream((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'exotic-v9' });
    res.end(original);
  });
  const s = await startTailr(up.url);
  t.after(async () => { await s.close(); await up.close(); });

  const res = await fetch(s.base + '/');
  assert.equal(res.headers.get('content-encoding'), 'exotic-v9', 'still described as it arrived');
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), original, 'byte for byte');
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
  const page = await res.text();
  assert.match(page, /Your dev server stopped answering/);
  /* The reviewer has no terminal. If this page only talked about the dev
     server, a blank screen where the app was reads as Tailr having died too —
     and they would go and restart a session that never stopped. */
  assert.match(page, /Tailr is still running/);
  assert.match(page, /still saved in this browser/);
  assert.match(page, /do not need to start Tailr again/);
  // And it comes back by itself, so getting back costs no knowledge.
  assert.match(page, /location\.reload\(\)/);

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
