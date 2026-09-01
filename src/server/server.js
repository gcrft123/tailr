/* Tailr local server.
 *
 * It is two things at once:
 *   1. a transparent proxy in front of the user's dev server, injecting the
 *      overlay into HTML responses and passing everything else through
 *      untouched — including the WebSocket upgrade that hot reload rides on;
 *   2. the bridge that holds one batch at a time and lets the agent lease it,
 *      report progress, and close the run.
 *
 * The send lock the product promises is only real because this process exists:
 * it is the single place that knows whether a run is still open.
 */
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OVERLAY = join(HERE, '..', 'overlay', 'tailr.js');
const BRIDGE = join(HERE, '..', 'bridge', 'client.js');

const API = '/__tailr/';

export function createServer({ target, onReady }) {
  const upstream = new URL(target);
  /* A dev server on https is still a dev server, and its certificate is nearly
     always self-signed or locally-minted. Refusing one would make https targets
     unusable for exactly the people who need them, so the proxy accepts what
     the user pointed it at — it is their own machine at the other end. */
  const secure = upstream.protocol === 'https:';
  const transport = secure ? https : http;
  const upstreamPort = Number(upstream.port || (secure ? 443 : 80));

  /* ── run state ─────────────────────────────────────────── */
  const state = {
    batch: null,      // { id, sentAt, marks }  — waiting or in flight
    run: null,        // { id, phase, served:[], total, error, leasedAt }
    seq: 0
  };
  const listeners = new Set();

  function publish() {
    const payload = `data: ${JSON.stringify(publicState())}\n\n`;
    for (const res of listeners) { try { res.write(payload); } catch {} }
  }
  function publicState() {
    return {
      run: state.run && {
        id: state.run.id, phase: state.run.phase, served: state.run.served,
        total: state.run.total, error: state.run.error || null
      },
      pending: !!(state.batch && state.run && state.run.phase === 'working' && !state.run.leasedAt)
    };
  }

  /* ── the overlay, with the bridge appended ─────────────── */
  let bundle = null, bundleStamp = '';
  function overlayBundle() {
    // Cached, but keyed on file mtime so an edit to the overlay is picked up
    // without restarting the session.
    let stamp = '';
    try { stamp = statSync(OVERLAY).mtimeMs + ':' + statSync(BRIDGE).mtimeMs; } catch {}
    if (bundle && stamp === bundleStamp) return bundle;
    bundleStamp = stamp;
    bundle = readFileSync(OVERLAY, 'utf8') + '\n' + readFileSync(BRIDGE, 'utf8');
    return bundle;
  }

  /* ── api ───────────────────────────────────────────────── */
  function json(res, code, body) {
    const s = JSON.stringify(body);
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(s);
  }
  function readBody(req) {
    return new Promise((resolve) => {
      let raw = '';
      req.on('data', (c) => { raw += c; if (raw.length > 4e6) req.destroy(); });
      req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    });
  }

  async function api(req, res, path) {
    if (path === 'overlay.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(overlayBundle());
    }

    if (path === 'events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream', 'cache-control': 'no-store',
        connection: 'keep-alive', 'x-accel-buffering': 'no'
      });
      res.write(`data: ${JSON.stringify(publicState())}\n\n`);
      listeners.add(res);
      const beat = setInterval(() => { try { res.write(': beat\n\n'); } catch {} }, 25000);
      req.on('close', () => { clearInterval(beat); listeners.delete(res); });
      return;
    }

    if (path === 'state') return json(res, 200, publicState());

    if (path === 'batch' && req.method === 'POST') {
      if (state.run && state.run.phase === 'working') {
        return json(res, 409, { error: 'A run is already open. Wait for it to finish.' });
      }
      const body = await readBody(req);
      const marks = Array.isArray(body.marks) ? body.marks : [];
      if (!marks.length) return json(res, 400, { error: 'Empty batch.' });
      state.seq += 1;
      const id = 'r' + state.seq;
      state.batch = { id, sentAt: body.sentAt || new Date().toISOString(), origin: body.origin, marks };
      state.run = { id, phase: 'working', served: [], total: marks.length, leasedAt: null };
      publish();
      process.stdout.write(`\n  ⌁ batch ${id} — ${marks.length} mark${marks.length === 1 ? '' : 's'} waiting. Run: tailr pull\n`);
      return json(res, 200, { id, total: marks.length });
    }

    if (path === 'pull' && req.method === 'POST') {
      if (!state.batch || !state.run || state.run.phase !== 'working') {
        return json(res, 404, { error: 'No batch waiting.' });
      }
      state.run.leasedAt = new Date().toISOString();
      publish();
      return json(res, 200, state.batch);
    }

    if (path === 'progress' && req.method === 'POST') {
      const { ref } = await readBody(req);
      if (!state.run || state.run.phase !== 'working') return json(res, 409, { error: 'No open run.' });
      if (ref && !state.run.served.includes(ref)) state.run.served.push(ref);
      publish();
      return json(res, 200, publicState());
    }

    if ((path === 'done' || path === 'fail') && req.method === 'POST') {
      const body = await readBody(req);
      // A run that is already closed is not an open run. An agent retrying
      // `done` after a dropped connection has to be told that plainly; the
      // alternative is a 500 it cannot tell apart from a real failure.
      if (!state.run || state.run.phase !== 'working') return json(res, 409, { error: 'No open run.' });
      state.run.phase = path === 'done' ? 'done' : 'failed';
      if (path === 'done' && state.batch) {
        // finishing implies everything landed unless the agent said otherwise
        for (const m of state.batch.marks) if (!state.run.served.includes(m.ref)) state.run.served.push(m.ref);
      } else if (path === 'fail' && body.error) state.run.error = String(body.error).slice(0, 300);
      state.batch = null;
      publish();
      process.stdout.write(`  ⌁ run ${state.run.id} ${state.run.phase}\n`);
      return json(res, 200, publicState());
    }

    if (path === 'reset' && req.method === 'POST') {
      state.batch = null; state.run = null; publish();
      return json(res, 200, publicState());
    }

    return json(res, 404, { error: 'Unknown endpoint.' });
  }

  /* ── proxy ─────────────────────────────────────────────── */
  function proxy(req, res) {
    const opts = {
      protocol: upstream.protocol, hostname: upstream.hostname, port: upstreamPort,
      path: req.url, method: req.method,
      rejectUnauthorized: false,
      headers: { ...req.headers, host: upstream.host,
        // ask for plain text so HTML can be rewritten without decompressing
        'accept-encoding': 'identity' }
    };
    const up = transport.request(opts, (ur) => {
      const type = String(ur.headers['content-type'] || '');
      const encoding = String(ur.headers['content-encoding'] || '').toLowerCase();
      const compressed = encoding !== '' && encoding !== 'identity';
      // Only HTML this process can actually read gets rewritten. A dev server
      // that ignores `accept-encoding: identity` and compresses anyway is
      // passed through whole: a page without the overlay beats a page decoded
      // into nonsense.
      if (!type.includes('text/html') || compressed) {
        res.writeHead(ur.statusCode || 502, ur.headers);
        return ur.pipe(res);
      }
      const chunks = [];
      ur.on('data', (c) => chunks.push(c));
      ur.on('end', () => {
        const html = inject(Buffer.concat(chunks).toString('utf8'));
        const headers = { ...ur.headers };
        // The body is being replaced, so every header describing the old one
        // goes with it. A fresh content-length left beside the upstream's
        // `transfer-encoding: chunked` is a response strict clients refuse.
        delete headers['transfer-encoding'];
        delete headers['content-length'];
        headers['content-length'] = Buffer.byteLength(html);
        res.writeHead(ur.statusCode || 200, headers);
        res.end(html);
      });
    });
    up.on('error', (err) => {
      res.writeHead(502, { 'content-type': 'text/html; charset=utf-8' });
      res.end(downPage(target, err));
    });
    req.pipe(up);
  }

  function inject(html) {
    const tag = `<script src="${API}overlay.js" defer></script>`;
    if (html.includes(`${API}overlay.js`)) return html;
    if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}</head>`);
    if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}</body>`);
    return html + tag;
  }

  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    if (url.startsWith(API)) {
      const path = url.slice(API.length).split('?')[0];
      return api(req, res, path).catch(() => json(res, 500, { error: 'Server error.' }));
    }
    // The review URL staying up is the whole job of this process. A proxy that
    // throws synchronously must surface as one dead page, never as a dead
    // session that takes the reviewer's staged markup out of reach.
    try { proxy(req, res); }
    catch (err) {
      res.writeHead(502, { 'content-type': 'text/html; charset=utf-8' });
      res.end(downPage(target, err));
    }
  });

  /* Hot reload rides a WebSocket upgrade; drop it and the dev server the user
     is reviewing stops updating, which would be worse than not proxying at all. */
  server.on('upgrade', (req, socket, head) => {
    const relay = () => {
      const lines = [`${req.method} ${req.url} HTTP/1.1`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const k = req.rawHeaders[i];
        lines.push(`${k}: ${k.toLowerCase() === 'host' ? upstream.host : req.rawHeaders[i + 1]}`);
      }
      up.write(lines.join('\r\n') + '\r\n\r\n');
      if (head && head.length) up.write(head);
      up.pipe(socket); socket.pipe(up);
    };
    const up = secure
      ? tls.connect({ host: upstream.hostname, port: upstreamPort,
                      servername: upstream.hostname, rejectUnauthorized: false }, relay)
      : net.connect(upstreamPort, upstream.hostname, relay);
    up.on('error', () => socket.destroy());
    socket.on('error', () => up.destroy());
  });

  server.on('listening', () => onReady && onReady(server.address().port));
  return { server, state };
}

function downPage(target, err) {
  return `<!doctype html><meta charset="utf-8"><title>Tailr — dev server unreachable</title>
<style>body{font:13px/1.6 ui-sans-serif,-apple-system,system-ui,sans-serif;background:#0B0B0C;color:#FFFFFF;
display:grid;place-items:center;height:100vh;margin:0}main{max-width:34rem;padding:2rem}
code{background:rgba(255, 255, 255, 0.12);padding:2px 6px;border-radius:5px;font-family:ui-monospace,Menlo,monospace}
h1{font-size:19px;margin:0 0 .6rem;letter-spacing:-0.01em}p{color:rgba(255, 255, 255, 0.56);margin:.4rem 0}</style>
<main><h1>Tailr can't reach your dev server</h1>
<p>Nothing is answering at <code>${escapeHtml(target)}</code>.</p>
<p>Start it, then reload this page — Tailr will pick it up. Anything you already marked up is still saved in this browser.</p>
<p style="margin-top:1.2rem;font-size:13px;opacity:.5">${escapeHtml(err && err.code || 'connection failed')}</p></main>`;
}
function escapeHtml(s) { return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }
