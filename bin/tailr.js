#!/usr/bin/env node
/* Tailr CLI.
 *
 *   tailr init                 set the project up so the rules stick
 *   tailr demo                 try the whole loop against a sample app
 *   tailr                      proxy http://localhost:3000 on :4100
 *   tailr --target <url>       proxy something else
 *   tailr -- npm run dev       start the dev server too, then proxy it
 *
 * Agent side, run from the same project directory:
 *
 *   tailr status               is a batch waiting?
 *   tailr pull [--wait]        lease the pending batch and print it as JSON
 *   tailr variants <ref> ...   name the versions built for a mark
 *   tailr progress <ref>       one mark applied
 *   tailr done                 the run finished
 *   tailr fail [message]       the run returned incomplete
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/server/server.js';
import { readSession, writeSession, clearSession, isAlive } from '../src/server/session.js';
import { waitForBatch } from '../src/server/watch.js';
import { applyConfig, configFile, describeConfig, modifierLabel, parseSettings, readConfig } from '../src/server/config.js';
import { normalizeTarget } from '../src/server/target.js';

const argv = process.argv.slice(2);
const AGENT = new Set(['status', 'wait', 'pull', 'variants', 'slider', 'progress', 'done', 'fail', 'reset']);

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
} else if (cmd === 'init') {
  const { init } = await import('../src/setup/init.js');
  init({
    install: !args.includes('--no-install'),
    mcp: !args.includes('--no-mcp'),
    file: flag('file', null)
  });
} else if (cmd === 'demo') {
  await demo();
} else if (cmd === 'config') {
  await configure(positional.slice(1));
} else if (AGENT.has(cmd)) await agent(cmd, positional.slice(1));
else await serve();

/* ────────────────────────────────────────────────────────── */

