/* Settings are the reviewer's, and two of them decide whether Tailr works at
   all for them: the key they hold to mark, and whether it makes a sound. A
   stored value this version no longer understands must never be what disarms
   marking, and a value off the wire must never reach the overlay unchecked. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTailr } from './helpers.js';
import {
  configFile, defaults, modifierLabel, parseSettings, readConfig, writeConfig, SETTINGS
} from '../src/server/config.js';

/* Every test that touches disk gets a home of its own, so the suite never
   reads or writes the settings of the machine it is running on. */
function home() {
  const dir = mkdtempSync(join(tmpdir(), 'tailr-config-'));
  process.env.TAILR_HOME = dir;
  return dir;
}
function withoutHome(t) {
  const before = process.env.TAILR_HOME;
  t.after(() => {
    if (before === undefined) delete process.env.TAILR_HOME;
    else process.env.TAILR_HOME = before;
  });
}

/* ── what is stored ──────────────────────────────────────── */

test('with nothing written, the settings are the shipped defaults', (t) => {
  withoutHome(t);
  home();
  assert.deepEqual(readConfig(), { sfx: true, modifier: 'alt' });
  assert.equal(defaults().sfx, true, 'sound is on out of the box');
});

test('what is written comes back, and only that', (t) => {
  withoutHome(t);
  const dir = home();

  const written = writeConfig({ modifier: 'meta' });
  assert.deepEqual(written, { sfx: true, modifier: 'meta' });
  assert.equal(existsSync(join(dir, 'config.json')), true);
  assert.deepEqual(readConfig(), { sfx: true, modifier: 'meta' });

  // A second setting merges rather than replacing the file.
  writeConfig({ sfx: false });
  assert.deepEqual(readConfig(), { sfx: false, modifier: 'meta' });
});

test('a stored value this version does not understand falls back to the default', (t) => {
  withoutHome(t);
  home();
  writeConfig({ modifier: 'meta', sfx: false });
  // A newer Tailr wrote a modifier this one has never heard of.
  writeFileSync(configFile(), JSON.stringify({ modifier: 'hyper', sfx: false }));

  const config = readConfig();
  assert.equal(config.modifier, 'alt', 'marking still has a key that works');
  assert.equal(config.sfx, false, 'the setting beside it is untouched');
});

test('an unreadable settings file is the same as no settings file', (t) => {
  withoutHome(t);
  home();
  writeConfig({ sfx: false });
  writeFileSync(configFile(), 'not json at all');
  assert.deepEqual(readConfig(), defaults());
});

/* ── what a person types ─────────────────────────────────── */

test('settings are read as name:value, name=value, or name value', () => {
  assert.deepEqual(parseSettings(['sfx:false']).patch, { sfx: false });
  assert.deepEqual(parseSettings(['sfx=false']).patch, { sfx: false });
  assert.deepEqual(parseSettings(['sfx', 'false']).patch, { sfx: false });
  assert.deepEqual(
    parseSettings(['sfx:false', 'modifier:ctrl']).patch,
    { sfx: false, modifier: 'ctrl' });
});

test('cmd is stored as the browser names it and read back as it was typed', () => {
  const { patch } = parseSettings(['modifier:cmd']);
  assert.equal(patch.modifier, 'meta', 'metaKey is what the overlay tests');
  assert.equal(SETTINGS.modifier.show('meta'), 'cmd', 'and cmd is what a person is shown');
  for (const alias of ['command', 'meta', 'win']) {
    assert.equal(parseSettings([`modifier:${alias}`]).patch.modifier, 'meta');
  }
  assert.equal(parseSettings(['modifier:option']).patch.modifier, 'alt');
});

test('the terminal names whichever key the reviewer will actually be holding', () => {
  /* The banner used to say Alt whatever the setting was, which made it wrong
     for exactly the person who had gone to the trouble of changing it. */
  assert.equal(modifierLabel({ modifier: 'alt' }), 'Alt');
  assert.equal(modifierLabel({ modifier: 'ctrl' }), 'Ctrl');
  assert.equal(modifierLabel({}), 'Alt', 'and falls back to the default, not to nothing');
  assert.equal(modifierLabel(), 'Alt');
  assert.equal(modifierLabel({ modifier: 'meta' }),
    process.platform === 'darwin' ? 'Cmd' : 'Win',
    'the same key is not called the same thing on every desk');
});

test('every mistake in one line is reported at once, and none of it is applied', () => {
  const { patch, errors } = parseSettings(['sfx:maybe', 'volume:11', 'modifier:ctrl']);
  assert.equal(errors.length, 2, 'both the bad value and the unknown setting');
  assert.match(errors[0], /sfx is true or false/);
  assert.match(errors[1], /no "volume" setting/);
  assert.match(errors[1], /sfx, modifier/, 'and what there is instead');
  assert.deepEqual(patch, { modifier: 'ctrl' }, 'the settings that did parse still stand');
});

