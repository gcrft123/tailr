#!/usr/bin/env node
/* Every release carries two write-ups, both written by hand while doing the
 * work. CHANGELOG.md records every change, keyed to its commit. RELEASE-NOTES.md
 * tells the people using Tailr what they will notice, and is what the GitHub
 * Release shows: its heading is the release title, its body the notes.
 *
 * Nothing here generates prose from commit subjects. This script only moves what
 * was written: `--check` refuses a release with either write-up missing,
 * `--release` stamps both Unreleased sections with the version as part of the
 * version commit, and `--notes` and `--title` read one version's notes back out
 * for the release flow to hand to GitHub.
 *
 *   node scripts/changelog.js --check              is there anything to release?
 *   node scripts/changelog.js --release [version]  stamp Unreleased as a version
 *   node scripts/changelog.js --notes   [version]  print that version's notes
 *   node scripts/changelog.js --title   [version]  print that version's title
 *
 * With no version, the one in package.json is used — which during npm's own
 * `version` lifecycle is already the new one.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const CHANGELOG = 'CHANGELOG.md';
const NOTES = 'RELEASE-NOTES.md';

/* `## [1.4.2] — 2026-09-23` in the changelog. */
const CHANGELOG_HEADING = /^##\s+\[([^\]]+)\]/;
/* `## v1.4.2: What the release does` in the notes, and `## Unreleased: …`
   before it has a version. The title is optional only so an empty Unreleased
   can sit there between releases. */
const NOTES_HEADING = /^##\s+v?([^\s:]+)\s*(?::\s*(.*?))?\s*$/;

function fail(message) {
  process.stderr.write(`\n  ${message}\n\n`);
  process.exit(1);
}

function manifestVersion() {
  try { return JSON.parse(readFileSync('package.json', 'utf8')).version; }
  catch { fail('No package.json here. Run this from the project root.'); }
}

function read(file) {
  try { return readFileSync(file, 'utf8'); }
  catch { fail(`No ${file} here. Run this from the project root.`); }
}

/** Everything under one `## ` heading named `name`, up to the next one, with
 *  the title the heading carries. Null if the heading isn't there at all; an
 *  empty body if it is there and says nothing. */
function section(text, name, heading) {
  let out = null;
  for (const line of text.split('\n')) {
    const m = line.match(heading);
    if (m) {
      if (out) break;
      if (m[1].toLowerCase() === name.toLowerCase()) out = { title: m[2] || '', lines: [] };
      continue;
    }
    if (out) out.lines.push(line);
  }
  return out === null ? null : { title: out.title, body: out.lines.join('\n').trim() };
}

/** Both Unreleased sections, refusing a release that is missing either. */
function unreleased() {
  const log = section(read(CHANGELOG), 'Unreleased', CHANGELOG_HEADING);
  if (log === null) fail(`${CHANGELOG} has no "## [Unreleased]" heading to release from.`);
  if (!log.body) fail(`${CHANGELOG} says nothing under "## [Unreleased]". Write what changed before cutting a release.`);

  const notes = section(read(NOTES), 'Unreleased', NOTES_HEADING);
  if (notes === null) fail(`${NOTES} has no "## Unreleased" heading to release from.`);
  if (!notes.body) fail(`${NOTES} says nothing under "## Unreleased". Write what people using Tailr will notice — that is the GitHub Release.`);
  if (!notes.title) fail(`${NOTES} has no title for this release. Put it in the heading: "## Unreleased: what the release does".`);
  return { log, notes };
}

/** One released version's notes, refusing a version either file is missing. */
function released(version) {
  if (section(read(CHANGELOG), version, CHANGELOG_HEADING) === null) {
    fail(`${CHANGELOG} has no section for ${version}. Add a "## [${version}]" section before tagging.`);
  }
  const notes = section(read(NOTES), version, NOTES_HEADING);
  if (!notes || !notes.body) fail(`${NOTES} has no notes for ${version}. Add a "## v${version}: …" section before tagging.`);
  if (!notes.title) fail(`${NOTES} has no title for ${version}. Put it in the heading: "## v${version}: what the release does".`);
  return notes;
}

const [mode, given] = process.argv.slice(2);

if (mode === '--check') {
  const { log, notes } = unreleased();
  process.stderr.write(`  ${CHANGELOG}: ${log.body.split('\n').filter(Boolean).length} lines ready to release\n`);
  process.stderr.write(`  ${NOTES}: "${notes.title}"\n`);

} else if (mode === '--release') {
  const version = given || manifestVersion();
  const log = read(CHANGELOG);
  const notes = read(NOTES);
  if (section(log, version, CHANGELOG_HEADING) !== null) fail(`${CHANGELOG} already has a section for ${version}.`);
  if (section(notes, version, NOTES_HEADING) !== null) fail(`${NOTES} already has a section for ${version}.`);
  const { notes: next } = unreleased();

  const today = new Date().toISOString().slice(0, 10);
  const stampedLog = log.replace(/^##\s+\[Unreleased\].*$/m, `## [Unreleased]\n\n## [${version}] — ${today}`);
  if (stampedLog === log) fail(`Could not find the "## [Unreleased]" heading in ${CHANGELOG}.`);
  const stampedNotes = notes.replace(/^##\s+Unreleased\b.*$/m, `## Unreleased\n\n## v${version}: ${next.title}`);
  if (stampedNotes === notes) fail(`Could not find the "## Unreleased" heading in ${NOTES}.`);

  writeFileSync(CHANGELOG, stampedLog);
  writeFileSync(NOTES, stampedNotes);
  process.stderr.write(`  ${CHANGELOG}: Unreleased is now ${version}, dated ${today}\n`);
  process.stderr.write(`  ${NOTES}: Unreleased is now "v${version}: ${next.title}"\n`);

} else if (mode === '--notes') {
  const version = given || manifestVersion();
  process.stdout.write(released(version).body + '\n');

} else if (mode === '--title') {
  const version = given || manifestVersion();
  process.stdout.write(`v${version}: ${released(version).title}\n`);

} else {
  process.stderr.write(`
  usage: node scripts/changelog.js <mode> [version]

    --check              is there anything written under both Unreleased headings?
    --release [version]  stamp both Unreleased sections with the version
    --notes   [version]  print that version's release notes
    --title   [version]  print that version's release title

`);
  process.exit(2);
}
