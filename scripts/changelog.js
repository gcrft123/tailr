#!/usr/bin/env node
/* The changelog is the release notes.
 *
 * Nothing here generates prose from commit subjects. What ships is what someone
 * wrote under "## [Unreleased]" while doing the work, and this script only moves
 * it: `--check` refuses a release with nothing written, `--release` stamps the
 * Unreleased section with the version and the date as part of the version
 * commit, and `--notes` reads one version's section back out for the release
 * flow to hand to GitHub.
 *
 *   node scripts/changelog.js --check              is there anything to release?
 *   node scripts/changelog.js --release [version]  stamp Unreleased as a version
 *   node scripts/changelog.js --notes   [version]  print that version's notes
 *
 * With no version, the one in package.json is used — which during npm's own
 * `version` lifecycle is already the new one.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'CHANGELOG.md';
const HEADING = /^##\s+\[([^\]]+)\]/;

function fail(message) {
  process.stderr.write(`\n  ${message}\n\n`);
  process.exit(1);
}

function manifestVersion() {
  try { return JSON.parse(readFileSync('package.json', 'utf8')).version; }
  catch { fail('No package.json here. Run this from the project root.'); }
}

function changelog() {
  try { return readFileSync(FILE, 'utf8'); }
  catch { fail(`No ${FILE} here. Run this from the project root.`); }
}

/** Everything under one `## [name]` heading, up to the next one. Null if the
 *  heading isn't there at all; an empty string if it is there and says nothing. */
function section(text, name) {
  let out = null;
  for (const line of text.split('\n')) {
    const m = line.match(HEADING);
    if (m) {
      if (out) break;
      if (m[1].toLowerCase() === name.toLowerCase()) out = [];
      continue;
    }
    if (out) out.push(line);
  }
  return out === null ? null : out.join('\n').trim();
}

const [mode, given] = process.argv.slice(2);

if (mode === '--check') {
  const body = section(changelog(), 'Unreleased');
  if (body === null) fail(`${FILE} has no "## [Unreleased]" heading to release from.`);
  if (!body) fail(`${FILE} says nothing under "## [Unreleased]". Write what changed before cutting a release — those lines are the release notes.`);
  process.stderr.write(`  ${FILE}: ${body.split('\n').filter(Boolean).length} lines ready to release\n`);

} else if (mode === '--release') {
  const version = given || manifestVersion();
  const text = changelog();
  if (section(text, version) !== null) fail(`${FILE} already has a section for ${version}.`);
  const body = section(text, 'Unreleased');
  if (!body) fail(`${FILE} says nothing under "## [Unreleased]" to release as ${version}.`);

  const today = new Date().toISOString().slice(0, 10);
  const stamped = text.replace(/^##\s+\[Unreleased\].*$/m, `## [Unreleased]\n\n## [${version}] — ${today}`);
  if (stamped === text) fail(`Could not find the "## [Unreleased]" heading in ${FILE}.`);
  writeFileSync(FILE, stamped);
  process.stderr.write(`  ${FILE}: Unreleased is now ${version}, dated ${today}\n`);

} else if (mode === '--notes') {
  const version = given || manifestVersion();
  const body = section(changelog(), version);
  if (!body) fail(`${FILE} has no notes for ${version}. Add a "## [${version}]" section before tagging.`);
  process.stdout.write(body + '\n');

} else {
  process.stderr.write(`
  usage: node scripts/changelog.js <mode> [version]

    --check              is there anything written under Unreleased?
    --release [version]  stamp Unreleased with the version and today's date
    --notes   [version]  print that version's notes

`);
  process.exit(2);
}
