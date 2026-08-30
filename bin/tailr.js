#!/usr/bin/env node
/* Tailr CLI.
 *
 *   tailr                      proxy http://localhost:3000 on :4100
 *   tailr --target <url>       proxy something else
 *   tailr -- npm run dev       start the dev server too, then proxy it
 *
 * Agent side, run from the same project directory:
 *
 *   tailr status               is a batch waiting?
 *   tailr pull [--wait]        lease the pending batch and print it as JSON
 *   tailr progress <ref>       one mark applied
 *   tailr done                 the run finished
 *   tailr fail [message]       the run returned incomplete
 */
import { spawn } from 'node:child_process';
import { createServer } from '../src/server/server.js';
import { readSession, writeSession, clearSession, isAlive } from '../src/server/session.js';

const argv = process.argv.slice(2);
const AGENT = new Set(['status', 'pull', 'progress', 'done', 'fail', 'reset']);

const dashdash = argv.indexOf('--');
const devCommand = dashdash === -1 ? null : argv.slice(dashdash + 1);
const args = dashdash === -1 ? argv : argv.slice(0, dashdash);

function flag(name, fallback) {
  const i = args.indexOf('--' + name);
  return i === -1 ? fallback : args[i + 1];
}
const positional = args.filter((a, i) =>
  !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--wait' && args[i - 1] !== '--open'));

if (args.includes('--help') || args.includes('-h')) { usage(); process.exit(0); }

const cmd = positional[0];
if (cmd === 'mcp') {
  // stdio transport: stdout belongs to JSON-RPC from here on
  const { startMcp } = await import('../src/mcp/server.js');
  startMcp();
} else if (AGENT.has(cmd)) await agent(cmd, positional.slice(1));
else await serve();

/* ────────────────────────────────────────────────────────── */

async function serve() {
  const target = flag('target', 'http://localhost:3000');
  const port = Number(flag('port', 4100));
  let child = null;

  if (devCommand && devCommand.length) {
    child = spawn(devCommand[0], devCommand.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => { shutdown(); process.exit(code ?? 0); });
  }

  const { server } = createServer({
    target,
    onReady(actual) {
      const url = `http://localhost:${actual}`;
      writeSession({ port: actual, url, target, pid: process.pid, startedAt: new Date().toISOString() });
      process.stdout.write(
        `\n  Tailr is up.\n\n` +
        `    review at   ${url}\n` +
        `    proxying    ${target}\n\n` +
        `  Hold Alt and mark the page. When a batch is sent, run:  tailr pull\n\n`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const existing = readSession();
      const mine = existing && isAlive(existing) && existing.port === port;
      process.stderr.write(mine
        ? `\n  Tailr is already running on ${port} — review at ${existing.url}\n\n`
        : `\n  Port ${port} is taken. Pick another with --port.\n\n`);
      process.exit(1);
    }
    process.stderr.write(`\n  ${err.message}\n\n`);
    process.exit(1);
  });
  server.listen(port);

  function shutdown() { clearSession(); if (child && !child.killed) child.kill(); }
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => { shutdown(); process.exit(0); });
  }
  process.on('exit', shutdown);
}

/* ── agent-side commands ─────────────────────────────────── */

async function agent(cmd, rest) {
  const session = readSession();
  if (!session || !isAlive(session)) {
    process.stderr.write('\n  No Tailr session is running in this project. Start one with:  tailr\n\n');
    process.exit(2);
  }
  const base = `http://127.0.0.1:${session.port}/__tailr/`;

  const call = async (path, body, method = 'POST') => {
    const res = await fetch(base + path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  };

  if (cmd === 'status') {
    const { data } = await call('state', null, 'GET');
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    process.exit(data.run && data.run.phase === 'working' ? 0 : 3);
  }

  if (cmd === 'pull') {
    const wait = args.includes('--wait');
    const deadline = Date.now() + 10 * 60 * 1000;
    for (;;) {
      const r = await call('pull');
      if (r.ok) {
        process.stdout.write(JSON.stringify(r.data, null, 2) + '\n');
        process.stderr.write(
          `\n  ${r.data.marks.length} mark(s) leased. As you land each one:  tailr progress <ref>\n` +
          `  Then close the run with:  tailr done   (or: tailr fail "what happened")\n\n`);
        process.exit(0);
      }
      if (!wait || Date.now() > deadline) {
        process.stderr.write('\n  No batch waiting.\n\n');
        process.exit(3);
      }
      await new Promise((r2) => setTimeout(r2, 1000));
    }
  }

  if (cmd === 'progress') {
    const ref = rest[0];
    if (!ref) { process.stderr.write('\n  Usage: tailr progress <ref>\n\n'); process.exit(1); }
    const r = await call('progress', { ref });
    return finish(r);
  }

  if (cmd === 'done') return finish(await call('done'));
  if (cmd === 'fail') return finish(await call('fail', { error: rest.join(' ') }));
  if (cmd === 'reset') return finish(await call('reset'));

  function finish(r) {
    if (!r.ok) { process.stderr.write(`\n  ${r.data.error || 'Request failed.'}\n\n`); process.exit(1); }
    process.stdout.write(JSON.stringify(r.data, null, 2) + '\n');
  }
}

function usage() {
  process.stdout.write(`
  tailr — mark up a running dev server, hand the changes to your agent

  Start a session
    tailr                         proxy http://localhost:3000 on :4100
    tailr --target <url>          proxy a different dev server
    tailr --port <n>              serve Tailr on a different port
    tailr -- npm run dev          start the dev server too, then proxy it

  From your agent, in the same project directory
    tailr status                  is a batch waiting?
    tailr pull [--wait]           lease the pending batch, printed as JSON
    tailr progress <ref>          one mark applied
    tailr done                    the run finished
    tailr fail [message]          the run returned incomplete

  Or wire it in as an MCP server
    tailr mcp                     serve the same round trip as MCP tools over stdio

`);
}
