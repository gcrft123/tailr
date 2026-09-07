/* Tailr MCP server (stdio).
 *
 * Exposes the same round trip the CLI does, as tools an agent can call
 * directly: lease the batch, report each mark as it lands, close the run.
 *
 * stdout is the transport. Nothing may be written to it except JSON-RPC —
 * every diagnostic goes to stderr.
 */
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSession, isAlive, writeSession } from '../server/session.js';
import { startDetached, stopSession } from '../server/lifecycle.js';
import { waitForBatch } from '../server/watch.js';
import { drift } from '../server/notify.js';
import { applyConfig, configFile, describeConfig, KEYS, readConfig, SETTINGS } from '../server/config.js';
import { normalizeTarget } from '../server/target.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = join(ROOT, 'bin', 'tailr.js');
const { version: VERSION } = JSON.parse(
  readFileSync(join(ROOT, 'package.json'), 'utf8'));

const DEFAULT_PROTOCOL = '2024-11-05';
const SUPPORTED = new Set(['2024-11-05', '2025-03-26', '2025-06-18']);

const TOOLS = [
  {
    name: 'tailr_start',
    description:
      'Start a Tailr review session against a running dev server. Detaches inside Tailr and returns ' +
      'once the review URL is ready — do not shell-background `tailr` yourself. Idempotent if a ' +
      'session is already up. Prefer this (or `npx tailr start`) over inventing process management.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Dev server URL to proxy, e.g. http://localhost:5173. Default http://localhost:3000.'
        },
        port: {
          type: 'number',
          description: 'Port for Tailr itself. Default 4100.'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'tailr_stop',
    description:
      'Stop the Tailr review session for this project. Idempotent if none is running. Prefer this ' +
      'over deleting anything under .tailr/.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'tailr_status',
    description:
      'Check whether a Tailr review session is running and whether a batch of marks is waiting. ' +
      'Returns the session URL to send the reviewer to, and the state of any open run. ' +
      'Call this first if you are unsure whether there is work to do.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'tailr_wait',
    description:
      'Block until the reviewer sends a batch, then return. Use this instead of asking them to tell you ' +
      'when they are done, and instead of polling tailr_status: it returns within a moment of Send being ' +
      'pressed, and returns immediately if a batch is already waiting. Follow it with tailr_pull. If it ' +
      'reports that nothing arrived in time, the session is still up — call it again. Keep timeoutSeconds ' +
      'under your client\'s own per-call limit; the default does.',
    inputSchema: {
      type: 'object',
      properties: {
        timeoutSeconds: {
          type: 'number',
          description: 'How long to wait before giving up. Default 55, which stays inside the per-call limit ' +
            'most MCP clients enforce (often 60s). A timeout is normal, not a failure: call this again.'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'tailr_pull',
    description:
      'Lease the pending batch of marks and return it. Each mark has a ref (like "01"), a type ' +
      '(comment | remove | text | point), the route it was made on, a best-effort source ' +
      'address, a CSS selector, the element\'s text, and the reviewer\'s comment. A "text" mark carries ' +
      'before/after. A "point" mark carries page x/y instead of an element and means the reviewer marked a '  +
      'place rather than a thing — asking for something new there, or noting the spot; the comment says which. ' +
      'A mark with orphaned:true ' +
      'lost its element before the batch was sent — raise it with the reviewer rather than guessing. ' +
      'A mark with variations:n asks for n versions of that one change, built behind the switch ' +
      'described by tailr_variants. A mark with slider:true asks for a continuous numerical ' +
      'parameter (glow, depth, scale…) wired behind the switch described by tailr_slider. ' +
      'A "choice" mark carries variantOf (the ref whose versions are ' +
      'being settled) and variant: keep that version, delete the rest and the switch with them; ' +
      'variant 0 means keep none and put the element back as it was. A choice that settles a ' +
      'slider carries sliderOf and value instead (value null means discard the slider). ' +
      'After pulling you MUST close the run with tailr_done or tailr_fail; until then the reviewer cannot send again.',
    inputSchema: {
      type: 'object',
      properties: {
        wait: { type: 'boolean', description: 'Block until a batch arrives instead of returning immediately.' },
        timeoutSeconds: { type: 'number', description: 'How long to wait when wait is true. Default 55, for the same reason as tailr_wait.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'tailr_variants',
    description:
      'Report the versions you built for a mark that asked for variations, and name each one. ' +
      'Build every version into the source at once, each guarded on the switch Tailr sets for that ' +
      'mark: the attribute data-tailr-var-<ref> on the <html> element, whose value is the version ' +
      'number ("1", "2", …). Style-only versions can key straight off it, e.g. ' +
      '[data-tailr-var-03="2"] .card { … }; anything that has to re-render should read ' +
      'document.documentElement.dataset["tailrVar<ref>"] and listen for the "tailr:variant" event ' +
      'on document. Version 1 must also be what renders if the attribute is missing. ' +
      'Labels are what the reviewer chooses between, so make them 1-3 concrete words ' +
      '("Softer edges", "Full width", "Two columns") and give them in version order. ' +
      'Call this BEFORE tailr_progress for the same ref, and always before tailr_done.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The mark the versions belong to, e.g. "03".' },
        labels: {
          type: 'array', items: { type: 'string' },
          description: '1-3 words per version, in order. Two to four of them.'
        },
        selector: {
          type: 'string',
          description: 'Optional. A CSS selector for the element if your change moved it, so the ' +
            'chooser still lands on it after the reviewer reloads.'
        }
      },
      required: ['ref', 'labels'],
      additionalProperties: false
    }
  },
  {
    name: 'tailr_slider',
    description:
      'Report the continuous parameter you wired for a mark that asked for a slider. ' +
      'Build the parameter into the source behind the switch Tailr sets for that mark: the ' +
      'attribute data-tailr-slide-<ref> on the <html> element, whose value is the number. ' +
      'Style-only parameters can key straight off it, e.g. ' +
      '[data-tailr-slide-03] .glow { --intensity: attr(data-tailr-slide-03 number); }; anything that ' +
      'has to re-render should read document.documentElement.dataset["tailrSlide<ref>"] and listen ' +
      'for the "tailr:slide" event on document (detail: { ref, value, label, min, max, unit }). ' +
      'The default value must also be what renders if the attribute is missing. ' +
      'Call this BEFORE tailr_progress for the same ref, and always before tailr_done.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The mark the slider belongs to, e.g. "03".' },
        min: { type: 'number', description: 'Lower bound of the parameter.' },
        max: { type: 'number', description: 'Upper bound of the parameter.' },
        step: { type: 'number', description: 'Optional step size. Defaults to (max-min)/100.' },
        value: { type: 'number', description: 'Optional starting value. Defaults to the midpoint.' },
        label: { type: 'string', description: 'Optional short name, e.g. "Glow" or "Bevel depth".' },
        unit: { type: 'string', description: 'Optional unit shown beside the number, e.g. "px" or "%".' },
        selector: {
          type: 'string',
          description: 'Optional. A CSS selector for the element if your change moved it.'
        }
      },
      required: ['ref', 'min', 'max'],
      additionalProperties: false
    }
  },
  {
    name: 'tailr_progress',
    description:
      'Report that one or more marks have been applied. The reviewer watches each one empty out on their ' +
      'screen as it lands, so report them as you finish them rather than all at once at the end — it is the ' +
      'difference between a tool that looks stuck and one that looks like it is working.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'A single mark reference, e.g. "01".' },
        refs: { type: 'array', items: { type: 'string' }, description: 'Several references at once.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'tailr_done',
    description:
      'Close the run as finished. The reviewer is prompted to reload, and anything they staged while you ' +
      'were working is kept. Any mark you did not explicitly report is counted as applied.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'tailr_config',
    description:
      'Read or change the reviewer\'s Tailr settings. They belong to the person rather than to the ' +
      'project, so they are kept in their home directory and hold across every project and session. ' +
      'Called with no arguments this only reports where they stand — do that first when they ask what ' +
      'their settings are, and do not guess at them. A change is written straight away and pushed to a ' +
      'running session, so it lands on the page they are looking at without a reload; it works with no ' +
      'session running too. Only ever call this because the user asked for it.',
    inputSchema: {
      type: 'object',
      properties: {
        sfx: {
          type: 'boolean',
          description: 'Whether Tailr plays a short sound on each action — a mark made or dropped, a batch sent, a version picked, a run closing. On by default.'
        },
        modifier: {
          type: 'string',
          enum: ['alt', 'ctrl', 'cmd'],
          description: 'The key the reviewer holds to arm marking. "alt" by default; "cmd" is ⌘ on a Mac and the Windows key elsewhere.'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'tailr_fail',
    description:
      'Close the run as incomplete and release the send lock so the reviewer can try again. Say what actually ' +
      'happened — Tailr deliberately does not guess at causes, it points the reviewer back to you. Marks you ' +
      'already reported stay applied; the rest return to staged.',
    inputSchema: {
      type: 'object',
      properties: { reason: { type: 'string', description: 'What went wrong, in one line.' } },
      required: ['reason'],
      additionalProperties: false
    }
  }
];

/* ── talking to the running session ──────────────────────── */

function session() {
  const s = readSession();
  if (!s || !isAlive(s)) return null;
  return s;
}

async function call(path, body, method = 'POST') {
  const s = session();
  if (!s) {
    const err = new Error(
      'No Tailr session is running in this project. Start one with `tailr_start` (or `npx tailr start --target <their dev server url>`), ' +
      'then open the URL it prints and mark up the page.');
    err.noSession = true;
    throw err;
  }
  const res = await fetch(`http://127.0.0.1:${s.port}/__tailr/${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data, session: s };
}

/* Most clients give a tool call about a minute. A wait longer than that is not
   patient, it is a request the client has already given up on — so the default
   stays under it, and while a wait lasts the server sends progress, which the
   clients that honour it treat as a reason to keep waiting. */
const WAIT_DEFAULT_SECONDS = 55;
const TICK_MS = Number(process.env.TAILR_MCP_TICK_MS) || 10000;

async function withTicks(promise, notify, seconds) {
  if (!notify) return promise;
  const started = Date.now();
  const timer = setInterval(() => {
    const elapsed = Math.round((Date.now() - started) / 1000);
    notify({ progress: elapsed, total: seconds, message: `Waiting for the reviewer to press Send (${elapsed}s of ${seconds}s).` });
  }, TICK_MS);
  try { return await promise; } finally { clearInterval(timer); }
}

/* The MCP server runs inside the agent too, so it sees the same thing the CLI
   does: which thread the agent is on now. Registering it is what survives a
   cleared conversation. */
async function reregister() {
  const s = session();
  if (!s) return;
  const moved = drift(s.notify);
  if (!moved) return;
  try {
    const res = await fetch(`http://127.0.0.1:${s.port}/__tailr/notify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(moved)
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) writeSession({ ...s, notify: data.thread ? { agent: moved.agent, thread: data.thread } : null });
  } catch { /* the session is going away; the tool call below will say so */ }
}

async function runTool(name, args = {}, notify = null) {
  await reregister();
  if (name === 'tailr_start') {
    const asked = normalizeTarget(args.target || 'http://localhost:3000');
    if (asked.error) return { text: asked.error, isError: true };
    const childArgs = ['--target', asked.url];
    if (args.port != null) childArgs.push('--port', String(args.port));
    const result = await startDetached({ bin: BIN, args: childArgs });
    if (!result.ok) return { text: result.error, isError: true };
    const { session, already } = result;
    return {
      text: JSON.stringify({
        running: true,
        already: !!already,
        reviewUrl: session.url,
        proxying: session.target,
        next: 'Hand the reviewer reviewUrl, then call tailr_wait.'
      }, null, 2)
    };
  }

  if (name === 'tailr_stop') {
    const result = await stopSession();
    return {
      text: JSON.stringify({
        stopped: !!result.stopped,
        reason: result.reason || (result.stopped ? 'stopped' : 'none'),
        was: result.session || null
      }, null, 2)
    };
  }

  if (name === 'tailr_status') {
    const s = session();
    if (!s) {
      return { text: JSON.stringify({ running: false,
        hint: 'No Tailr session. Call tailr_start with the dev server URL.' }, null, 2) };
    }
    const r = await call('state', null, 'GET');
    return { text: JSON.stringify({
      running: true, reviewUrl: s.url, proxying: s.target,
      batchWaiting: !!r.data.pending, run: r.data.run,
      /* True when Tailr wakes the agent itself on Send. Then tailr_wait is not
         needed at all: end the turn, and the next batch arrives as a message. */
      wakesYou: !!r.data.wakesAgent,
      /* A thread id lasts only until the conversation is cleared, and an MCP
         server is not told which conversation it belongs to — Codex starts one
         per session and passes it no thread id. So this process cannot keep the
         wake aimed at the agent; only a command run inside the conversation
         can, because that one carries the id in its environment. Say so rather
         than let a cleared conversation quietly stop being woken. */
      ...(r.data.wakesAgent && !drift(null)
        ? { reRegister: 'Run `npx tailr status` in the shell once now. This MCP server cannot see ' +
            'your conversation\'s thread id, so a shell command is the only thing that can keep Send ' +
            'reaching you after the conversation has been cleared.' }
        : {}),
      // Which key they hold to mark, so telling them is never a guess.
      settings: r.data.config
    }, null, 2) };
  }

  if (name === 'tailr_wait') {
    const s = session();
    if (!s) {
      return { text: 'No Tailr session is running. Call tailr_start with the dev server URL.',
               isError: true };
    }
    const seconds = Number(args.timeoutSeconds) || WAIT_DEFAULT_SECONDS;
    const r = await withTicks(waitForBatch(s.port, seconds * 1000), notify, seconds);
    if (r.waiting) {
      return { text: JSON.stringify({ waiting: true, run: r.waiting.run,
        next: 'Lease it with tailr_pull.' }, null, 2) };
    }
    if (r.timedOut) {
      return { text: `Nothing sent within ${seconds}s. The session is still up — call tailr_wait again.` };
    }
    return { text: 'The Tailr session ended before a batch was sent.', isError: true };
  }

  if (name === 'tailr_pull') {
    const wait = args.wait === true;
    const seconds = Number(args.timeoutSeconds) || WAIT_DEFAULT_SECONDS;
    const deadline = Date.now() + seconds * 1000;
    const started = Date.now();
    for (;;) {
      const r = await call('pull');
      if (r.ok) return { text: JSON.stringify(r.data, null, 2) };
      if (!wait || Date.now() > deadline) {
        return { text: wait
          ? `No batch arrived within ${seconds}s. The session is still up — call tailr_pull with wait again, or tailr_wait.`
          : 'No batch is waiting. The reviewer has not pressed Send yet.', isError: false };
      }
      if (notify) {
        const elapsed = Math.round((Date.now() - started) / 1000);
        if (elapsed > 0 && (elapsed * 1000) % TICK_MS < 1000) notify({ progress: elapsed, total: seconds, message: `Waiting for a batch (${elapsed}s of ${seconds}s).` });
      }
      await new Promise((res) => setTimeout(res, 1000));
    }
  }

  if (name === 'tailr_variants') {
    const labels = Array.isArray(args.labels) ? args.labels : [];
    if (!args.ref || labels.length < 2) {
      return { text: 'Give the mark\'s ref and at least two labels, one per version.', isError: true };
    }
    const r = await call('variants', { ref: String(args.ref), labels, selector: args.selector });
    if (!r.ok) return { text: r.data.error || 'Could not register the versions.', isError: true };
    return { text: `Registered ${labels.length} versions for ${args.ref}. The reviewer picks one ` +
      'on the page after the reload; keeping it comes back as a "choice" mark in a later batch.' };
  }

  if (name === 'tailr_slider') {
    if (!args.ref || args.min == null || args.max == null) {
      return { text: 'Give the mark\'s ref, min, and max.', isError: true };
    }
    const r = await call('slider', {
      ref: String(args.ref),
      min: Number(args.min),
      max: Number(args.max),
      step: args.step != null ? Number(args.step) : undefined,
      value: args.value != null ? Number(args.value) : undefined,
      label: args.label,
      unit: args.unit,
      selector: args.selector
    });
    if (!r.ok) return { text: r.data.error || 'Could not register the slider.', isError: true };
    return { text: `Registered a slider for ${args.ref}. The reviewer scrubs it on the page after ` +
      'the reload; keeping a value comes back as a "choice" mark with sliderOf and value.' };
  }

  /* The one tool that does not need a session: settings are the reviewer's,
     and they must be able to change them before Tailr is ever started. */
  if (name === 'tailr_config') {
    const patch = {};
    const errors = [];
    for (const key of KEYS) {
      if (args[key] === undefined) continue;
      const parsed = SETTINGS[key].parse(args[key]);
      if (parsed.error) errors.push(parsed.error);
      else patch[key] = parsed.value;
    }
    if (errors.length) return { text: errors.join('\n'), isError: true };

    if (!Object.keys(patch).length) {
      return { text: `Tailr settings — ${configFile()}\n\n${describeConfig(readConfig())}` };
    }
    const { config, live } = await applyConfig(patch);
    return { text: `Saved to ${configFile()}.\n\n${describeConfig(config)}\n\n` +
      (live
        ? 'The review page already has them — tell the reviewer, and name what changed.'
        : 'No session is running, so they take effect the next time one starts.') };
  }

  if (name === 'tailr_progress') {
    const refs = args.refs && args.refs.length ? args.refs : (args.ref ? [args.ref] : []);
    if (!refs.length) return { text: 'Give a ref or refs to report.', isError: true };
    let last = null;
    for (const ref of refs) {
      last = await call('progress', { ref: String(ref) });
      if (!last.ok) return { text: last.data.error || 'Could not report progress.', isError: true };
    }
    return { text: JSON.stringify(last.data, null, 2) };
  }

  if (name === 'tailr_done') {
    const r = await call('done');
    if (!r.ok) return { text: r.data.error || 'Could not close the run.', isError: true };
    return { text: 'Run closed. The reviewer has been prompted to reload.\n' + JSON.stringify(r.data, null, 2) };
  }

  if (name === 'tailr_fail') {
    const r = await call('fail', { error: String(args.reason || '').slice(0, 300) });
    if (!r.ok) return { text: r.data.error || 'Could not close the run.', isError: true };
    return { text: 'Run marked incomplete and the send lock released.\n' + JSON.stringify(r.data, null, 2) };
  }

  return { text: `Unknown tool: ${name}`, isError: true };
}

/* ── JSON-RPC over stdio ─────────────────────────────────── */

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function reply(id, result) { send({ jsonrpc: '2.0', id, result }); }
function fail(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

export function startMcp() {
  const rl = createInterface({ input: process.stdin });

  rl.on('line', async (line) => {
    const raw = line.trim();
    if (!raw) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return fail(null, -32700, 'Parse error'); }
    const { id, method, params } = msg;

    // notifications carry no id and expect no response
    if (id === undefined || id === null) return;

    try {
      if (method === 'initialize') {
        const asked = params && params.protocolVersion;
        return reply(id, {
          protocolVersion: SUPPORTED.has(asked) ? asked : DEFAULT_PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'tailr', version: VERSION },
          instructions:
            'Tailr hands you batches of visual markup made by someone reviewing a running dev server. ' +
            'The loop is: tailr_wait until a batch is sent, tailr_pull to lease it, tailr_progress as each ' +
            'mark lands, then tailr_done (or tailr_fail with a reason). A mark asking for variations also ' +
            'needs tailr_variants before its progress; a mark asking for a slider needs tailr_slider. ' +
            'The reviewer cannot send another ' +
            'batch until you close the run, and should never have to tell you a batch has arrived — ' +
            'tailr_wait is how you find out.'
        });
      }
      if (method === 'ping') return reply(id, {});
      if (method === 'tools/list') return reply(id, { tools: TOOLS });
      if (method === 'tools/call') {
        const name = params && params.name;
        const token = params && params._meta && params._meta.progressToken;
        const notify = token === undefined || token === null ? null
          : (p) => send({ jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken: token, ...p } });
        const out = await runTool(name, (params && params.arguments) || {}, notify);
        return reply(id, { content: [{ type: 'text', text: out.text }], isError: !!out.isError });
      }
      return fail(id, -32601, `Method not found: ${method}`);
    } catch (err) {
      // A missing session is an expected, actionable condition, not a crash.
      return reply(id, { content: [{ type: 'text', text: err.message || String(err) }], isError: true });
    }
  });

  rl.on('close', () => process.exit(0));
  process.stderr.write('tailr mcp: ready on stdio\n');
}
