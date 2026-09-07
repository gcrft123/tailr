/* The MCP server is the same round trip as the CLI, over stdio. What is worth
   pinning here is the shape a client sees: the handshake, the tool list, and a
   wait that a client's own per-call limit does not quietly kill — it reports
   progress while it lasts, and gives up in a sentence that says to call again. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTailr } from './helpers.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'tailr.js');

/** A project directory that says a session is running on `port` — ours, so
    the pid is alive for as long as the test is. */
function projectWithSession(port) {
  const cwd = mkdtempSync(join(tmpdir(), 'tailr-mcp-'));
  mkdirSync(join(cwd, '.tailr'));
  writeFileSync(join(cwd, '.tailr', 'session.json'), JSON.stringify({
    port, url: `http://localhost:${port}`, target: 'http://localhost:1', pid: process.pid
  }));
  return cwd;
}

function startMcp(cwd, env = {}) {
  const child = spawn(process.execPath, [BIN, 'mcp'], { cwd, env: { ...process.env, ...env } });
  child.stdin.on('error', () => {});           // closing races the child's exit; neither side minds
  const lines = [];
  const waiters = [];
  let buf = '';
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let cut;
    while ((cut = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, cut).trim();
      buf = buf.slice(cut + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      lines.push(msg);
      waiters.splice(0).forEach((w) => w());
    }
  });
  let seq = 0;
  return {
    lines,
    send(method, params, id = ++seq) {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      return id;
    },
    async until(pred, ms = 5000) {
      const deadline = Date.now() + ms;
      for (;;) {
        const hit = lines.find(pred);
        if (hit) return hit;
        if (Date.now() > deadline) throw new Error('nothing matched in time: ' + JSON.stringify(lines));
        await new Promise((r) => { waiters.push(r); setTimeout(r, 50); });
      }
    },
    close() { child.kill(); }
  };
}

test('handshake and tool list', async (t) => {
  const s = await startTailr();
  const mcp = startMcp(projectWithSession(s.port));
  t.after(() => { mcp.close(); return s.close(); });

  const id = mcp.send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  const init = await mcp.until((m) => m.id === id);
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.equal(init.result.serverInfo.name, 'tailr');

  const listId = mcp.send('tools/list');
  const list = await mcp.until((m) => m.id === listId);
  const names = list.result.tools.map((x) => x.name);
  for (const n of ['tailr_status', 'tailr_wait', 'tailr_pull', 'tailr_progress', 'tailr_done', 'tailr_fail', 'tailr_config']) {
    assert.ok(names.includes(n), n);
  }
  const wait = list.result.tools.find((x) => x.name === 'tailr_wait');
  assert.match(wait.inputSchema.properties.timeoutSeconds.description, /Default 55/, 'the default stays under a client’s per-call limit');
});

test('a wait reports progress while it lasts and times out in a sentence that says to call again', async (t) => {
  const s = await startTailr();
  const mcp = startMcp(projectWithSession(s.port), { TAILR_MCP_TICK_MS: '300' });
  t.after(() => { mcp.close(); return s.close(); });

  const id = mcp.send('tools/call', {
    name: 'tailr_wait', arguments: { timeoutSeconds: 1 }, _meta: { progressToken: 'tok-1' }
  });
  const done = await mcp.until((m) => m.id === id, 5000);
  assert.match(done.result.content[0].text, /Nothing sent within 1s.*call tailr_wait again/);

  const ticks = mcp.lines.filter((m) => m.method === 'notifications/progress');
  assert.ok(ticks.length >= 2, `progress was sent while waiting (${ticks.length})`);
  assert.equal(ticks[0].params.progressToken, 'tok-1');
  assert.equal(ticks[0].params.total, 1);
  assert.ok(ticks.every((m) => m.id === undefined), 'notifications carry no id');
});

test('without a progress token nothing is sent but the answer', async (t) => {
  const s = await startTailr();
  const mcp = startMcp(projectWithSession(s.port), { TAILR_MCP_TICK_MS: '200' });
  t.after(() => { mcp.close(); return s.close(); });

  const id = mcp.send('tools/call', { name: 'tailr_wait', arguments: { timeoutSeconds: 1 } });
  await mcp.until((m) => m.id === id, 5000);
  assert.equal(mcp.lines.filter((m) => m.method === 'notifications/progress').length, 0);
});

test('a batch arriving ends the wait at once, with the run in the answer', async (t) => {
  const s = await startTailr();
  const mcp = startMcp(projectWithSession(s.port));
  t.after(() => { mcp.close(); return s.close(); });

  const id = mcp.send('tools/call', { name: 'tailr_wait', arguments: { timeoutSeconds: 30 } });
  await new Promise((r) => setTimeout(r, 200));
  await s.api('batch', { marks: [{ ref: '01', type: 'comment', comment: 'x' }] });
  const done = await mcp.until((m) => m.id === id, 5000);
  const body = JSON.parse(done.result.content[0].text);
  assert.equal(body.waiting, true);
  assert.equal(body.run.total, 1);
});

/* An MCP server is not told which conversation it belongs to: Codex starts one
   per session and passes it no thread id. So it cannot keep a wake aimed at the
   agent when the conversation is cleared, and the one thing that can — a shell
   command, which does carry the id — has to be asked for rather than assumed. */
test('status asks the agent to re-register from the shell, because this process cannot', async (t) => {
  const s = await startTailr(undefined, {
    notify: { agent: 'codex', thread: '01a07c3e-5155-7cb0-b29c-be73b6c3d857', command: null, label: 'codex' }
  });
  const mcp = startMcp(projectWithSession(s.port), { CODEX_THREAD_ID: '' });
  t.after(() => { mcp.close(); return s.close(); });

  const id = mcp.send('tools/call', { name: 'tailr_status', arguments: {} });
  const out = await mcp.until((m) => m.id === id);
  const body = JSON.parse(out.result.content[0].text);
  assert.equal(body.wakesYou, true);
  assert.match(body.reRegister, /npx tailr status/);
});

test('a server that can see the thread itself does not ask', async (t) => {
  const s = await startTailr(undefined, {
    notify: { agent: 'codex', thread: '01a07c3e-5155-7cb0-b29c-be73b6c3d857', command: null, label: 'codex' }
  });
  const mcp = startMcp(projectWithSession(s.port),
    { CODEX_THREAD_ID: '01a07c3e-5155-7cb0-b29c-be73b6c3d857' });
  t.after(() => { mcp.close(); return s.close(); });

  const id = mcp.send('tools/call', { name: 'tailr_status', arguments: {} });
  const out = await mcp.until((m) => m.id === id);
  assert.equal(JSON.parse(out.result.content[0].text).reRegister, undefined);
});
