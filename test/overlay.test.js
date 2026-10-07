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

  // Nothing in the batch reports whether an element was on screen when it was
  // sent. The agent works in the source, where that is not a difference.
  assert.ok(marks.every((x) => !('orphaned' in x)), 'no mark is flagged to the agent');
});

/* A drawer closed, a tab switched, a row filtered away: the one case where the
   reviewer and the agent are told different things. The reviewer has lost a
   badge and needs to know where it went; the agent has lost nothing. */
test('a mark whose element goes off screen keeps everything but its badge', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());

  await o.comment('#cta');
  o.compose('This should say Download');
  assert.ok(o.shadow().querySelector('[data-mark]'), 'a badge while the element is there');

  o.at('#cta').remove();
  // Past the grace a route gets to render, then the misses that have to add up
  // before Tailr will say anything about an element it cannot find.
  await delay(3900);

  const m = o.payload().marks.find((x) => x.ref === '01');
  assert.equal(m.comment, 'This should say Download', 'the note is untouched');
  assert.equal(m.selector, '#cta', 'and so is the address it was made against');
  assert.ok(!('orphaned' in m), 'nothing in the batch would stop the agent acting on it');

  // The badge is the one thing that goes: there is nowhere left to put it.
  assert.equal(o.shadow().querySelector('[data-mark]'), null);

  o.shadow().querySelector('[data-pill="batch"]').dispatchEvent(
    new o.window.MouseEvent('pointerenter', { bubbles: false }));
  await delay(20);

  // What the reviewer is told, and where they are sent.
  const note = [...o.shadow().querySelectorAll('.grp')].map((n) => n.textContent).join(' ');
  assert.match(note, /Hidden/);
  assert.doesNotMatch(note, /orphan/i, 'the reviewer is not told the mark is broken, because it is not');

  const row = o.shadow().querySelector('.li.dim');
  assert.ok(row, 'it is dimmed, since there is no badge on the page to match');
  assert.equal(row.getAttribute('data-act'), 'edit', 'and it still opens');

  o.act('.li.dim[data-act="edit"]');
  const c = o.shadow().querySelector('.composer');
  assert.ok(c, 'a composer with no element to sit on opens anyway');
  o.compose('Actually, say Export as CSV');
  assert.equal(o.payload().marks.find((x) => x.ref === '01').comment, 'Actually, say Export as CSV');
});

/* Nested in the kind, the flags overflowed a fixed-width box "Comment" already
   fills and painted over the address. jsdom cannot see that, so what is
   asserted is the structure that prevents it. */
test('a mark asking for versions does not wear the label of the one beside it', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());

  await o.comment('#cta');
  o.compose('Try this three ways', { versions: 3, slider: true });

  o.shadow().querySelector('[data-pill="batch"]').dispatchEvent(
    new o.window.MouseEvent('pointerenter', { bubbles: false }));
  await delay(20);

  const row = o.shadow().querySelector('.li');
  assert.equal(row.querySelector('.li-k').textContent, 'Comment', 'the kind, and only the kind');
  assert.deepEqual([...row.querySelectorAll('.li-f > .li-v')].map((n) => n.textContent),
    ['3×', 'slider'], 'the flags are a column of their own');
  assert.equal(row.querySelector('.li-k .li-v'), null, 'and never inside the kind');
});

/* Learning to mark happens once, not once per dev server, so the walkthrough
   lives with the reviewer's settings rather than in each origin's storage. */
test('the walkthrough shows until the first mark and then never again', needsDom, async (t) => {
  const o = await mountOverlay({ tutorial: true });
  t.after(() => o.destroy());

  // It opens itself, but not before the settings have had a moment to say it
  // should not.
  await delay(450);
  assert.ok(o.shadow().querySelector('[data-act="gotit"]'), 'on screen, unasked');

  await o.comment('#cta');
  o.compose('This should say Download');

  assert.equal(o.taught.length, 1, 'the first mark is what turns it off');
  assert.equal(o.shadow().querySelector('[data-act="gotit"]'), null, 'and it goes at once');

  // The server has the fact now; this origin keeps a copy so the next load need
  // not wait to be told.
  await o.reload();
  await delay(450);
  assert.equal(o.shadow().querySelector('[data-act="gotit"]'), null, 'nor on the next load');

  // And it is a setting, so the reviewer can ask for it back.
  o.tailr.config({ tutorial: true });
  await delay(20);
  assert.ok(o.shadow().querySelector('[data-act="gotit"]'), 'tutorial:true brings it back whole');
});

/* The staged list is where a hidden mark is edited, so a panel that goes on
   showing the note underneath the composer that just replaced it is worse than
   one that is closed. */
test('changing a mark updates the row that is showing it', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());

  await o.comment('#cta');
  o.compose('Say Download');

  o.shadow().querySelector('[data-pill="batch"]').dispatchEvent(
    new o.window.MouseEvent('pointerenter', { bubbles: false }));
  await delay(20);
  assert.match(o.shadow().querySelector('.li').textContent, /Say Download/);

  // Reopened from its badge on the page, which leaves the panel open behind it.
  o.shadow().querySelector('[data-mark]').dispatchEvent(
    new o.window.MouseEvent('click', { bubbles: true, cancelable: true, view: o.window }));
  await delay(20);
  o.compose('Say Export as CSV', { versions: 2 });

  const row = o.shadow().querySelector('.li');
  assert.match(row.textContent, /Say Export as CSV/, 'the row says what the mark now says');
  assert.match(row.textContent, /2×/, 'including that it has started asking for versions');
});

