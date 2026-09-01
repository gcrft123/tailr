/* Scaffolding shared by the suite: a Tailr server on an ephemeral port, and a
   JSON caller for its bridge API. Nothing here talks to a real dev server —
   the default target is a port deliberately left dead, so the proxy's failure
   path is what answers unless a test says otherwise. */
import { createServer } from '../src/server/server.js';

const DEAD = 'http://127.0.0.1:1';

export async function startTailr(target = DEAD) {
  const { server, state } = createServer({ target, onReady() {} });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  return {
    port, base, state, server,

    /** Call the bridge and return status + parsed body. */
    async api(path, body, method = 'POST') {
      const res = await fetch(`${base}/__tailr/${path}`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: res.status, body: json, text };
    },

    async close() {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

/** A stand-in dev server, so the proxy has something real to sit in front of. */
export async function startUpstream(handler) {
  const { createServer: httpServer } = await import('node:http');
  const server = httpServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

export const oneMark = (ref = '01') => ({
  marks: [{ ref, type: 'comment', route: '/', comment: 'make it blue' }]
});

/* `init` narrates what it did on stdout, which is the point of it at a
   terminal and noise under a test reporter. It is fully synchronous, so
   nothing else can write while it is muted. */
export function silently(fn) {
  const write = process.stdout.write;
  const err = process.stderr.write;
  process.stdout.write = () => true;
  process.stderr.write = () => true;
  try { return fn(); } finally { process.stdout.write = write; process.stderr.write = err; }
}
