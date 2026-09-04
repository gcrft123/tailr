/* The plugin is the one copy of Tailr's rules that someone installs rather than
   generates, so it is the one that can go stale. These tests are the gate: they
   run in CI on every push and again at the tag, before anything is published. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rulesBlock, START, END } from '../src/setup/rules.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const at = (...p) => join(ROOT, ...p);
const read = (...p) => readFileSync(at(...p), 'utf8');
const load = (...p) => JSON.parse(read(...p));

const MARKETPLACE = ['.claude-plugin', 'marketplace.json'];
const ROOT_PLUGIN = ['.claude-plugin', 'plugin.json'];
const PLUGIN = ['plugin', '.claude-plugin', 'plugin.json'];
const SKILL = ['plugin', 'skills', 'review', 'SKILL.md'];
const START_SKILL = ['plugin', 'skills', 'start', 'SKILL.md'];

const FIXTURE = [
  ['scripts', 'plugin.js'],
  ['src', 'setup', 'rules.js'],
  ['package.json'],
  ['plugin'],
  ['.claude-plugin'],
  ['.cursor-plugin'],
  ['.github', 'plugin'],
  ['.agents'],
  ['gemini-extension.json'],
  ['skills']
];

const GENERATED = [
  MARKETPLACE,
  ROOT_PLUGIN,
  PLUGIN,
  ['.cursor-plugin', 'marketplace.json'],
  ['.cursor-plugin', 'plugin.json'],
  ['.github', 'plugin', 'marketplace.json'],
  ['.agents', 'plugins', 'marketplace.json'],
  ['plugin', '.cursor-plugin', 'plugin.json'],
  ['plugin', '.codex-plugin', 'plugin.json'],
  ['plugin', 'plugin.json'],
  ['plugin', '.mcp.json'],
  ['plugin', 'mcp.json'],
  ['gemini-extension.json'],
  SKILL,
  ['skills', 'review', 'SKILL.md'],
  ['skills', 'start', 'SKILL.md']
];

/* The script resolves everything from its own location, so a copy of the tree
   in a temp directory is a whole repository as far as it is concerned — which
   is what lets these tests break the plugin without breaking the repository. */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'tailr-plugin-'));
  for (const path of FIXTURE) {
    cpSync(at(...path), join(dir, ...path), { recursive: true });
  }
  return dir;
}

function run(dir, ...args) {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'scripts', 'plugin.js'), ...args],
      { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out, err: '' };
  } catch (e) {
    return { code: e.status, out: e.stdout || '', err: e.stderr || '' };
  }
}

const edit = (dir, path, fn) => {
  const file = join(dir, ...path);
  writeFileSync(file, fn(readFileSync(file, 'utf8')));
};

function frontmatter(path) {
  const skill = read(...path);
  assert.match(skill, /^---\n/, 'frontmatter has to open the file');
  return skill.slice(4, skill.indexOf('\n---', 4));
}

/* ── the repository as it stands ─────────────────────────── */

test('the plugin in this repository is in step with the source', () => {
  const { code, err } = run(ROOT, '--check');
  assert.equal(code, 0, err);
});

/* PROMPT.md is the third copy: the one an agent fetches over HTTP to set the
   project up, before any of this repository is on disk. Nothing generates it,
   so nothing but this catches it teaching a protocol Tailr no longer speaks. */
test('PROMPT.md carries the same rules `tailr init` writes', () => {
  const block = rulesBlock({ mcp: true });
  const body = block.slice(START.length, block.length - END.length).trim();
  assert.ok(read('PROMPT.md').includes(body),
    'PROMPT.md and src/setup/rules.js have diverged — copy the block across.');
});

test('the skill carries the same rules `tailr init` writes', () => {
  const block = rulesBlock({ mcp: true });
  const body = block.slice(START.length, block.length - END.length).trim();
  assert.ok(read(...SKILL).includes(body),
    'SKILL.md and src/setup/rules.js have diverged — run: node scripts/plugin.js --sync');
});

