/* Waking the agent is the whole handoff on any client that cannot report a
   background process exiting — if it does not fire, the reviewer is back to
   telling their agent that they pressed Send, which is the one thing Tailr
   exists to stop. So: that it fires, that it fires once, that it cannot be
   turned into a shell injection by the environment it read the thread id from,
   and that a command that fails takes nothing down with it. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTailr } from './helpers.js';
import { detect, drift, fire, message, rebind, resolve } from '../src/server/notify.js';

const THREAD = '01a07c3e-5155-7cb0-b29c-be73b6c3d857';

/** Poll for a file a detached notify command was asked to write. */
async function appears(path, ms = 4000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (existsSync(path)) return readFileSync(path, 'utf8').trim();
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

/* ── who Tailr can see it is running inside ──────────────── */

test('a Codex thread id in the environment is what Tailr wakes', () => {
  assert.deepEqual(detect({ CODEX_THREAD_ID: THREAD }), { agent: 'codex', thread: THREAD });
  // Older Codex builds export only the session id, under the same value.
  assert.deepEqual(detect({ CODEX_SESSION_ID: THREAD }), { agent: 'codex', thread: THREAD });
});

test('an environment with no agent in it wakes nothing', () => {
  assert.equal(detect({}), null);
  assert.equal(resolve({ env: {} }), null);
});

test('a thread id that is not one is refused rather than interpolated', () => {
  // The environment is not ours. A value with shell syntax in it must never
  // reach a command line, so it fails the shape check and Tailr wakes nothing.
  for (const bad of ['x"; rm -rf /; echo "', '$(whoami)', '`id`', 'a b', '', 'short']) {
    assert.equal(detect({ CODEX_THREAD_ID: bad }), null, `refused: ${bad}`);
  }
});

/* ── what will run ───────────────────────────────────────── */

test('an explicit command wins over the preset, and TAILR_NOTIFY is one', () => {
  const explicit = resolve({ explicit: 'say-hi', env: { CODEX_THREAD_ID: THREAD } });
  assert.equal(explicit.command, 'say-hi');
  assert.equal(explicit.thread, THREAD, 'a custom command still gets %t to aim with');

  assert.equal(resolve({ env: { TAILR_NOTIFY: 'from-env' } }).command, 'from-env');
});

test('the preset carries no command, so nothing it sends goes through a shell', () => {
  const spec = resolve({ env: { CODEX_THREAD_ID: THREAD } });
  assert.equal(spec.agent, 'codex');
  assert.equal(spec.command, null);
  assert.match(spec.label, /^codex thread 01a07c3e/);
});

test('--no-notify means nothing runs, however much there is to run', () => {
  assert.equal(resolve({ disabled: true, explicit: 'x', env: { CODEX_THREAD_ID: THREAD } }), null);
});

test('the message names the count, and counts one mark as one', () => {
  assert.match(message(3), /batch of 3 marks is waiting/);
  assert.match(message(1), /batch of 1 mark is waiting/);
  assert.doesNotMatch(message(1), /1 marks/);
});

/* ── firing it ───────────────────────────────────────────── */

test('the placeholders are filled with the batch, the thread and the URL', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tailr-notify-'));
  const out = join(dir, 'fired');
  fire({ agent: 'custom', thread: THREAD, command: `echo '%n|%t|%u|%%' > ${out}`, label: 'test' },
    { count: 4, url: 'http://localhost:4100', thread: THREAD });
  assert.equal(await appears(out), `4|${THREAD}|http://localhost:4100|%`);
});

test('a notify that cannot run reports what actually ran, and throws nothing', async () => {
  const said = [];
  fire({ agent: 'custom', command: 'exit %n', label: 'template' }, { count: 7, url: 'u' }, (l) => said.push(l));
  const deadline = Date.now() + 4000;
  while (!said.length && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25));
  // Filled in, not the template it came from — otherwise the line names a
  // command nobody ran.
  assert.match(said.join(' '), /could not wake exit 7 — exited 7/);
});

test('nothing to wake is not an error', () => {
  assert.equal(fire(null, { count: 1, url: 'u' }), null);
});

/* ── the server end ──────────────────────────────────────── */

