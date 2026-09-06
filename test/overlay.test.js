/* The overlay's mark lifecycle, driven through the gestures a reviewer makes
   and the seams the CLI talks to. Everything here asserts on the batch the
   agent would be handed, because that batch is the whole product of a session:
   a gesture that stages the wrong thing, or a lock that lets a second batch
   through, is wrong no matter how it looked while it happened.

   How it looked is not tested — see test/overlay-harness.js for why. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountOverlay, needsDom, delay } from './overlay-harness.js';

/** The batch as the agent reads it, keyed by ref. */
const byRef = (o) => Object.fromEntries(o.payload().marks.map((m) => [m.ref, m]));

test('each gesture stages the mark it promises', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());

  // Right-click: a deletion, which needs nothing said about it.
  o.remove('#row-1');

  // Left-click, then say what is wrong with it.
  await o.comment('#cta');
  o.compose('This should say Download');

  // Shift-click: a place rather than a thing.
  o.point({ clientX: 120, clientY: 240 });
  o.compose('A filter belongs here');

  // Double-click text, and write the answer yourself.
  o.mouse('dblclick', '#title');
  o.at('#title').textContent = 'Unpaid invoices';
  o.mouse('click', '#row-2');            // clicking away commits the edit

  const marks = o.payload().marks;
  assert.deepEqual(marks.map((m) => m.type), ['remove', 'comment', 'point', 'text'],
    'one mark per gesture, in the order they were made');

  const m = byRef(o);
  assert.equal(m['01'].selector, '#row-1');
  assert.equal(m['01'].element, 'Bellweather Ltd');

  assert.equal(m['02'].comment, 'This should say Download');
  assert.equal(m['02'].selector, '#cta');

  // A point carries where it was put and nothing it was put on.
  assert.equal(m['03'].comment, 'A filter belongs here');
  assert.deepEqual([m['03'].x, m['03'].y], [120, 240]);
  assert.equal(m['03'].selector, null);

  // A text mark carries both sides, so the agent changes the string it means.
  assert.equal(m['04'].before, 'Invoices');
  assert.equal(m['04'].after, 'Unpaid invoices');

  // Every mark says where it was made, and none of them claims a source
  // address this page cannot support.
  assert.ok(marks.every((x) => x.route === '/'));
  assert.ok(marks.every((x) => x.orphaned === false));
});

test('a comment nobody wrote is not a mark', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());

  await o.comment('#cta');
  o.compose('   ');                       // Add, with nothing in the field

  assert.equal(o.payload().marks.length, 0,
    'committing an empty comment discards it rather than staging a blank');

  // Its number is spent rather than handed on: within a session a reference
  // means one thing, and the agent is told 02 for a mark the reviewer is
  // calling 02 even though 01 never survived.
  o.remove('#row-1');
  assert.equal(o.payload().marks[0].ref, '02');
});

test('the composer can ask for versions and a slider on the one mark', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());

  await o.comment('#cta');
  o.compose('Try this a few ways', { versions: 3, slider: true });

  const m = byRef(o)['01'];
  assert.equal(m.variations, 3);
  assert.equal(m.slider, true);
});

test('the send lock: a run in flight refuses a second batch, and marking goes on', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());

  o.remove('#row-1');
  o.tailr.send();
  assert.equal(o.sent.length, 1, 'the first batch goes');
  assert.equal(o.sent[0].marks.length, 1);

  // The reviewer keeps working while the agent does — what is blocked is
  // sending, not marking.
  o.remove('#row-2');
  assert.equal(o.state.marks.length, 2, 'a mark made during a run is still staged');

  o.tailr.send();
  assert.equal(o.sent.length, 1, 'but it cannot be sent on top of the open run');

  // The server is what knows a run is open, and the overlay follows it.
  o.tailr.sync({ id: 'r1', phase: 'working', total: 1, served: [] });
  o.tailr.send();
  assert.equal(o.sent.length, 1, 'still shut while the server says working');

  // A run that finished is not an invitation to send again: the reviewer has
  // changes on disk they have not looked at, so the lock holds until they
  // reload into them.
  o.tailr.sync({ id: 'r1', phase: 'done', total: 1, served: ['01'] });
  assert.equal(o.state.agent.phase, 'done');
  assert.equal(o.state.locked, true, 'a finished run still holds Send, pending the reload');
  o.tailr.send();
  assert.equal(o.sent.length, 1);
});

