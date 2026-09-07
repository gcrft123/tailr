/* Start and stop a Tailr session without tying it to an agent shell.
 *
 * `tailr` (bare) still serves in the foreground for a human at a terminal.
 * Agents call `start`, which spawns a detached child, waits until that child
 * has registered itself, prints the review URL, and exits — so the parent's
 * process group can die without taking the session with it. `stop` is the
 * matching teardown.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { readSession, isAlive, forceClearSession } from './session.js';

const READY_MS = 15_000;
const STOP_MS = 5_000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** @returns {{ running: true, session: object } | { running: false }} */
export function currentSession() {
  const session = readSession();
  if (session && isAlive(session)) return { running: true, session };
  return { running: false };
}

/**
 * Spawn a detached Tailr serve process and wait until it is findable.
 * @param {{ bin: string, args: string[], cwd?: string, env?: NodeJS.ProcessEnv }} opts
 *   `args` are the CLI args the child should see (no `start` / `stop` verb).
 */
export async function startDetached({ bin, args, cwd = process.cwd(), env = process.env }) {
  const existing = currentSession();
  if (existing.running) {
    return { ok: true, already: true, session: existing.session };
  }

  // A dead pid left the locator behind; serve would overwrite it, but clear
  // first so a wait loop cannot briefly treat the stale file as ready.
  forceClearSession();

  mkdirSync(join(cwd, '.tailr'), { recursive: true });
  const logPath = join(cwd, '.tailr', 'server.log');
  const logFd = openSync(logPath, 'a');

  const child = spawn(process.execPath, [bin, ...args], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    cwd,
    env: { ...env, TAILR_DETACHED: '1' },
    windowsHide: true
  });
  closeSync(logFd);

  let exitCode = null;
  child.once('exit', (code, signal) => { exitCode = signal ? `signal:${signal}` : code; });
  child.once('error', (err) => { exitCode = `error:${err.message}`; });
  child.unref();

  const deadline = Date.now() + READY_MS;
  while (Date.now() < deadline) {
    if (exitCode !== null) {
      return {
        ok: false,
        error: `Tailr exited before it was ready (${exitCode}). See .tailr/server.log.`
      };
    }
    const session = readSession();
    if (session && session.pid === child.pid && isAlive(session)) {
      return { ok: true, already: false, session };
    }
    await sleep(40);
  }

  try { process.kill(child.pid, 'SIGTERM'); } catch {}
  return { ok: false, error: 'Tailr did not become ready in time. See .tailr/server.log.' };
}

/** Stop the project's session, if any. Idempotent. */
export async function stopSession() {
  const session = readSession();
  if (!session) {
    return { ok: true, stopped: false, reason: 'none' };
  }
  if (!isAlive(session)) {
    forceClearSession();
    return { ok: true, stopped: false, reason: 'stale' };
  }

  const { pid, port, url } = session;
  try { process.kill(pid, 'SIGTERM'); } catch {}

  const deadline = Date.now() + STOP_MS;
  while (Date.now() < deadline) {
    if (!isAlive({ pid })) break;
    await sleep(40);
  }
  if (isAlive({ pid })) {
    try { process.kill(pid, 'SIGKILL'); } catch {}
    await sleep(100);
  }
  forceClearSession();

  return { ok: true, stopped: true, session: { pid, port, url } };
}