test('a setting given no value is refused rather than guessed at', () => {
  const { patch, errors } = parseSettings(['modifier:']);
  assert.deepEqual(patch, {});
  assert.match(errors[0], /alt \| ctrl \| cmd/);
});

/* ── what reaches the page ───────────────────────────────── */

test('the settings ride the same state the run does', async (t) => {
  const s = await startTailr(undefined, { config: { sfx: false, modifier: 'meta' } });
  t.after(() => s.close());

  const { body } = await s.api('state', null, 'GET');
  assert.deepEqual(body.config, { sfx: false, modifier: 'meta' });
});

test('a session with no settings given serves the defaults', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  const { body } = await s.api('state', null, 'GET');
  assert.deepEqual(body.config, defaults());
});

test('changing them mid-session lands on the open page', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  // The page is listening when the change is made, the way a reviewer's is.
  const res = await fetch(`${s.base}/__tailr/events`);
  const reader = res.body.getReader();
  await reader.read();                                   // the frame on connect

  const posted = await s.api('config', { config: { modifier: 'meta', sfx: false } });
  assert.equal(posted.status, 200);
  assert.deepEqual(posted.body.config, { sfx: false, modifier: 'meta' });

  const frame = new TextDecoder().decode((await reader.read()).value);
  assert.deepEqual(JSON.parse(frame.replace(/^data: /, '')).config,
    { sfx: false, modifier: 'meta' }, 'pushed, not waited for');
  await reader.cancel();
});

test('a value the overlay could not use is refused at the door', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  const bad = await s.api('config', { config: { modifier: 'hyper' } });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /alt, ctrl or cmd/);

  const { body } = await s.api('state', null, 'GET');
  assert.equal(body.config.modifier, 'alt', 'and nothing was half-applied');
});

test('a settings change says nothing about the run', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  await s.api('batch', { marks: [{ ref: '01', type: 'comment', route: '/', comment: 'x' }] });
  await s.api('config', { config: { sfx: false } });

  const { body } = await s.api('state', null, 'GET');
  assert.equal(body.run.phase, 'working', 'the open run is left exactly as it was');
  assert.equal(body.pending, true);
});

/* ── the cues themselves ─────────────────────────────────── */

test('the cue player is served ahead of the overlay that plays through it', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  const bundle = await (await fetch(s.base + '/__tailr/overlay.js')).text();
  assert.ok(bundle.includes('window.__tailrCue'), 'the cues ship with the overlay');
  assert.ok(bundle.indexOf('window.__tailrCue =') < bundle.indexOf('window.__tailr ='),
    'defined before the overlay that calls it');
  assert.ok(!/^\s*(?:import|export)\s/m.test(bundle),
    'three plain scripts glued together — no statement here is a module\'s');
  // Vendored under MIT: the notice travels with the code.
  assert.match(bundle, /Copyright \(c\) 2026 Daniel Belyi/);
});

test('every cue the overlay plays is a sound the palette actually has', () => {
  // A typo here is silent in every sense: play() ignores a name it does not
  // know, so the action just stops making a sound and nothing says why.
  const overlay = readFileSync('src/overlay/tailr.js', 'utf8');
  const palette = readFileSync('src/overlay/cuelume.js', 'utf8');

  const calls = [...overlay.matchAll(/\bcue\(([^)]*)\)/g)];
  const names = [...new Set(calls
    .flatMap((call) => [...call[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1])))];
  // Guards the regex, not the palette: how many distinct sounds those sites
  // share is a design decision and changes whenever the cues are recast.
  assert.ok(calls.length > 15, 'the actions are cued at all');

  for (const name of names) {
    assert.match(palette, new RegExp(`^    ${name}: \\{$`, 'm'),
      `${name} is played by the overlay but is not a recipe`);
  }
});

test('the overlay does not put Cuelume where a reviewed app would find it', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  const bundle = await (await fetch(s.base + '/__tailr/overlay.js')).text();
  // The app being reviewed may be using Cuelume itself, under its own global
  // and its own attributes. Tailr is a guest and touches neither.
  assert.ok(!bundle.includes('window.cuelume'), 'no global of Cuelume\'s to collide with');
  assert.ok(!/getAttribute\(['"]data-cuelume|\[data-cuelume/.test(bundle),
    'and nothing reading data-cuelume-* off the host page');
});

test('an edit to any part of the bundle is picked up without a restart', async (t) => {
  const s = await startTailr();
  t.after(() => s.close());

  const first = await (await fetch(s.base + '/__tailr/overlay.js')).text();
  const second = await (await fetch(s.base + '/__tailr/overlay.js')).text();
  assert.equal(first, second, 'and it is cached in between');
  assert.ok(first.length > readFileSync('src/overlay/tailr.js', 'utf8').length,
    'the bundle is more than the overlay alone');
});
