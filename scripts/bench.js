#!/usr/bin/env node
/* Tailr performance benchmark.
 *
 *   node scripts/bench.js                 run every scenario, print medians
 *   node scripts/bench.js --save <file>   also write the results as JSON
 *   node scripts/bench.js --base <file>   compare against a saved run
 *   node scripts/bench.js --only a,b      run only the named scenarios
 *
 * Each scenario reports one time in milliseconds, the median of several
 * rounds; lower is better. The overall score is the geometric mean of
 * base/current across scenarios, so 1.25 means 25% faster overall.
 *
 * The proxy runs as a real `tailr` process in front of a local upstream that
 * answers instantly, so what is timed is Tailr's own overhead. The browser
 * scenario drives headless Chrome over the DevTools protocol and is skipped
 * when Chrome is not installed.
 */
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'bin', 'tailr.js');
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf('--' + name); return i === -1 ? null : argv[i + 1]; };
const only = opt('only') ? new Set(opt('only').split(',')) : null;
const ROUNDS = Number(opt('rounds') || 5);

const CHROME = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'
].find((p) => p && existsSync(p));

/* ── fixtures ───────────────────────────────────────────── */

const ASSET = Buffer.from('export const x = ' + JSON.stringify('a'.repeat(20000)) + ';\n');
function pageHtml(nodes = 400) {
  let body = '';
  for (let i = 0; i < nodes; i++) {
    body += `<div class="card c${i % 7}"><h3>Item ${i}</h3><p>Some text for item ${i}, long enough to wrap a little.</p><button>Open</button></div>\n`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Bench</title>
<style>.card{padding:8px;margin:4px;border:1px solid #ddd;display:inline-block;width:180px}</style>
</head><body><main>${body}</main></body></html>`;
}
const PAGE = Buffer.from(pageHtml());
const PAGE_GZ = gzipSync(PAGE);

function upstream() {
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/asset.js') {
      res.writeHead(200, { 'content-type': 'text/javascript', 'content-length': ASSET.length });
      return res.end(ASSET);
    }
    if (url === '/page.html' || url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': PAGE.length });
      return res.end(PAGE);
    }
    if (url === '/gz.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-encoding': 'gzip', 'content-length': PAGE_GZ.length });
      return res.end(PAGE_GZ);
    }
    if (url === '/stream.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      const step = Math.ceil(PAGE.length / 16);
      for (let i = 0; i < PAGE.length; i += step) res.write(PAGE.subarray(i, i + step));
      return res.end();
    }
    res.writeHead(404); res.end();
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

/* ── tailr under test ───────────────────────────────────── */

async function startTailr(target) {
  const cwd = mkdtempSync(join(tmpdir(), 'tailr-bench-'));
  const home = join(cwd, 'home');
  const port = 40000 + Math.floor(Math.random() * 20000);
  const env = { ...process.env, TAILR_HOME: home, TAILR_NOTIFY: '', CODEX_THREAD_ID: '', CODEX_SESSION_ID: '' };
  const child = spawn(process.execPath, [BIN, '--target', target, '--port', String(port), '--no-notify'],
    { cwd, env, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (c) => { out += c; if (out.includes('Tailr is up')) resolve(); });
    child.on('exit', (code) => reject(new Error('tailr exited ' + code)));
  });
  child.stdout.resume();
  return {
    port, cwd, env,
    async stop() { child.kill('SIGTERM'); await new Promise((r) => child.once('exit', r)); rmSync(cwd, { recursive: true, force: true }); }
  };
}

/* ── load generator ─────────────────────────────────────── */

/* One Node process cannot generate requests as fast as another can proxy
   them, so the load comes from a few worker threads, each holding its share
   of the connections, and the time is the wall time until all have finished. */
const LOADERS = 3;
let pool = null;
function load(port, path, opts) {
  if (!pool) {
    pool = Array.from({ length: LOADERS }, () => {
      const w = new Worker(fileURLToPath(import.meta.url), { argv: ['--loader'] });
      w.unref();
      w.on('error', (err) => { console.error(err); process.exit(1); });
      return w;
    });
  }
  const share = { ...opts, port, path, total: Math.ceil(opts.total / LOADERS), concurrency: Math.ceil(opts.concurrency / LOADERS) };
  const t0 = performance.now();
  return Promise.all(pool.map((w) => new Promise((resolve) => {
    w.once('message', resolve);
    w.postMessage(share);
  }))).then(() => ({ ms: performance.now() - t0 }));
}

function loadHere(port, path, { total, concurrency, headers = {} }) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency });
  let started = 0, finished = 0, bytes = 0;
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const next = () => {
      if (started >= total) return;
      started++;
      const req = http.request({ host: '127.0.0.1', port, path, agent, headers }, (res) => {
        res.on('data', (c) => { bytes += c.length; });
        res.on('end', () => {
          finished++;
          if (finished === total) { agent.destroy(); resolve({ ms: performance.now() - t0, bytes }); }
          else next();
        });
      });
      req.on('error', reject);
      req.end();
    };
    for (let i = 0; i < concurrency; i++) next();
  });
}

function median(xs) { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }

async function rounds(fn, n = ROUNDS) {
  await fn(); // warm
  const xs = [];
  for (let i = 0; i < n; i++) xs.push(await fn());
  return median(xs);
}

/* ── scenarios ──────────────────────────────────────────── */

const scenarios = {
  /* A Vite page asks for hundreds of modules on every load. */
  'proxy-assets': (t) => rounds(async () => (await load(t.port, '/asset.js', { total: 3000, concurrency: 24 })).ms),
  /* Fixed-length HTML, buffered and rewritten. */
  'proxy-html': (t) => rounds(async () => (await load(t.port, '/page.html', { total: 1500, concurrency: 8, headers: { accept: 'text/html' } })).ms),
  /* Gzipped HTML from a dev server that compresses anyway. */
  'proxy-html-gzip': (t) => rounds(async () => (await load(t.port, '/gz.html', { total: 1000, concurrency: 8 })).ms),
  /* Streamed HTML, rewritten on the way past. */
  'proxy-html-stream': (t) => rounds(async () => (await load(t.port, '/stream.html', { total: 1500, concurrency: 8 })).ms),
  /* Every load and hot reload revalidates the overlay. */
  'overlay-304': async (t) => {
    const etag = await new Promise((r) => http.get({ host: '127.0.0.1', port: t.port, path: '/__tailr/overlay.js' }, (res) => { res.resume(); r(res.headers.etag); }));
    return rounds(async () => (await load(t.port, '/__tailr/overlay.js', { total: 4000, concurrency: 16, headers: { 'if-none-match': etag } })).ms);
  },
  /* A first load, or a browser with a cold cache. */
  'overlay-full': (t) => rounds(async () => (await load(t.port, '/__tailr/overlay.js', { total: 1500, concurrency: 8, headers: { 'accept-encoding': 'gzip' } })).ms),
  /* The agent runs one of these per mark. */
  'cli-status': (t) => rounds(async () => {
    const t0 = performance.now();
    try { execFileSync(process.execPath, [BIN, 'status'], { cwd: t.cwd, env: t.env, stdio: 'ignore' }); } catch {}
    return performance.now() - t0;
  }, 9),
  /* An MCP client spawning the server and listing its tools. */
  'mcp-start': (t) => rounds(() => mcpRoundTrip(t), 9),
  /* Page load in a real browser, through the proxy, overlay included. */
  'browser-load': (t) => CHROME ? browserLoad(t) : null
};

function mcpRoundTrip(t) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const child = spawn(process.execPath, [BIN, 'mcp'], { cwd: t.cwd, env: t.env, stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (c) => {
      out += c;
      if (out.includes('"id":2')) { const ms = performance.now() - t0; child.kill(); resolve(ms); }
    });
    child.on('error', reject);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'bench', version: '0' } } }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'tailr_status', arguments: {} } }) + '\n');
  });
}

/* ── headless Chrome over CDP ───────────────────────────── */

async function browserLoad(t) {
  const profile = mkdtempSync(join(tmpdir(), 'tailr-bench-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--window-size=1280,900', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve) => {
    let err = '';
    chrome.stderr.on('data', (c) => { err += c; const m = err.match(/ws:\/\/\S+/); if (m) resolve(m[0]); });
  });
  const browser = await cdp(wsUrl);
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const port = new URL(wsUrl).port;
  const page = await cdp(`ws://127.0.0.1:${port}/devtools/page/${targetId}`);
  await page.send('Page.enable');
  await page.send('Performance.enable');
  await page.send('Runtime.enable');
  // BENCH_DIRECT=1 loads the same page from the upstream, without Tailr, for reference.
  const direct = !!process.env.BENCH_DIRECT;
  const url = `${direct ? t.upstream : `http://127.0.0.1:${t.port}`}/page.html`;
  const ready = direct ? 'true' : `window.__tailr && document.querySelector('[data-tailr]')`;

  /* Timed by the page's own clock, from navigation start to the end of the
     load event, which waits for the deferred overlay to have run. Timing it
     from here instead would end on whichever frame came next, and that
     quantises every result to 16ms. */
  const once = async () => {
    const loaded = page.wait('Page.loadEventFired');
    await page.send('Page.navigate', { url });
    await loaded;
    const r = await page.send('Runtime.evaluate', {
      awaitPromise: true, returnByValue: true,
      expression: `new Promise(r => { const f = () => (${ready}) && performance.getEntriesByType('navigation')[0].loadEventEnd ? r(performance.getEntriesByType('navigation')[0].toJSON()) : setTimeout(f, 5); f(); })`
    });
    const nav = r.result.value;
    if (process.env.BENCH_DEBUG) process.stdout.write(JSON.stringify({ resp: nav.responseEnd, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd, res: (await page.send('Runtime.evaluate', { returnByValue: true, expression: 'performance.getEntriesByType("resource").map(e => [e.name.slice(-12), e.startTime, e.responseEnd, e.transferSize])' })).result.value }) + '\n');
    // Wait out anything the overlay scheduled on mount before reading what it cost.
    await page.send('Runtime.evaluate', { awaitPromise: true, expression: 'new Promise(r => setTimeout(r, 50))' });
    const after = metrics(await page.send('Performance.getMetrics'));
    // A navigation starts a new document, and its counters with it.
    return { ms: nav.loadEventEnd, script: after.ScriptDuration * 1000, task: after.TaskDuration * 1000 };
  };
  try {
    for (let i = 0; i < 3; i++) await once();
    const runs = [];
    for (let i = 0; i < 15; i++) runs.push(await once());
    return {
      ms: median(runs.map((r) => r.ms)),
      script: median(runs.map((r) => r.script)),
      task: median(runs.map((r) => r.task))
    };
  } finally {
    page.close(); browser.close();
    chrome.kill();
    await new Promise((r) => chrome.once('exit', r));
    rmSync(profile, { recursive: true, force: true });
  }
}

function metrics(r) { return Object.fromEntries(r.metrics.map((m) => [m.name, m.value])); }

function cdp(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const waiters = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method && waiters.has(msg.method)) {
      const list = waiters.get(msg.method); waiters.delete(msg.method);
      for (const w of list) w(msg.params);
    }
  };
  return new Promise((resolve) => {
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => { const i = ++id; pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })); });
      },
      wait(method) { return new Promise((r) => { if (!waiters.has(method)) waiters.set(method, []); waiters.get(method).push(r); }); },
      close() { ws.close(); }
    });
  });
}