test('a run that failed hands the batch back rather than holding it', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());

  o.remove('#row-1');
  o.remove('#row-2');
  o.tailr.send();
  o.tailr.sync({ id: 'r1', phase: 'working', total: 2, served: [] });
  assert.equal(o.state.locked, true);

  o.tailr.sync({ id: 'r1', phase: 'failed', total: 2, served: ['01'], error: 'ran out of context' });

  assert.equal(o.state.locked, false, 'failing releases the lock, so the reviewer is not stuck');
  assert.equal(o.state.agent.error, 'ran out of context', 'and says what the agent said');

  // The mark the agent did land stays landed; the one it did not is staged
  // again, so sending after a failure does not ask for the same work twice.
  o.tailr.send();
  assert.deepEqual(o.sent[1].marks.map((x) => x.ref), ['02']);
});

test('choosing a version stages a choice that names it', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());

  // A mark that asked for three answers, and the run that built them. The set
  // is grown from the mark, so the agent reports the names while it is still
  // staged — which is the order the rules tell it to work in.
  await o.comment('#cta');
  o.compose('Try this a few ways', { versions: 3 });
  o.tailr.send();
  o.tailr.sync({
    id: 'r1', phase: 'working', total: 1, served: [],
    variants: { '01': { labels: ['Softer edges', 'Full width', 'Two columns'] } }
  });
  o.tailr.sync({ id: 'r1', phase: 'done', total: 1, served: ['01'] });

  // Choosing happens on the far side of the reload the agent asked for: the
  // versions are in the source now, and this is the reviewer looking at them.
  await o.reload();

  const tabs = o.shadow().querySelectorAll('.vpill .vtab');
  assert.equal(tabs.length, 3, 'a tab per version, on the element they were built for');

  o.act('.vpill .vtab[data-i="2"]');

  const choice = o.payload().marks.find((x) => x.type === 'choice');
  assert.ok(choice, 'keeping a version is itself a mark');
  assert.equal(choice.variantOf, '01', 'the choice names the mark it answers');
  assert.equal(choice.variant, 2);
  assert.equal(choice.label, 'Full width', 'and the version by the name the agent gave it');

  // The page is showing the version being kept, so the reviewer is looking at
  // the thing they chose rather than at version one.
  assert.equal(o.document.documentElement.getAttribute('data-tailr-var-01'), '2');
});

test('keeping none of the versions is a choice too', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());

  await o.comment('#cta');
  o.compose('Try this two ways', { versions: 2 });
  o.tailr.send();
  o.tailr.sync({
    id: 'r1', phase: 'working', total: 1, served: [],
    variants: { '01': { labels: ['Softer edges', 'Full width'] } }
  });
  o.tailr.sync({ id: 'r1', phase: 'done', total: 1, served: ['01'] });
  await o.reload();

  // Keeping none of them is offered on the set's row in the island, not on the
  // pill: it is a decision about the set, not a preview of a version. Getting
  // to that row means past the welcome and onto the staged list.
  o.act('[data-act="gotit"]');
  o.shadow().querySelector('[data-pill="batch"]').dispatchEvent(
    new o.window.MouseEvent('pointerenter', { bubbles: false }));
  await delay(20);
  o.act('[data-act="pick"][data-i="0"]');

  const m = o.payload().marks.find((x) => x.type === 'choice');
  assert.ok(m, 'discarding every version is a mark too — it is what removes the guards');
  assert.equal(m.variant, 0, 'variant 0 tells the agent to put the element back');
  assert.equal(m.label, null);
});