test('the marketplace advertises the plugin that is actually there', () => {
  const entry = load(...MARKETPLACE).plugins.find((p) => p.name === 'tailr');
  const plugin = load(...PLUGIN);
  assert.ok(entry, 'no "tailr" entry in the marketplace listing');
  assert.equal(entry.source, './plugin');
  assert.equal(entry.name, plugin.name, 'installing by name has to reach this plugin');
  assert.equal(entry.version, plugin.version);
  assert.equal(plugin.version, load('package.json').version,
    'the plugin version is what `/plugin update` compares — it has to be the released one');
});

test('every catalog points at the same plugin directory, in the shape that catalog reads', () => {
  const version = load('package.json').version;
  assert.equal(load('.cursor-plugin', 'marketplace.json').plugins[0].source, 'plugin');
  assert.equal(load('.github', 'plugin', 'marketplace.json').plugins[0].source, './plugin');
  assert.equal(load('.agents', 'plugins', 'marketplace.json').plugins[0].source.path, './plugin');
  assert.equal(load('.cursor-plugin', 'marketplace.json').plugins[0].name, 'tailr');
  assert.equal(load('gemini-extension.json').version, version);
  assert.equal(load('plugin', '.codex-plugin', 'plugin.json').version, version);
  assert.equal(load('plugin', 'plugin.json').version, version);
  assert.equal(load('.agents', 'plugins', 'marketplace.json').plugins[0].policy.authentication, 'ON_USE');
});

test('the repository root is a plugin the in-app directory can submit', () => {
  const plugin = load(...PLUGIN);
  const root = load(...ROOT_PLUGIN);
  assert.equal(root.name, plugin.name);
  assert.equal(root.version, plugin.version);
  assert.equal(root.skills, './plugin/skills');
  assert.equal(root.mcpServers, './plugin/.mcp.json');
  const cursor = load('.cursor-plugin', 'plugin.json');
  assert.equal(cursor.skills, './plugin/skills');
  assert.equal(cursor.mcpServers, './plugin/mcp.json');
});

test('the review skill has the frontmatter a skill is found by', () => {
  const front = frontmatter(SKILL);
  assert.match(front, /^name: review$/m, 'the name has to match the directory it lives in');
  const description = front.match(/^description: (.+)$/m);
  assert.ok(description, 'a skill with no description is never triggered');
  assert.ok(description[1].length > 80, 'the description is the whole trigger — it has to say when');
  assert.match(front, /^user-invocable: false$/m,
    'review is the loop, not a slash command — start is the one the user types');
});

test('start is a slash-command skill, not an auto-loaded one', () => {
  const front = frontmatter(START_SKILL);
  assert.match(front, /^name: start$/m, 'the name has to match the directory it lives in');
  assert.match(front, /^disable-model-invocation: true$/m,
    'starting a session is something the user types, not something the model decides');
  assert.match(front, /^description: .+/m);
});

test('Gemini and the skills.sh default path see the same skill files the plugin carries', () => {
  assert.equal(read('skills', 'start', 'SKILL.md'), read(...START_SKILL));
  assert.equal(read('skills', 'review', 'SKILL.md'), read(...SKILL));
});

test('the plugin registers the MCP server Tailr actually ships', () => {
  const { mcpServers } = load('plugin', '.mcp.json');
  const { name } = load('package.json');
  assert.deepEqual(mcpServers.tailr.args.at(-1), 'mcp', 'the MCP server is `tailr mcp`');
  assert.ok(mcpServers.tailr.args.includes(name), `the plugin has to invoke ${name}`);
  // The plugin is installed independently of the project, so the package may
  // not be there yet. Without -y npx stops to ask, and an MCP server that
  // stops to ask never finishes starting.
  assert.ok(mcpServers.tailr.args.includes('-y'),
    'npx must not be able to prompt: nothing is listening to answer it');
  const cursor = load('plugin', 'mcp.json');
  assert.equal(cursor.mcpServers.tailr.type, 'stdio');
  assert.deepEqual(cursor.mcpServers.tailr.args, mcpServers.tailr.args);
  assert.deepEqual(load('gemini-extension.json').mcpServers.tailr.args, mcpServers.tailr.args);
});

