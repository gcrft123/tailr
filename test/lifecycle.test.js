/* `tailr start` must leave a session that survives the parent process group
   dying — that is the failure OpenCode hit in Issue #19. `tailr stop` is the
   matching teardown, and agent rules must not name session.json. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rulesBlock } from '../src/setup/rules.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'bin', 'tailr.js');

function run(args, { cwd = ROOT, timeout = 10000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { err += c; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve({ code: -1, out, err, timedOut: true }); }, timeout);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 0, out, err, timedOut: false });
    });
  });
}

async function stopQuiet() {
  await run(['stop', '--port', '44101'], { timeout: 5000 });
}

test('agent rules never name session.json and tell agents to use start', () => {
  const rules = rulesBlock({ mcp: true });
  assert.doesNotMatch(rules, /session\.json/);
  assert.match(rules, /tailr start --target/);
  assert.match(rules, /tailr_start/);
  assert.match(rules, /touch files under `\.tailr\/`/);
  assert.match(rules, /Do not create, edit, or delete anything under `\.tailr\/`/);
});

test('start detaches: parent exits, session survives process-group SIGTERM of a sibling shell', async (t) => {
  await stopQuiet();
  t.after(async () => { await run(['stop']); });

  const started = await run(['start', '--target', 'http://127.0.0.1:59999', '--port', '44101']);
  assert.equal(started.code, 0, started.err || started.out);
  assert.match(started.out, /Tailr is up/);
  assert.match(started.out, /http:\/\/localhost:44101/);

  const sessionPath = join(ROOT, '.tailr', 'session.json');
  assert.ok(existsSync(sessionPath), 'session registered');
  const session = JSON.parse(readFileSync(sessionPath, 'utf8'));
  assert.equal(session.port, 44101);

  // Simulate an agent tool runner killing its own process group — must not
  // take the detached Tailr with it.
  await new Promise((resolve, reject) => {
    const shell = spawn('bash', ['-c', 'sleep 30'], {
      cwd: ROOT,
      start_new_session: true,
      stdio: 'ignore'
    });
    setTimeout(() => {
      try { process.kill(-shell.pid, 'SIGTERM'); } catch {}
      setTimeout(resolve, 300);
    }, 100);
    shell.on('error', reject);
  });

  try { process.kill(session.pid, 0); }
  catch { assert.fail('detached Tailr died when an unrelated process group was killed'); }

  // SIGHUP must not stop it either (terminal hangup / Issue #19).
  process.kill(session.pid, 'SIGHUP');
  await new Promise((r) => setTimeout(r, 200));
  try { process.kill(session.pid, 0); }
  catch { assert.fail('Tailr exited on SIGHUP'); }

  const status = await run(['status']);
  assert.notEqual(status.code, 2, 'status still finds the session: ' + status.err);

  const stopped = await run(['stop']);
  assert.equal(stopped.code, 0);
  assert.match(stopped.out, /Tailr stopped/);
  try { process.kill(session.pid, 0); assert.fail('still alive after stop'); }
  catch { /* expected */ }
});

test('start is idempotent when a session is already up', async (t) => {
  await stopQuiet();
  t.after(async () => { await run(['stop']); });

  const first = await run(['start', '--target', 'http://127.0.0.1:59999', '--port', '44101']);
  assert.equal(first.code, 0, first.err || first.out);
  const second = await run(['start', '--target', 'http://127.0.0.1:59999', '--port', '44101']);
  assert.equal(second.code, 0, second.err || second.out);
  assert.match(second.out, /already up/);
});
