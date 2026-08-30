/* Waiting for the reviewer, without asking the agent to poll.
 *
 * The session already publishes its state on an event stream. This is the
 * agent's end of it: one call that stays quiet until a batch is actually
 * waiting, so a run can start the moment Send is pressed rather than the next
 * time somebody thinks to check.
 */

/** Resolves when a batch is waiting, when the wait times out, or when the
 *  session ends underneath us — the caller needs to tell those apart, so each
 *  is a value rather than an exception.
 *
 *  @returns {Promise<{waiting:{run:object}}|{timedOut:true}|{ended:true}>}
 */
export async function waitForBatch(port, timeoutMs) {
  const ctrl = new AbortController();
  let timer = null;
  const timeout = timeoutMs > 0
    ? new Promise((resolve) => {
        timer = setTimeout(() => { ctrl.abort(); resolve({ timedOut: true }); }, timeoutMs);
      })
    : new Promise(() => {});

  const stream = (async () => {
    let res;
    try {
      res = await fetch(`http://127.0.0.1:${port}/__tailr/events`, {
        headers: { accept: 'text/event-stream' }, signal: ctrl.signal
      });
    } catch { return { ended: true }; }
    if (!res.ok || !res.body) return { ended: true };

    // The stream opens with the current state, so a batch that is already
    // waiting is reported at once instead of hanging until the next change.
    let buf = '';
    try {
      for await (const chunk of res.body) {
        buf += Buffer.from(chunk).toString('utf8');
        let cut;
        while ((cut = buf.indexOf('\n\n')) !== -1) {
          const frame = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          const line = frame.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;                       // a heartbeat, not state
          let state;
          try { state = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (state.pending) return { waiting: { run: state.run } };
        }
      }
    } catch { /* aborted, or the session went away mid-stream */ }
    return { ended: true };
  })();

  try {
    return await Promise.race([stream, timeout]);
  } finally {
    clearTimeout(timer);
    ctrl.abort();
  }
}
