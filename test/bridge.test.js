/* The send lock is the product's central promise, and it is only real because
   this state machine refuses things. These tests are about the refusals as
   much as the happy path. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTailr, oneMark } from './helpers.js';

test('the round trip: batch → pull → progress → done', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  const sent = await s.api('batch', oneMark());
  assert.equal(sent.status, 200);
  assert.equal(sent.body.total, 1);

  const waiting = await s.api('state', null, 'GET');
  assert.equal(waiting.body.pending, true, 'a sent batch is pending until it is leased');

  const leased = await s.api('pull');
  assert.equal(leased.status, 200);
  assert.equal(leased.body.marks.length, 1);

  const inFlight = await s.api('state', null, 'GET');
  assert.equal(inFlight.body.pending, false, 'a leased batch is no longer waiting');
  assert.equal(inFlight.body.run.phase, 'working', 'but its run is still open');

  await s.api('progress', { ref: '01' });
  const closed = await s.api('done');
  assert.equal(closed.status, 200);
  assert.equal(closed.body.run.phase, 'done');
});

test('a second batch is refused while a run is open — this is the send lock', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  await s.api('batch', oneMark('01'));
  const second = await s.api('batch', oneMark('02'));
  assert.equal(second.status, 409);

  await s.api('pull');
  const duringRun = await s.api('batch', oneMark('03'));
  assert.equal(duringRun.status, 409, 'leasing does not release the lock either');

  await s.api('done');
  const afterRun = await s.api('batch', oneMark('04'));
  assert.equal(afterRun.status, 200, 'closing the run releases it');
});

test('closing a run that is already closed is a 409, not a server error', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  await s.api('batch', oneMark());
  await s.api('pull');
  assert.equal((await s.api('done')).status, 200);

  const again = await s.api('done');
  assert.equal(again.status, 409, 'an agent retrying done must be able to tell why it failed');
  assert.equal(again.body.error, 'No open run.');
  assert.equal((await s.api('fail', { error: 'x' })).status, 409);
});

test('done counts every unreported mark as applied', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  await s.api('batch', { marks: [{ ref: '01' }, { ref: '02' }, { ref: '03' }] });
  await s.api('pull');
  await s.api('progress', { ref: '02' });

  const closed = await s.api('done');
  assert.deepEqual(closed.body.run.served.sort(), ['01', '02', '03']);
});

test('fail carries its reason back and releases the lock', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  await s.api('batch', oneMark());
  await s.api('pull');
  const failed = await s.api('fail', { error: 'could not find InvoiceTable.tsx' });

  assert.equal(failed.body.run.phase, 'failed');
  assert.equal(failed.body.run.error, 'could not find InvoiceTable.tsx');
  assert.equal((await s.api('batch', oneMark('02'))).status, 200);
});

test('progress is idempotent and refused outside an open run', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  assert.equal((await s.api('progress', { ref: '01' })).status, 409, 'no run to report against');

  await s.api('batch', { marks: [{ ref: '01' }, { ref: '02' }] });
  await s.api('pull');
  await s.api('progress', { ref: '01' });
  const twice = await s.api('progress', { ref: '01' });
  assert.deepEqual(twice.body.run.served, ['01'], 'reporting the same ref twice serves it once');
});

test('an empty batch is refused, and pull with nothing waiting is a 404', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  assert.equal((await s.api('batch', { marks: [] })).status, 400);
  assert.equal((await s.api('batch', {})).status, 400);
  assert.equal((await s.api('pull')).status, 404);
});

test('reset takes the session back to nothing', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  await s.api('batch', oneMark());
  await s.api('pull');
  const clean = await s.api('reset');

  assert.equal(clean.body.run, null);
  assert.equal(clean.body.pending, false);
  assert.equal((await s.api('batch', oneMark())).status, 200, 'a reset session can be sent to again');
});

test('the event stream opens with current state and pushes every change', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  await s.api('batch', oneMark());

  const res = await fetch(`${s.base}/__tailr/events`, { headers: { accept: 'text/event-stream' } });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  const frames = [];
  const readFrame = async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return null;
      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data:')) { frames.push(JSON.parse(line.slice(5))); return frames.at(-1); }
      }
    }
  };

  const opening = await readFrame();
  assert.equal(opening.pending, true, 'the stream opens with the batch already waiting');

  await s.api('pull');
  const afterPull = await readFrame();
  assert.equal(afterPull.pending, false);

  await reader.cancel();
});

test('an unknown endpoint is a 404, not a crash', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());
  assert.equal((await s.api('nonsense')).status, 404);
});

/* ── variations ──────────────────────────────────────────── */

test('the versions built for a mark ride the run state to the overlay', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  await s.api('batch', { marks: [{ ref: '01', type: 'comment', variations: 3 }] });
  await s.api('pull');

  const named = await s.api('variants', { ref: '01', labels: ['Softer edges', 'Full width', 'Two columns'] });
  assert.equal(named.status, 200);
  assert.deepEqual(named.body.run.variants['01'].labels, ['Softer edges', 'Full width', 'Two columns']);

  // The reviewer chooses after the run closes, so the labels have to outlive it.
  const closed = await s.api('done');
  assert.deepEqual(closed.body.run.variants['01'].labels.length, 3);
});

test('a set of versions needs a ref and more than one of them', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  await s.api('batch', oneMark());
  await s.api('pull');

  assert.equal((await s.api('variants', { labels: ['a', 'b'] })).status, 400);
  assert.equal((await s.api('variants', { ref: '01', labels: ['only one'] })).status, 400,
    'one version is not a choice');
  assert.equal((await s.api('variants', { ref: '01', labels: [] })).status, 400);
});

test('versions cannot be registered outside an open run', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  assert.equal((await s.api('variants', { ref: '01', labels: ['a', 'b'] })).status, 409);

  await s.api('batch', oneMark());
  await s.api('pull');
  await s.api('done');
  assert.equal((await s.api('variants', { ref: '01', labels: ['a', 'b'] })).status, 409);
});

test('a set is capped at four versions and its labels are kept short', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  await s.api('batch', oneMark());
  await s.api('pull');
  const r = await s.api('variants', {
    ref: '01',
    labels: ['  one  ', '', '   ', 'a label far longer than anything anyone would hover to read',
             'three', 'four', 'five']
  });
  const set = r.body.run.variants['01'];
  assert.equal(set.labels.length, 4, 'more versions than the chooser can show are dropped');
  assert.equal(set.labels[0], 'one', 'labels arrive trimmed, and blank ones never arrive at all');
  assert.equal(set.labels[1].length, 32, 'a label too long to sit in a pill is cut to fit');
  assert.deepEqual(set.labels.slice(2), ['three', 'four']);
});
