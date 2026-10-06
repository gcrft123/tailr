/* The release flow trusts this script to say what shipped. If it can read the
   wrong section, or let an empty one through, a release goes out with notes
   that belong to something else — or under a title that does. */
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

const NOTES = `# Release notes

## Unreleased: A new thing you will notice

* the new thing, for whoever uses it

## v0.3.0: An old thing, fixed

### Fixed
* the old thing, for whoever used it

## v0.2.0: The first thing

* the first thing, for whoever used it
`;

function project(changelog = FIXTURE, version = '0.4.0', notes = NOTES) {
  const dir = mkdtempSync(join(tmpdir(), 'tailr-changelog-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version }));
  writeFileSync(join(dir, 'CHANGELOG.md'), changelog);
  writeFileSync(join(dir, 'RELEASE-NOTES.md'), notes);
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

test('--notes reads one version from the release notes and stops at the next heading', async () => {
  const { code, out } = run(project(), '--notes', '0.3.0');
  assert.equal(code, 0);
  assert.match(out, /the old thing, for whoever used it/);
  assert.doesNotMatch(out, /- an old thing/, 'the release notes, not the changelog');
  assert.doesNotMatch(out, /the new thing/, 'nothing from the section above');
  assert.doesNotMatch(out, /the first thing/, 'nothing from the section below');
  assert.doesNotMatch(out, /^## /m, 'and no version headings');
});

test('--notes with no version uses the one in package.json', async () => {
  const dir = project(FIXTURE, '0.3.0');
  assert.match(run(dir, '--notes').out, /the old thing/);
});

test('--notes refuses a version the release notes say nothing about', async () => {
  const changelog = FIXTURE.replace('## [0.3.0]', '## [9.9.9] — 2026-09-01\n\n- something\n\n## [0.3.0]');
  const { code, err } = run(project(changelog), '--notes', '9.9.9');
  assert.equal(code, 1, 'a release with no notes must not go out');
  assert.match(err, /RELEASE-NOTES\.md has no notes for 9\.9\.9/);
});

test('--notes refuses a version the changelog says nothing about', async () => {
  const notes = NOTES.replace('## v0.3.0', '## v9.9.9: Something\n\n* something\n\n## v0.3.0');
  const { code, err } = run(project(FIXTURE, '0.4.0', notes), '--notes', '9.9.9');
  assert.equal(code, 1, 'both write-ups go out, or neither');
  assert.match(err, /CHANGELOG\.md has no section for 9\.9\.9/);
});

test('--title is the tag, a colon, and the heading the notes gave it', async () => {
  const { code, out } = run(project(), '--title', '0.3.0');
  assert.equal(code, 0);
  assert.equal(out, 'v0.3.0: An old thing, fixed\n');
});

test('--title refuses a version whose heading carries no title', async () => {
  const notes = NOTES.replace('## v0.3.0: An old thing, fixed', '## v0.3.0');
  const { code, err } = run(project(FIXTURE, '0.4.0', notes), '--title', '0.3.0');
  assert.equal(code, 1);
  assert.match(err, /no title for 0\.3\.0/);
});

test('--check passes when both Unreleased sections have something in them', async () => {
  assert.equal(run(project(), '--check').code, 0);
});

test('--check refuses release notes with nothing under Unreleased', async () => {
  const notes = NOTES.replace('* the new thing, for whoever uses it\n\n', '');
  const { code, err } = run(project(FIXTURE, '0.4.0', notes), '--check');
  assert.equal(code, 1, 'the changelog alone is not a GitHub Release');
  assert.match(err, /RELEASE-NOTES\.md says nothing under/);
});

test('--check refuses release notes whose Unreleased has no title', async () => {
  const notes = NOTES.replace('## Unreleased: A new thing you will notice', '## Unreleased');
  const { code, err } = run(project(FIXTURE, '0.4.0', notes), '--check');
  assert.equal(code, 1);
  assert.match(err, /no title for this release/);
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

test('--release stamps both Unreleased sections with the version, and opens fresh ones', async () => {
  const dir = project(FIXTURE, '0.4.0');
  assert.equal(run(dir, '--release').code, 0);

  const after = readFileSync(join(dir, 'CHANGELOG.md'), 'utf8');
  const today = new Date().toISOString().slice(0, 10);

  assert.match(after, new RegExp(`## \\[0\\.4\\.0\\] — ${today}`));
  assert.match(after, /## \[Unreleased\]\n\n## \[0\.4\.0\]/, 'a fresh Unreleased sits above it');
  assert.match(after, /## \[0\.4\.0\][^\n]*\n\n### Added\n\n- a new thing/, 'and it carries what was written');

  const notes = readFileSync(join(dir, 'RELEASE-NOTES.md'), 'utf8');
  assert.match(notes, /## Unreleased\n\n## v0\.4\.0: A new thing you will notice\n/, 'the title moves to the version');
  assert.match(run(dir, '--notes', '0.4.0').out, /the new thing, for whoever uses it/);
  assert.equal(run(dir, '--title', '0.4.0').out, 'v0.4.0: A new thing you will notice\n');

  const reopened = run(dir, '--check');
  assert.equal(reopened.code, 1, 'the new Unreleased starts empty');
});

test('--release refuses to write a version that is already in the file', async () => {
  const { code, err } = run(project(FIXTURE, '0.3.0'), '--release');
  assert.equal(code, 1);
  assert.match(err, /already has a section for 0\.3\.0/);
});

test('--release writes neither file when the release notes are not ready', async () => {
  const notes = NOTES.replace('## Unreleased: A new thing you will notice', '## Unreleased');
  const dir = project(FIXTURE, '0.4.0', notes);
  assert.equal(run(dir, '--release').code, 1);
  assert.equal(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'), FIXTURE, 'the changelog is untouched');
  assert.equal(readFileSync(join(dir, 'RELEASE-NOTES.md'), 'utf8'), notes, 'and so are the notes');
});

test('an unrecognised mode prints usage rather than doing something', async () => {
  const { code, err } = run(project(), '--publish-everything');
  assert.equal(code, 2);
  assert.match(err, /usage:/);
});
