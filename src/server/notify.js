/* Waking the agent when Send is pressed.
 *
 * `tailr wait` is the notification on any agent whose client can tell the model
 * that a background process exited. Codex has no such channel: a backgrounded
 * `wait` exits into nothing, and the MCP `tailr_wait` gives up after a minute
 * and ends the turn. The session then sits idle and only the reviewer can
 * restart it — which is the one thing Tailr promises they will never have to do.
 *
 * So for those agents the direction inverts: instead of the agent waiting on
 * Tailr, Tailr pokes the agent. That is what a notify command is. Tailr runs
 * exactly one, it is either given on the command line or comes from a preset
 * for an agent Tailr can see it is running inside, and it fires once per batch.
 */
import { execFileSync, spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/* Thread ids are interpolated into a command line, so they are checked rather
   than trusted — the environment is not ours, and a value with a quote in it
   would be an injection rather than a typo. */
const THREAD = /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/;

/** What the agent is told. It has to work as the first thing in a fresh turn,
 *  because on Codex that is exactly what it is: the rules in AGENTS.md say what
 *  the loop is, so this only has to say that there is one to run and that
 *  nobody needs asking first. */
export function message(count) {
  const marks = `${count} mark${count === 1 ? '' : 's'}`;
  return `Tailr: the reviewer pressed Send and a batch of ${marks} is waiting. ` +
    `Run the review loop now — pull the batch, apply each mark, report each one with ` +
    `progress as it lands, then close the run with done. Don't ask whether to start; ` +
    `they are watching the marks clear on the page.`;
}

/** The agent Tailr can see it was started from, if it is one we can wake.
 *  Codex exports its thread id into every command the agent runs, which is the
 *  same id `codex queue --thread` takes — so a session the agent started knows
 *  how to reach it without anyone being asked. */
export function detect(env = process.env) {
  const thread = env.CODEX_THREAD_ID || env.CODEX_SESSION_ID;
  if (thread && THREAD.test(thread)) return { agent: 'codex', thread };
  return null;
}

/** Resolve what will run on Send, or null if nothing will.
 *  @returns {{agent:string, thread:string|null, command:string|null, label:string}|null}
 */
export function resolve({ explicit = null, disabled = false, env = process.env } = {}) {
  if (disabled) return null;
  const command = explicit || env.TAILR_NOTIFY || null;
  const found = detect(env);
  if (command) {
    return {
      agent: found ? found.agent : 'custom',
      thread: found ? found.thread : null,
      command,
      label: command.length > 60 ? command.slice(0, 57) + '…' : command
    };
  }
  if (found && found.agent === 'codex') {
    return {
      agent: 'codex',
      thread: found.thread,
      command: null,                       // built per batch, as argv — no shell
      label: `codex thread ${found.thread.slice(0, 8)}…`
    };
  }
  return null;
}

/** The thread the agent is on *now*, when that is not the one being held.
 *
 *  A thread id is only good until the reviewer clears the conversation: Codex
 *  starts a new thread for a cleared session and does not record it anywhere
 *  until something is sent to it, so the id Tailr captured at startup silently
 *  stops being anyone. It cannot be looked up — but every command the agent
 *  runs carries the current one, so the agent's own calls are what correct it.
 *
 *  @returns {{agent:string, thread:string}|null}
 */
export function drift(spec, env = process.env) {
  const found = detect(env);
  if (!found) return null;
  if (spec && spec.thread === found.thread) return null;
  return found;
}

/** Point an existing notify at a different thread, or start one for a session
 *  that had nobody to wake until the agent turned up. `--no-notify` is the one
 *  thing this will not undo. */
export function rebind(spec, { thread, agent = 'codex' } = {}, { disabled = false } = {}) {
  if (disabled || !thread || !THREAD.test(thread)) return spec;
  const label = `${agent} thread ${thread.slice(0, 8)}…`;
  if (!spec) return { agent, thread, command: null, label };
  // A command the reviewer gave keeps its own label; only what it aims at moves.
  return { ...spec, thread, label: spec.command ? spec.label : label };
}

/* ── is the thread we hold still the conversation on screen? ──
 *
 * Clearing a Codex conversation starts a new thread, but does not stop the old
 * one: it stays alive on the local app-server daemon and still runs anything
 * queued to it. So a stale binding is not a wake that goes nowhere — it is an
 * agent editing the reviewer's repository where they cannot see it. That is
 * worse than not waking at all, and it is the one outcome this must prevent.
 *
 * A cleared conversation cannot be discovered, but it can be *noticed*: Codex
 * records every thread with the directory it belongs to, and a thread created
 * after ours in the same directory means the conversation moved on. `created_at`
 * is the field to compare — `updated_at` is bumped by the very queueing whose
 * safety is in question, so a dead thread looks fresher every time it is wrong.
 */

/** Codex's thread store. Its name carries a schema number, so this finds the
 *  newest rather than assuming one, and gives up quietly if the shape changes. */
export function codexStore(home = homedir()) {
  try {
    const dir = join(home, '.codex');
    const found = readdirSync(dir)
      .filter((f) => /^state_\d+\.sqlite$/.test(f))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    return found.length ? join(dir, found[found.length - 1]) : null;
  } catch { return null; }
}

/** Every thread Codex knows, as { id, createdAt, cwd }. Read through the
 *  sqlite3 CLI so Tailr keeps its promise of no dependencies; a machine without
 *  it simply cannot answer the question. */
export function readThreads(db = codexStore()) {
  if (!db) return null;
  try {
    const out = execFileSync('sqlite3', [db, '-separator', '\u0001',
      'SELECT id, created_at, cwd FROM threads;'],
      { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').filter(Boolean).map((line) => {
      const [id, createdAt, cwd] = line.split('\u0001');
      return { id, createdAt: Number(createdAt), cwd };
    });
  } catch { return null; }
}

/** The thread that replaced this one, if the conversation has moved on.
 *  null means it has not; null is also what an unanswerable question returns,
 *  so callers must treat "cannot tell" and "still current" the same way. */
export function supersededBy(thread, cwd, rows) {
  if (!rows || !thread) return null;
  const mine = rows.find((r) => r.id === thread);
  if (!mine) return null;
  const newer = rows
    .filter((r) => r.cwd === cwd && r.id !== thread && r.createdAt > mine.createdAt)
    .sort((a, b) => b.createdAt - a.createdAt);
  return newer.length ? newer[0].id : null;
}

/** Whether it is safe to wake this spec from this directory. */
export function stale(spec, cwd, rows = undefined) {
  // A command the reviewer wrote is theirs to aim; only the preset, which aims
  // itself at a thread Tailr sniffed, can go stale without anyone noticing.
  if (!spec || spec.command || !spec.thread) return null;
  return supersededBy(spec.thread, cwd, rows === undefined ? readThreads() : rows);
}

function fill(template, ctx) {
  return template.replace(/%([ntu%])/g, (_, k) =>
    k === 'n' ? String(ctx.count)
      : k === 't' ? (ctx.thread || '')
      : k === 'u' ? ctx.url
      : '%');
}

/** Fire the notify for one batch. Never throws and never blocks the response:
 *  a batch that is waiting is waiting whether or not the agent could be woken,
 *  and the reviewer's Send must not fail because a command did.
 *
 *  @param spec  from resolve()
 *  @param ctx   { count, url, thread }
 *  @param log   called with a one-line report, for the terminal
 */
export function fire(spec, ctx, log = () => {}) {
  if (!spec) return null;
  const detail = { ...ctx, thread: ctx.thread || spec.thread || null };
  /* What the terminal is told ran. A custom command is shown filled in rather
     than as its template, so a notify that fails says what actually failed. */
  const filled = spec.command ? fill(spec.command, detail) : null;
  const shown = filled ? (filled.length > 60 ? filled.slice(0, 57) + '…' : filled) : spec.label;
  let child;
  try {
    if (spec.command) {
      child = spawn(filled, {
        shell: true, stdio: 'ignore', detached: true, windowsHide: true
      });
    } else {
      // The preset builds argv itself, so nothing the message contains can be
      // read as shell syntax.
      child = spawn('codex',
        ['queue', '--thread', detail.thread, '--message', message(detail.count)],
        { stdio: 'ignore', detached: true, windowsHide: true });
    }
  } catch (err) {
    log(`could not wake ${shown} — ${err.message}`);
    return null;
  }
  child.on('error', (err) => log(`could not wake ${shown} — ${err.message}`));
  child.on('exit', (code) => {
    if (code === 0) log(`woke ${shown}`);
    else log(`could not wake ${shown} — exited ${code}`);
  });
  child.unref();
  return child;
}