test('pressing Send wakes the agent, once, with the batch size', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'tailr-notify-'));
  const out = join(dir, 'woken');
  const tailr = await startTailr(undefined, {
    notify: { agent: 'custom', command: `printf '%n' >> ${out}`, label: 'test' }
  });
  t.after(() => tailr.close());

  const sent = await tailr.api('batch', { marks: [{ ref: '01' }, { ref: '02' }] });
  assert.equal(sent.status, 200);
  assert.equal(await appears(out), '2', 'the agent is told how many marks are waiting');

  // A second Send while the run is still open is refused, so it must not wake
  // the agent a second time — it would be told about a batch it already has.
  const again = await tailr.api('batch', { marks: [{ ref: '03' }] });
  assert.equal(again.status, 409);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(readFileSync(out, 'utf8').trim(), '2', 'the refused Send woke nobody');
});

test('with nothing to wake, a batch still lands', async (t) => {
  const tailr = await startTailr();
  t.after(() => tailr.close());
  const sent = await tailr.api('batch', { marks: [{ ref: '01' }] });
  assert.equal(sent.status, 200);
  assert.equal(sent.body.total, 1);
});

/* ── surviving a cleared conversation ────────────────────── */

const MOVED = '01a07c51-a5f1-70c1-a6d7-00372fcbe533';

test('a thread that has moved is spotted; one that has not is left alone', () => {
  const spec = resolve({ env: { CODEX_THREAD_ID: THREAD } });
  assert.equal(drift(spec, { CODEX_THREAD_ID: THREAD }), null, 'same thread, nothing to do');
  assert.deepEqual(drift(spec, { CODEX_THREAD_ID: MOVED }), { agent: 'codex', thread: MOVED });
  assert.equal(drift(spec, {}), null, 'no agent in sight is not a move');
});

test('a session with nobody to wake gains one when the agent turns up', () => {
  // Tailr started in the reviewer's own terminal knows no thread. The agent's
  // first command is where it learns one.
  assert.deepEqual(drift(null, { CODEX_THREAD_ID: THREAD }), { agent: 'codex', thread: THREAD });
  const bound = rebind(null, { thread: THREAD });
  assert.equal(bound.thread, THREAD);
  assert.equal(bound.command, null);
});

test('rebinding moves what a wake aims at, and keeps a custom command', () => {
  const custom = resolve({ explicit: 'poke %t', env: { CODEX_THREAD_ID: THREAD } });
  const moved = rebind(custom, { thread: MOVED });
  assert.equal(moved.command, 'poke %t', 'the command the reviewer gave is still theirs');
  assert.equal(moved.thread, MOVED, 'but it now aims at the thread the agent is on');
});

test('--no-notify is not undone by an agent registering itself', () => {
  assert.equal(rebind(null, { thread: THREAD }, { disabled: true }), null);
});

test('a thread id off the wire is checked the same as one off the environment', () => {
  const spec = resolve({ env: { CODEX_THREAD_ID: THREAD } });
  assert.equal(rebind(spec, { thread: 'x"; rm -rf /' }).thread, THREAD, 'refused, so nothing moved');
});

test('the agent re-registering changes who Send wakes', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'tailr-notify-'));
  const out = join(dir, 'aimed');
  const tailr = await startTailr(undefined, {
    notify: { agent: 'codex', thread: THREAD, command: `echo '%t' > ${out}`, label: 'test' }
  });
  t.after(() => tailr.close());

  const before = await tailr.api('state', null, 'GET');
  assert.equal(before.body.wakesAgent, true);

  const moved = await tailr.api('notify', { agent: 'codex', thread: MOVED });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.thread, MOVED);

  await tailr.api('batch', { marks: [{ ref: '01' }] });
  assert.equal(await appears(out), MOVED, 'the wake follows the agent, not the id Tailr started with');
});

test('a session started with nothing to wake can be given someone', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'tailr-notify-'));
  const out = join(dir, 'late');
  const tailr = await startTailr();
  t.after(() => tailr.close());

  assert.equal((await tailr.api('state', null, 'GET')).body.wakesAgent, false);
  const bound = await tailr.api('notify', { agent: 'codex', thread: THREAD });
  assert.equal(bound.body.wakesAgent, true, 'the agent turning up is enough');
});