async function serve({ target: only = null, command = null } = {}) {
  const asked = normalizeTarget(only || flag('target', 'http://localhost:3000'));
  if (asked.error) { process.stderr.write(`\n  ${asked.error}\n\n`); process.exit(1); }
  const target = asked.url;
  const port = Number(flag('port', 4100));
  const config = readConfig();
  const app = command || (devCommand && devCommand.length ? devCommand : null);
  let child = null;

  // One session per project: the CLI and the MCP tools find it through
  // .tailr/session.json, which holds exactly one. A second server on another
  // port would overwrite that file and then delete it on its way out, leaving
  // the first one running but unfindable.
  const running = readSession();
  if (running && isAlive(running)) {
    process.stderr.write(`\n  Tailr is already running on ${running.port} — review at ${running.url}\n\n`);
    process.exit(1);
  }

  if (app) {
    child = spawn(app[0], app.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => { shutdown(); process.exit(code ?? 0); });
  }

  const { server } = createServer({
    target,
    // Read once, here. A change made while the session is up arrives over the
    // config endpoint rather than by the server going back to the file.
    config,
    // Whether the dev server is ours to stop decides what the overlay tells the
    // reviewer to do once Tailr is gone.
    spawned: !!child,
    onExit() {
      process.stdout.write('\n  ⌁ the reviewer ended the session. Shutting down.\n\n');
      shutdown();
      server.close();
      process.exit(0);
    },
    onReady(actual) {
      const url = `http://localhost:${actual}`;
      writeSession({ port: actual, url, target, pid: process.pid, startedAt: new Date().toISOString() });
      /* Only one person reads a terminal, and it is not the reviewer — they
         have a browser and nothing else. So this says what to hand them, in
         their words, and then what to do next, in the agent's. And it names
         the key they will actually be holding rather than the default. */
      process.stdout.write(
        `\n  Tailr is up.\n\n` +
        `    review at   ${url}\n` +
        `    proxying    ${target}\n\n` +
        `  Hand the reviewer the review URL, not the dev server's. They hold ` +
        `${modifierLabel(config)} and\n  click to mark the page, then press Send.\n\n` +
        `  Wait for their batch. Its exit is the notification:\n\n` +
        `    tailr wait && tailr pull\n\n`);
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

/* ── the demo ────────────────────────────────────────────── */

/* Somewhere to try the loop that is not the reviewer's own project. Tailr is
   framework-agnostic, so the sample app is a plain page on a plain server —
   which is also the honest thing to hand someone who wants to see what a mark
   looks like before pointing this at work they care about. It ships with the
   package so `npx @gcrft123/tailr demo` needs nothing cloned. */
async function demo() {
  const app = join(dirname(fileURLToPath(import.meta.url)), '..', 'demo', 'serve.js');
  if (!existsSync(app)) {
    process.stderr.write('\n  The sample app is not in this copy of Tailr.\n\n');
    process.exit(1);
  }
  // demo/serve.js reads the same variable, and spawn hands it our environment,
  // so one setting moves both halves.
  const port = Number(process.env.PORT || 8902);
  await serve({ target: `http://127.0.0.1:${port}`, command: [process.execPath, app] });
}

/* ── settings ────────────────────────────────────────────── */

/* The one command that does not need a session. Settings belong to the person,
   so they are written whether or not Tailr is running; a session that is up is
   told as well, so the change lands on the page they are already looking at. */
async function configure(tokens) {
  const report = (config, footer) => process.stdout.write(
    `\n  Tailr settings — ${configFile()}\n\n${describeConfig(config)}\n\n  ${footer}\n\n`);

  if (!tokens.length) {
    return report(readConfig(), 'Change one with:  tailr config sfx:false modifier:cmd');
  }

  const { patch, errors } = parseSettings(tokens);
  if (errors.length) {
    process.stderr.write('\n' + errors.map((e) => `  ${e}`).join('\n') + '\n\n');
    process.exit(1);
  }

  const { config, live } = await applyConfig(patch);
  report(config, live
    ? 'The open review page has them already.'
    : 'They take effect the next time a session starts.');
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
    // `pending` is the only thing that means a batch is waiting. A run stays
    // `working` after it has been leased, so reading the phase would report the
    // agent's own run back to it as new work.
    process.exit(data.pending ? 0 : 3);
  }

  if (cmd === 'wait') {
    // Stays quiet until the reviewer presses Send, then exits. Run it in the
    // background and its exit is the notification: nobody has to be asked
    // whether a batch has arrived, and nothing polls in the meantime.
    const seconds = Number(flag('timeout', 0)) || 0;
    const r = await waitForBatch(session.port, seconds * 1000);
    if (r.waiting) {
      process.stdout.write(JSON.stringify({ waiting: true, run: r.waiting.run }, null, 2) + '\n');
      process.stderr.write(
        `\n  A batch of ${r.waiting.run.total} mark(s) is waiting. Lease it with:  tailr pull\n\n`);
      process.exit(0);
    }
    if (r.timedOut) {
      process.stderr.write(`\n  Nothing sent within ${seconds}s. The session is still up.\n\n`);
      process.exit(3);
    }
    process.stderr.write('\n  The Tailr session ended before a batch was sent.\n\n');
    process.exit(2);
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

  if (cmd === 'variants') {
    const [ref, ...labels] = rest;
    if (!ref || labels.length < 2) {
      process.stderr.write('\n  Usage: tailr variants <ref> "First name" "Second name" [...]\n\n');
      process.exit(1);
    }
    const r = await call('variants', { ref, labels, selector: flag('selector', undefined) });
    return finish(r);
  }

  if (cmd === 'slider') {
    const ref = rest[0];
    const min = flag('min', undefined);
    const max = flag('max', undefined);
    if (!ref || min === undefined || max === undefined) {
      process.stderr.write('\n  Usage: tailr slider <ref> --min <n> --max <n> [--step <n>] [--value <n>] [--label <words>] [--unit <u>]\n\n');
      process.exit(1);
    }
    const step = flag('step', undefined);
    const value = flag('value', undefined);
    const r = await call('slider', {
      ref,
      min: Number(min),
      max: Number(max),
      step: step !== undefined ? Number(step) : undefined,
      value: value !== undefined ? Number(value) : undefined,
      label: flag('label', undefined),
      unit: flag('unit', undefined),
      selector: flag('selector', undefined)
    });
    return finish(r);
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

  Set the project up, once
    tailr init                    install Tailr, write the agent's operating
                                  rules into AGENTS.md / CLAUDE.md, and register
                                  the MCP server. Safe to re-run.
      --no-install                don't touch package.json
      --no-mcp                    don't register the MCP server
      --file <path>               write the rules to this file instead

  Try it first, against a sample app that ships with Tailr
    tailr demo                    start the sample app and proxy it on :4100

  Start a session
    tailr                         proxy http://localhost:3000 on :4100
    tailr --target <url>          proxy a different dev server
    tailr --port <n>              serve Tailr on a different port
    tailr -- npm run dev          start the dev server too, then proxy it

  From your agent, in the same project directory
    tailr status                  is a batch waiting?
    tailr wait [--timeout <s>]    block until one is; run it in the background
                                  and its exit is your notification
    tailr pull [--wait]           lease the pending batch, printed as JSON
    tailr variants <ref> <names>  name the versions you built for a mark that
                                  asked for several, in order
    tailr slider <ref> --min --max
                                  report the continuous parameter you wired for
                                  a mark that asked for a slider
    tailr progress <ref>          one mark applied
    tailr done                    the run finished
    tailr fail [message]          the run returned incomplete

  Settings, which belong to you rather than to a project
    tailr config                  print them and where they live
    tailr config sfx:false        mute the cues Tailr plays
    tailr config modifier:cmd     hold ⌘ to mark instead of ⌥

  Or wire it in as an MCP server
    tailr mcp                     serve the same round trip as MCP tools over stdio

`);
}