test('a comment nobody wrote is not a mark', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());

  await o.comment('#cta');
  o.compose('   ');                       // Add, with nothing in the field

  assert.equal(o.payload().marks.length, 0,
    'committing an empty comment discards it rather than staging a blank');

  // It was never a mark, so its number goes back: the reviewer's first real
  // mark is 01, not 02 with nothing on the page that was ever 01.
  o.remove('#row-1');
  assert.equal(o.payload().marks[0].ref, '01');
});

/* A number that has gone out in a batch belongs to the agent from then on.
   Handing it back would put a second mark under a reference the agent is
   already working on. */
test('a number the agent has been given is never handed out again', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());

  o.remove('#row-1');
  o.shadow().querySelector('[data-pill="batch"]').dispatchEvent(
    new o.window.MouseEvent('click', { bubbles: true, cancelable: true, view: o.window }));
  assert.equal(o.sent.length, 1, 'the batch carrying 01 went out');

  // A note opened and left empty while that run is open.
  await o.comment('#cta');
  o.compose('');
  o.remove('#row-2');
  const refs = [...o.state.marks].map((m) => m.n);
  assert.deepEqual(refs, [1, 3], 'the discarded 02 stays spent while a run is open');
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
  // pill: it is a decision about the set, not a preview of a version.
  o.shadow().querySelector('[data-pill="batch"]').dispatchEvent(
    new o.window.MouseEvent('pointerenter', { bubbles: false }));
  await delay(20);
  o.act('[data-act="pick"][data-i="0"]');

  const m = o.payload().marks.find((x) => x.type === 'choice');
  assert.ok(m, 'discarding every version is a mark too — it is what removes the guards');
  assert.equal(m.variant, 0, 'variant 0 tells the agent to put the element back');
  assert.equal(m.label, null);
});

/* A double-click edits text in place, which is the only reason a click ever
   waits. Where there is no text to edit, the note opens on the press. */
test('a click on something with no text opens its note at once', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());

  o.mouse('click', '#list', { detail: 1 });
  assert.ok(o.shadow().querySelector('.composer'), 'open on the press, not a beat later');

  // The second press of a double-click is the same request, not a new one.
  o.mouse('click', '#list', { detail: 2 });
  o.mouse('dblclick', '#list', { detail: 2 });
  assert.equal(o.shadow().querySelectorAll('.composer').length, 1);
  o.compose('Group these by month');

  const marks = o.payload().marks;
  assert.equal(marks.length, 1, 'one note for one double-click');
  assert.equal(marks[0].ref, '01');
  assert.equal(marks[0].selector, '#list');

  // Text still waits, so a double-click on it can become an edit instead.
  o.mouse('click', '#cta', { clientX: 40, clientY: 40 });
  assert.equal(o.shadow().querySelector('.composer'), null, 'text waits to see if it is a double-click');
  await delay(300);
  assert.ok(o.shadow().querySelector('.composer'));
});

/* Windows and Linux repeat a held modifier. Counting the repeats as taps
   latched the mode half a second into an ordinary hold, so letting go no
   longer let go. */
test('holding the key is a hold, however often the keyboard repeats it', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());
  const key = (type, repeat) => o.document.dispatchEvent(new o.window.KeyboardEvent(type, {
    key: 'Alt', altKey: type === 'keydown', repeat, bubbles: true, cancelable: true
  }));

  key('keydown', false);
  key('keydown', true);
  key('keydown', true);
  assert.equal(o.state.armed, true, 'held is armed');
  assert.equal(o.state.latched, false, 'repeats are not a second tap');
  key('keyup', false);
  assert.equal(o.state.armed, false, 'and letting go lets go');

  // A real double-tap still latches.
  key('keydown', false); key('keyup', false); key('keydown', false);
  assert.equal(o.state.latched, true);
});

/* A press reports itself twice, as mouseup and then as click. The mouseup is
   what opens the note, and opening it takes however long it takes, so the
   click that follows is recognised as the same press rather than by how soon
   it arrived. */
test('one press is one note, however long opening the note took', needsDom, async (t) => {
  const o = await mountOverlay();
  t.after(() => o.destroy());
  const realNow = o.window.Date.now.bind(o.window.Date);
  let skew = 0;
  o.window.Date.now = () => realNow() + skew;

  o.mouse('mousedown', '#list');
  o.mouse('mouseup', '#list');
  assert.ok(o.shadow().querySelector('.composer'), 'the mouseup opened it');
  skew = 120;                              // a slow page, or a slow machine
  o.mouse('click', '#list');
  assert.equal(o.state.marks.length, 1, 'the click did not replace it with a second');
  o.compose('Group these by month');
  assert.equal(o.payload().marks[0].ref, '01');
});