test('the Agent Plugins manifest is the portable identity of the same bundle', () => {
  const plugin = load('plugin', 'plugin.json');
  assert.equal(plugin.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(plugin.name, 'tailr');
  assert.equal(plugin.version, load('package.json').version);
});

/* ── the gate itself ─────────────────────────────────────── */

test('--check catches a version that has drifted out of step', () => {
  const dir = fixture();
  edit(dir, ['package.json'], (s) => s.replace(/"version": "[^"]+"/, '"version": "9.9.9"'));
  const { code, err } = run(dir, '--check');
  assert.equal(code, 1);
  assert.match(err, /9\.9\.9/);
  assert.match(err, /--sync/, 'and says how to fix it');
  rmSync(dir, { recursive: true, force: true });
});

test('--check catches a rules block the source has moved on from', () => {
  const dir = fixture();
  const stale = (s) => s.replace('Always close the run', 'Sometimes close the run');
  edit(dir, SKILL, stale);
  edit(dir, ['skills', 'review', 'SKILL.md'], stale);
  const { code, err } = run(dir, '--check');
  assert.equal(code, 1);
  assert.match(err, /rules block/);
  rmSync(dir, { recursive: true, force: true });
});

test('--check catches a Gemini skill copy that has drifted from the plugin', () => {
  const dir = fixture();
  edit(dir, ['skills', 'review', 'SKILL.md'], (s) => s + '\n');
  const { code, err } = run(dir, '--check');
  assert.equal(code, 1);
  assert.match(err, /not a copy/);
  rmSync(dir, { recursive: true, force: true });
});

test('--check catches a manifest promising a path that is not there', () => {
  const dir = fixture();
  rmSync(join(dir, 'plugin', 'skills', 'start'), { recursive: true, force: true });
  const { code, err } = run(dir, '--check');
  assert.equal(code, 1);
  assert.match(err, /start skill/);
  rmSync(dir, { recursive: true, force: true });
});

test('--sync puts every catalog back in step in one move', () => {
  const dir = fixture();
  edit(dir, ['package.json'], (s) => s.replace(/"version": "[^"]+"/, '"version": "9.9.9"'));
  edit(dir, SKILL, (s) => s.replace('Always close the run', 'Sometimes close the run'));
  assert.equal(run(dir, '--check').code, 1, 'drifted, to begin with');

  const { code, err } = run(dir, '--sync');
  assert.equal(code, 0, err);
  assert.equal(run(dir, '--check').code, 0, 'and in step afterwards');

  const skill = readFileSync(join(dir, ...SKILL), 'utf8');
  assert.match(skill, /Always close the run/, 'the rules came back');
  assert.match(skill, /# Tailr — the review loop/, 'and the hand-written part survived');
  assert.equal(JSON.parse(readFileSync(join(dir, ...PLUGIN), 'utf8')).version, '9.9.9');
  assert.equal(JSON.parse(readFileSync(join(dir, ...ROOT_PLUGIN), 'utf8')).version, '9.9.9');
  assert.equal(JSON.parse(readFileSync(join(dir, 'gemini-extension.json'), 'utf8')).version, '9.9.9');
  assert.equal(JSON.parse(readFileSync(join(dir, '.agents', 'plugins', 'marketplace.json'), 'utf8'))
    .plugins[0].source.path, './plugin');
  assert.equal(
    readFileSync(join(dir, 'skills', 'review', 'SKILL.md'), 'utf8'),
    readFileSync(join(dir, ...SKILL), 'utf8'),
    'the Gemini copy moved with the plugin skill'
  );
  rmSync(dir, { recursive: true, force: true });
});

test('--sync is idempotent, so the version commit is not a diff every time', () => {
  const dir = fixture();
  run(dir, '--sync');
  const before = GENERATED.map((p) => readFileSync(join(dir, ...p), 'utf8'));
  run(dir, '--sync');
  const after = GENERATED.map((p) => readFileSync(join(dir, ...p), 'utf8'));
  assert.deepEqual(after, before);
  rmSync(dir, { recursive: true, force: true });
});

test('an unrecognised mode prints usage rather than doing something', () => {
  const { code, err } = run(ROOT, '--publish');
  assert.equal(code, 2);
  assert.match(err, /usage/);
});