/* ── run ────────────────────────────────────────────────── */

/* The upstream is a process of its own, as a dev server would be, so it and
   the load generator are not competing for one event loop with each other. */
if (!isMainThread) {
  parentPort.on('message', async (m) => parentPort.postMessage(await loadHere(m.port, m.path, m)));
} else if (argv[0] === '--upstream') {
  const server = await upstream();
  process.stdout.write(server.address().port + '\n');
  process.stdin.resume();
  process.stdin.on('end', () => process.exit(0));
} else await main();

async function main() {
const upChild = spawn(process.execPath, [fileURLToPath(import.meta.url), '--upstream'], { stdio: ['pipe', 'pipe', 'inherit'] });
const upPort = await new Promise((r) => upChild.stdout.once('data', (c) => r(Number(String(c).trim()))));
const origin = `http://127.0.0.1:${upPort}`;
const tailr = { ...await startTailr(origin), upstream: origin };
const results = {};
try {
  for (const [name, fn] of Object.entries(scenarios)) {
    if (only && !only.has(name)) continue;
    const r = await fn(tailr);
    if (r == null) { process.stdout.write(`  ${name.padEnd(18)} skipped\n`); continue; }
    if (typeof r === 'object') {
      results[name] = r.ms;
      results[name + ':script'] = r.script;
      process.stdout.write(`  ${name.padEnd(18)} ${r.ms.toFixed(1)} ms  (script ${r.script.toFixed(1)} ms, task ${r.task.toFixed(1)} ms)\n`);
      continue;
    }
    results[name] = r;
    process.stdout.write(`  ${name.padEnd(18)} ${r.toFixed(1)} ms\n`);
  }
} finally {
  await tailr.stop();
  upChild.kill();
}

if (opt('save')) writeFileSync(opt('save'), JSON.stringify(results, null, 2));
if (opt('base')) {
  const base = JSON.parse(readFileSync(opt('base'), 'utf8'));
  let logSum = 0, n = 0;
  process.stdout.write('\n  scenario           base      now       speedup\n');
  for (const [k, v] of Object.entries(results)) {
    if (!(k in base)) continue;
    const s = base[k] / v;
    // A name with a colon is detail on the scenario before it, not a scenario.
    if (!k.includes(':')) { logSum += Math.log(s); n++; }
    process.stdout.write(`  ${k.padEnd(18)} ${base[k].toFixed(1).padStart(8)}  ${v.toFixed(1).padStart(8)}  ${s.toFixed(2)}x\n`);
  }
  process.stdout.write(`\n  overall            ${Math.exp(logSum / n).toFixed(3)}x (geometric mean of ${n})\n`);
}
process.exit(0);
}
