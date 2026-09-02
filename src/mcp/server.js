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
import { readSession, isAlive } from '../server/session.js';
import { waitForBatch } from '../server/watch.js';

const { version: VERSION } = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'), 'utf8'));

const DEFAULT_PROTOCOL = '2024-11-05';
const SUPPORTED = new Set(['2024-11-05', '2025-03-26', '2025-06-18']);

const TOOLS = [
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
      'reports that nothing arrived in time, the session is still up — call it again.',
    inputSchema: {
      type: 'object',
      properties: {
        timeoutSeconds: { type: 'number', description: 'How long to wait before giving up. Default 300.' }
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
      'described by tailr_variants. A "choice" mark carries variantOf (the ref whose versions are ' +
      'being settled) and variant: keep that version, delete the rest and the switch with them; ' +
      'variant 0 means keep none and put the element back as it was. ' +
      'After pulling you MUST close the run with tailr_done or tailr_fail; until then the reviewer cannot send again.',
    inputSchema: {
      type: 'object',
      properties: {
        wait: { type: 'boolean', description: 'Block until a batch arrives instead of returning immediately.' },
        timeoutSeconds: { type: 'number', description: 'How long to wait when wait is true. Default 120.' }
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
      'No Tailr session is running in this project. Ask the user to start one with `npx tailr --target <their dev server url>`, ' +
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

async function runTool(name, args = {}) {
  if (name === 'tailr_status') {
    const s = session();
    if (!s) {
      return { text: JSON.stringify({ running: false,
        hint: 'No Tailr session. Ask the user to run `npx tailr --target <dev server url>`.' }, null, 2) };
    }
    const r = await call('state', null, 'GET');
    return { text: JSON.stringify({
      running: true, reviewUrl: s.url, proxying: s.target,
      batchWaiting: !!r.data.pending, run: r.data.run
    }, null, 2) };
  }

  if (name === 'tailr_wait') {
    const s = session();
    if (!s) {
      return { text: 'No Tailr session is running. Ask the user to run `npx tailr --target <dev server url>`.',
               isError: true };
    }
    const seconds = Number(args.timeoutSeconds) || 300;
    const r = await waitForBatch(s.port, seconds * 1000);
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
    const deadline = Date.now() + (Number(args.timeoutSeconds) || 120) * 1000;
    for (;;) {
      const r = await call('pull');
      if (r.ok) return { text: JSON.stringify(r.data, null, 2) };
      if (!wait || Date.now() > deadline) {
        return { text: 'No batch is waiting. The reviewer has not pressed Send yet.', isError: false };
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
            'needs tailr_variants, before its progress. The reviewer cannot send another ' +
            'batch until you close the run, and should never have to tell you a batch has arrived — ' +
            'tailr_wait is how you find out.'
        });
      }
      if (method === 'ping') return reply(id, {});
      if (method === 'tools/list') return reply(id, { tools: TOOLS });
      if (method === 'tools/call') {
        const name = params && params.name;
        const out = await runTool(name, (params && params.arguments) || {});
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
