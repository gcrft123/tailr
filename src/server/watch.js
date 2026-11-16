/* Waiting for the reviewer, without asking the agent to poll.
 *
 * The session already publishes its state on an event stream. This is the
 * agent's end of it: one call that stays quiet until a batch is actually
 * waiting, so a run can start the moment Send is pressed rather than the next
 * time somebody thinks to check.
 */
import { events } from './local.js';

/** Resolves when a batch is waiting, when the wait times out, or when the
 *  session ends underneath us — the caller needs to tell those apart, so each
 *  is a value rather than an exception.
 *
 *  @returns {Promise<{waiting:{run:object}}|{timedOut:true}|{ended:true}>}
 */
export async function waitForBatch(port, timeoutMs) {
  // The stream opens with the current state, so a batch that is already
  // waiting is reported at once instead of hanging until the next change.
  let waiting = null;
  const stream = events(port, (state) => {
    if (!state.pending) return false;
    waiting = { waiting: { run: state.run } };
    return true;
  });
  let timer = null;
  const timeout = timeoutMs > 0
    ? new Promise((resolve) => { timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs); })
    : new Promise(() => {});

  try {
    return await Promise.race([stream.done.then(() => waiting || { ended: true }), timeout]);
  } finally {
    clearTimeout(timer);
    stream.close();
  }
}
