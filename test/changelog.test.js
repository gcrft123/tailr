/* The release flow trusts this script to say what shipped. If it can read the
   wrong section, or let an empty one through, a release goes out with notes
   that belong to something else. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/changelog.js', import.meta.url));

const FIXTURE = `# Changelog

## [Unreleased]

### Added

- a new thing

## [0.3.0] — 2026-08-31

### Fixed

- an old thing

## [0.2.0] — 2026-08-30

- the first thing
`;

function project(changelog = FIXTURE, version = '0.4.0') {
  const dir = mkdtempSync(join(tmpdir(), 'tailr-changelog-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version }));
  writeFileSync(join(dir, 'CHANGELOG.md'), changelog);
  return dir;
}

function run(dir, ...args) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args],
      { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out, err: '' };
  } catch (e) {
    return { code: e.status, out: e.stdout || '', err: e.stderr || '' };
  }
}

test('--notes reads one version and stops at the next heading', async () => {
  const { code, out } = run(project(), '--notes', '0.3.0');
  assert.equal(code, 0);
  assert.match(out, /an old thing/);
  assert.doesNotMatch(out, /a new thing/, 'nothing from the section above');
  assert.doesNotMatch(out, /the first thing/, 'nothing from the section below');
  assert.doesNotMatch(out, /## \[/, 'and no headings');
});

test('--notes with no version uses the one in package.json', async () => {
  const dir = project(FIXTURE, '0.3.0');
  assert.match(run(dir, '--notes').out, /an old thing/);
});

test('--notes refuses a version the changelog says nothing about', async () => {
  const { code, err } = run(project(), '--notes', '9.9.9');
  assert.equal(code, 1, 'a release with no notes must not go out');
  assert.match(err, /no notes for 9\.9\.9/);
});

test('--check passes when Unreleased has something in it', async () => {
  assert.equal(run(project(), '--check').code, 0);
});

test('--check refuses an empty Unreleased', async () => {
  const empty = FIXTURE.replace('### Added\n\n- a new thing\n\n', '');
  const { code, err } = run(project(empty), '--check');
  assert.equal(code, 1);
  assert.match(err, /says nothing under/);
});

test('--check refuses a changelog with no Unreleased heading at all', async () => {
  const { code, err } = run(project('# Changelog\n\n## [0.1.0]\n\n- one\n'), '--check');
  assert.equal(code, 1);
  assert.match(err, /no "## \[Unreleased\]" heading/);
});

test('--release stamps Unreleased with the version and today, and opens a fresh one', async () => {
  const dir = project(FIXTURE, '0.4.0');
  assert.equal(run(dir, '--release').code, 0);

  const after = readFileSync(join(dir, 'CHANGELOG.md'), 'utf8');
  const today = new Date().toISOString().slice(0, 10);

  assert.match(after, new RegExp(`## \\[0\\.4\\.0\\] — ${today}`));
  assert.match(after, /## \[Unreleased\]\n\n## \[0\.4\.0\]/, 'a fresh Unreleased sits above it');
  assert.match(run(dir, '--notes', '0.4.0').out, /a new thing/, 'and it carries what was written');

  const reopened = run(dir, '--check');
  assert.equal(reopened.code, 1, 'the new Unreleased starts empty');
});

test('--release refuses to write a version that is already in the file', async () => {
  const { code, err } = run(project(FIXTURE, '0.3.0'), '--release');
  assert.equal(code, 1);
  assert.match(err, /already has a section for 0\.3\.0/);
});

test('an unrecognised mode prints usage rather than doing something', async () => {
  const { code, err } = run(project(), '--publish-everything');
  assert.equal(code, 2);
  assert.match(err, /usage:/);
});
