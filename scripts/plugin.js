#!/usr/bin/env node
/* The marketplace copy of Tailr, kept honest.
 *
 * Tailr reaches an agent three ways — `tailr init` writing rules into
 * AGENTS.md, the MCP server's tool descriptions, and the Claude plugin in
 * `plugin/`. The first two are generated from `src/setup/rules.js` at the
 * moment they are used, so they cannot drift. The plugin is files on disk that
 * someone installs, so it can: a stale version number makes `/plugin update` a
 * no-op, and a stale rules block teaches an agent a protocol Tailr no longer
 * speaks.
 *
 * So the plugin is checked rather than trusted. `--check` runs in the test
 * suite, which means it also runs at the tag, before anything is published.
 *
 *   node scripts/plugin.js --check   is the plugin in step with the source?
 *   node scripts/plugin.js --sync    put it back in step
 *
 * `--sync` runs as part of `npm version`, so cutting a release stamps the
 * plugin without anyone having to remember it.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rulesBlock, START, END } from '../src/setup/rules.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MARKETPLACE = join(ROOT, '.claude-plugin', 'marketplace.json');
const PLUGIN = join(ROOT, 'plugin', '.claude-plugin', 'plugin.json');
const SKILL = join(ROOT, 'plugin', 'skills', 'review', 'SKILL.md');
const NAME = 'tailr';

function fail(message) {
  process.stderr.write(`\n  ${message}\n\n`);
  process.exit(1);
}

function json(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (err) { fail(`${rel(path)}: ${err.code === 'ENOENT' ? 'missing' : 'not valid JSON'}.`); }
}
function writeJson(path, value) { writeFileSync(path, JSON.stringify(value, null, 2) + '\n'); }
function rel(path) { return path.slice(ROOT.length + 1); }

/** The plugin's entry in the marketplace listing — the thing an install reads. */
function listing(marketplace) {
  const entry = (marketplace.plugins || []).find((p) => p && p.name === NAME);
  if (!entry) fail(`${rel(MARKETPLACE)} lists no plugin called "${NAME}".`);
  return entry;
}

/** The rules, as they should appear inside the skill: the same text `tailr
 *  init` writes, still between its markers so `--sync` can find it again. */
function rulesRegion() {
  const block = rulesBlock({ mcp: true });
  const body = block.slice(START.length, block.length - END.length).trim();
  return `${START}\n\n${body}\n${END}`;
}

/** Every path the manifests promise, which an install will go looking for. */
function brokenPaths() {
  const plugin = json(PLUGIN);
  const broken = [];
  const check = (value, label) => {
    if (value && !existsSync(join(ROOT, 'plugin', value))) broken.push(`${label} → ${value}`);
  };
  check(plugin.skills, 'skills');
  check(plugin.commands, 'commands');
  check(plugin.mcpServers, 'mcpServers');

  const source = listing(json(MARKETPLACE)).source;
  if (typeof source === 'string' && !existsSync(join(ROOT, source, '.claude-plugin', 'plugin.json'))) {
    broken.push(`marketplace source → ${source} (no .claude-plugin/plugin.json there)`);
  }
  return broken;
}

const [mode] = process.argv.slice(2);
const version = json(join(ROOT, 'package.json')).version;

if (mode === '--check') {
  const wrong = [];

  const plugin = json(PLUGIN);
  if (plugin.version !== version) {
    wrong.push(`${rel(PLUGIN)} says ${plugin.version}, package.json says ${version}`);
  }
  const entry = listing(json(MARKETPLACE));
  if (entry.version !== version) {
    wrong.push(`${rel(MARKETPLACE)} advertises ${entry.version}, package.json says ${version}`);
  }
  let skill;
  try { skill = readFileSync(SKILL, 'utf8'); } catch { fail(`${rel(SKILL)} is missing.`); }
  if (!skill.includes(rulesRegion())) {
    wrong.push(`${rel(SKILL)} carries a different rules block than src/setup/rules.js`);
  }
  wrong.push(...brokenPaths());

  if (wrong.length) {
    fail(`The plugin is out of step with the source:\n\n` +
         wrong.map((w) => `    · ${w}`).join('\n') +
         `\n\n  Run:  node scripts/plugin.js --sync`);
  }
  process.stderr.write(`  plugin: in step with ${version}\n`);

} else if (mode === '--sync') {
  const changed = [];

  const plugin = json(PLUGIN);
  if (plugin.version !== version) { plugin.version = version; writeJson(PLUGIN, plugin); changed.push(rel(PLUGIN)); }

  const marketplace = json(MARKETPLACE);
  const entry = listing(marketplace);
  if (entry.version !== version) { entry.version = version; writeJson(MARKETPLACE, marketplace); changed.push(rel(MARKETPLACE)); }

  let skill;
  try { skill = readFileSync(SKILL, 'utf8'); } catch { fail(`${rel(SKILL)} is missing.`); }
  const from = skill.indexOf(START);
  const to = skill.indexOf(END);
  if (from === -1 || to <= from) {
    fail(`${rel(SKILL)} has no ${START} … ${END} block to write the rules into.`);
  }
  const spliced = skill.slice(0, from) + rulesRegion() + skill.slice(to + END.length);
  if (spliced !== skill) { writeFileSync(SKILL, spliced); changed.push(rel(SKILL)); }

  const broken = brokenPaths();
  if (broken.length) {
    fail(`Synced, but the manifests point at paths that do not exist:\n\n` +
         broken.map((b) => `    · ${b}`).join('\n'));
  }
  process.stderr.write(changed.length
    ? `  plugin: synced to ${version} — ${changed.join(', ')}\n`
    : `  plugin: already in step with ${version}\n`);

} else {
  process.stderr.write(`
  usage: node scripts/plugin.js <mode>

    --check   is the plugin in step with package.json and src/setup/rules.js?
    --sync    put it back in step

`);
  process.exit(2);
}
