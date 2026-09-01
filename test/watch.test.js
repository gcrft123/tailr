/* `tailr wait` is how an agent finds out a batch arrived without polling and
   without asking the reviewer. Its three outcomes have to stay distinguishable:
   the caller picks an exit code from them. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForBatch } from '../src/server/watch.js';
import { startTailr, oneMark } from './helpers.js';

test('returns as soon as a batch is sent', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  const waiting = waitForBatch(s.port, 5000);
  setTimeout(() => s.api('batch', oneMark()), 50);

  const result = await waiting;
  assert.ok(result.waiting, 'a batch was seen');
  assert.equal(result.waiting.run.total, 1);
});

test('returns immediately when a batch is already waiting', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  await s.api('batch', oneMark());
  const started = Date.now();
  const result = await waitForBatch(s.port, 5000);

  assert.ok(result.waiting, 'the stream opens with current state, so nothing is missed');
  assert.ok(Date.now() - started < 1000, 'and it does not wait for the next change');
});

test('a leased batch is not reported as waiting', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  await s.api('batch', oneMark());
  await s.api('pull');

  const result = await waitForBatch(s.port, 300);
  assert.deepEqual(result, { timedOut: true }, 'work already in flight is not new work');
});

test('times out without ending the session', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  const result = await waitForBatch(s.port, 250);
  assert.deepEqual(result, { timedOut: true });
  assert.equal((await s.api('state', null, 'GET')).status, 200);
});

test('reports the session as ended when there is nothing to connect to', async () => {
  const result = await waitForBatch(1, 2000);
  assert.deepEqual(result, { ended: true });
});

test('reports the session as ended when it goes away mid-wait', async () => {
  const s = await startTailr();
  const waiting = waitForBatch(s.port, 5000);
  setTimeout(() => s.close(), 100);

  assert.deepEqual(await waiting, { ended: true });
});
