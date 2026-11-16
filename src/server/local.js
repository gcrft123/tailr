/* The agent side's line to the session on this machine.
 *
 * Every agent command is a fresh process that makes one or two calls to the
 * Tailr server and exits, so what it costs to start matters more than anything
 * a client could do once running. Loading `fetch` costs about 13ms and
 * `node:http` about as much again, against 3ms for `node:net`. The only server
 * these calls reach is Tailr's own, so a plain HTTP/1.0 request is enough:
 * the server answers it without chunking and closes the socket when it has
 * finished, which is how the end of the body is found.
 */
import { connect } from 'node:net';

function open(port, path, { method = 'GET', body, accept } = {}) {
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
  const socket = connect(port, '127.0.0.1');
  let head = `${method} /__tailr/${path} HTTP/1.0\r\nHost: 127.0.0.1:${port}\r\n`;
  if (accept) head += `Accept: ${accept}\r\n`;
  if (payload) head += `Content-Type: application/json\r\nContent-Length: ${payload.length}\r\n`;
  else if (method !== 'GET') head += 'Content-Length: 0\r\n';
  socket.write(head + '\r\n');
  if (payload) socket.write(payload);
  return socket;
}

/** One call to the session's API, with the parsed JSON body. A connection
 *  that fails is thrown, as `fetch` would; a status that is not 2xx is not.
 *  @returns {Promise<{ok:boolean, status:number, data:object}>} */
export function call(port, path, { method = 'POST', body } = {}) {
  return new Promise((resolve, reject) => {
    const socket = open(port, path, { method, body });
    const chunks = [];
    socket.on('data', (c) => chunks.push(c));
    socket.on('error', reject);
    socket.on('end', () => {
      const raw = Buffer.concat(chunks);
      const cut = raw.indexOf('\r\n\r\n');
      if (cut === -1) return reject(new Error('Malformed response from the Tailr server.'));
      const status = Number(raw.toString('latin1', 0, raw.indexOf('\r\n')).split(' ')[1]) || 0;
      let data = {};
      try { data = JSON.parse(raw.toString('utf8', cut + 4)); } catch {}
      resolve({ ok: status >= 200 && status < 300, status, data });
    });
  });
}

/** The session's event stream, as one state object per frame. `onState`
 *  returns true to stop listening. Resolves true if it was stopped that way,
 *  false if the stream ended or never opened.
 *  @returns {{done: Promise<boolean>, close: () => void}} */
export function events(port, onState) {
  const socket = open(port, 'events', { accept: 'text/event-stream' });
  const done = new Promise((resolve) => {
    let buf = '', headed = false, settled = false;
    const finish = (value) => { if (!settled) { settled = true; socket.destroy(); resolve(value); } };
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      buf += chunk;
      if (!headed) {
        const cut = buf.indexOf('\r\n\r\n');
        if (cut === -1) return;
        const status = Number(buf.slice(0, buf.indexOf('\r\n')).split(' ')[1]);
        if (status !== 200) return finish(false);
        headed = true;
        buf = buf.slice(cut + 4);
      }
      let cut;
      while ((cut = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        const line = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;                       // a heartbeat, not state
        let state;
        try { state = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (onState(state)) return finish(true);
      }
    });
    socket.on('error', () => finish(false));
    socket.on('close', () => finish(false));
  });
  return { done, close: () => socket.destroy() };
}
