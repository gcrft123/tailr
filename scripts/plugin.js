#!/usr/bin/env node
/* Every catalog copy of Tailr, kept honest.
 *
 * Tailr is installed through several agent marketplaces, each of which reads a
 * different manifest. The skills and the MCP server are one directory (`plugin/`);
 * these files are the signposts that point at it. They are generated rather than
 * edited, so a version bump cannot update Claude and leave Codex advertising 1.0.0.
 *
 *   node scripts/plugin.js --check   is every catalog in step with the source?
 *   node scripts/plugin.js --sync    put them back in step
 *
 * `--sync` runs as part of `npm version`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rulesBlock, START, END } from '../src/setup/rules.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'tailr';
const DESC = 'Visual markup on a running dev server, handed to the agent as one locked batch. Registers Tailr\'s MCP server and the operating rules for the review loop.';
const KEYWORDS = ['dev-server', 'feedback', 'agent', 'overlay', 'markup', 'mcp', 'design-review'];
const OWNER = { name: 'gcrft123', url: 'https://github.com/gcrft123' };
const HOME = 'https://github.com/gcrft123/tailr#readme';
const REPO = 'https://github.com/gcrft123/tailr';
const SHORT = 'Mark up a running dev server and hand the changes to your coding agent as one batch.';
const REVIEW = join(ROOT, 'plugin', 'skills', 'review', 'SKILL.md');

function fail(message) {
  process.stderr.write(`\n  ${message}\n\n`);
  process.exit(1);
}

function json(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (err) { fail(`${rel(path)}: ${err.code === 'ENOENT' ? 'missing' : 'not valid JSON'}.`); }
}

function read(path) {
  try { return readFileSync(path, 'utf8'); }
  catch (err) { fail(`${rel(path)}: ${err.code === 'ENOENT' ? 'missing' : err.message}.`); }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

function rel(path) { return path.slice(ROOT.length + 1); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function at(...p) { return join(ROOT, ...p); }

function identity(version) {
  return {
    name: NAME,
    description: DESC,
    version,
    author: { name: 'gcrft123' },
    homepage: HOME,
    repository: REPO,
    license: 'MIT',
    keywords: KEYWORDS
  };
}

function servers(pkgName) {
  return { tailr: { command: 'npx', args: ['-y', pkgName, 'mcp'] } };
}

/** The rules, as they should appear inside the skill: the same text `tailr
 *  init` writes, still between its markers so `--sync` can find it again. */
function rulesRegion() {
  const block = rulesBlock({ mcp: true });
  const body = block.slice(START.length, block.length - END.length).trim();
  return `${START}\n\n${body}\n${END}`;
}

function skillNames() {
  const dir = at('plugin', 'skills');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function skillCopies() {
  return skillNames().map((name) => [
    at('plugin', 'skills', name, 'SKILL.md'),
    at('skills', name, 'SKILL.md')
  ]);
}

function catalogs(version, pkgName) {
  const id = identity(version);
  const listing = {
    name: NAME,
    description: DESC,
    version,
    author: { name: 'gcrft123' },
    source: './plugin',
    category: 'design',
    homepage: HOME,
    license: 'MIT',
    tags: KEYWORDS
  };
  const mcp = servers(pkgName);
  return [
    [at('plugin', '.claude-plugin', 'plugin.json'), id],
    [at('plugin', '.cursor-plugin', 'plugin.json'), { ...id, displayName: 'Tailr' }],
    [at('plugin', 'plugin.json'), {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      ...id
    }],
    [at('plugin', '.codex-plugin', 'plugin.json'), {
      ...id,
      skills: './skills/',
      mcpServers: './.mcp.json',
      interface: {
        displayName: 'Tailr',
        shortDescription: SHORT,
        developerName: 'gcrft123',
        category: 'Productivity',
        websiteURL: REPO
      }
    }],
    [at('plugin', '.mcp.json'), { mcpServers: mcp }],
    [at('plugin', 'mcp.json'), {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
      mcpServers: { tailr: { type: 'stdio', ...mcp.tailr } }
    }],
    [at('.claude-plugin', 'plugin.json'), {
      ...id,
      skills: './plugin/skills',
      mcpServers: './plugin/.mcp.json'
    }],
    [at('.claude-plugin', 'marketplace.json'), {
      $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
      name: NAME,
      owner: OWNER,
      metadata: { description: SHORT },
      plugins: [listing]
    }],
    [at('.cursor-plugin', 'plugin.json'), {
      ...id,
      displayName: 'Tailr',
      skills: './plugin/skills',
      mcpServers: './plugin/mcp.json'
    }],
    [at('.cursor-plugin', 'marketplace.json'), {
      name: NAME,
      owner: { name: 'gcrft123' },
      metadata: { description: SHORT },
      plugins: [{ name: NAME, source: 'plugin', description: DESC }]
    }],
    [at('.github', 'plugin', 'marketplace.json'), {
      name: NAME,
      owner: OWNER,
      metadata: { description: SHORT },
      plugins: [listing]
    }],
    [at('.agents', 'plugins', 'marketplace.json'), {
      name: NAME,
      interface: { displayName: 'Tailr' },
      plugins: [{
        name: NAME,
        source: { source: 'local', path: './plugin' },
        policy: { installation: 'AVAILABLE', authentication: 'ON_USE' },
        category: 'Productivity'
      }]
    }],
    [at('gemini-extension.json'), {
      name: NAME,
      version,
      description: DESC,
      mcpServers: mcp
    }]
  ];
}

function requiredFiles() {
  return [
    [at('plugin', 'skills', 'review', 'SKILL.md'), 'review skill'],
    [at('plugin', 'skills', 'start', 'SKILL.md'), 'start skill'],
    [at('plugin', '.mcp.json'), '.mcp.json'],
    [at('plugin', 'mcp.json'), 'mcp.json'],
    [at('plugin', '.claude-plugin', 'plugin.json'), 'Claude plugin manifest'],
    [at('plugin', '.cursor-plugin', 'plugin.json'), 'Cursor plugin manifest'],
    [at('plugin', '.codex-plugin', 'plugin.json'), 'Codex plugin manifest'],
    [at('plugin', 'plugin.json'), 'Agent Plugins manifest'],
    [at('gemini-extension.json'), 'Gemini extension manifest']
  ];
}

function brokenCopies() {
  const broken = [];
  for (const [src, dest] of skillCopies()) {
    if (!existsSync(src)) {
      broken.push(`${rel(src)} is missing`);
      continue;
    }
    if (!existsSync(dest) || read(dest) !== read(src)) {
      broken.push(`${rel(dest)} is not a copy of ${rel(src)}`);
    }
  }
  return broken;
}

function brokenPaths() {
  const broken = [];
  for (const [path, label] of requiredFiles()) {
    if (!existsSync(path)) broken.push(`${label} → ${rel(path)}`);
  }
  broken.push(...brokenCopies());
  return broken;
}

function spliceRules(skill) {
  const from = skill.indexOf(START);
  const to = skill.indexOf(END);
  if (from === -1 || to <= from) fail(`${rel(REVIEW)} has no ${START} … ${END} block to write the rules into.`);
  return skill.slice(0, from) + rulesRegion() + skill.slice(to + END.length);
}

const [mode] = process.argv.slice(2);
const pkg = json(at('package.json'));
const version = pkg.version;
const pkgName = pkg.name;

if (mode === '--check') {
  const wrong = [];
  for (const [path, expected] of catalogs(version, pkgName)) {
    if (!existsSync(path)) {
      wrong.push(`${rel(path)} is missing`);
      continue;
    }
    if (!same(json(path), expected)) {
      wrong.push(`${rel(path)} is out of step with package.json ${version}`);
    }
  }
  let skill;
  try { skill = readFileSync(REVIEW, 'utf8'); } catch { fail(`${rel(REVIEW)} is missing.`); }
  if (!skill.includes(rulesRegion())) {
    wrong.push(`${rel(REVIEW)} carries a different rules block than src/setup/rules.js`);
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

  for (const [path, expected] of catalogs(version, pkgName)) {
    let current = null;
    if (existsSync(path)) {
      try { current = JSON.parse(readFileSync(path, 'utf8')); }
      catch { current = null; }
    }
    if (!same(current, expected)) {
      writeJson(path, expected);
      changed.push(rel(path));
    }
  }

  let skill;
  try { skill = readFileSync(REVIEW, 'utf8'); } catch { fail(`${rel(REVIEW)} is missing.`); }
  const spliced = spliceRules(skill);
  if (spliced !== skill) { writeFileSync(REVIEW, spliced); changed.push(rel(REVIEW)); }

  for (const [src, dest] of skillCopies()) {
    const text = read(src);
    mkdirSync(dirname(dest), { recursive: true });
    if (!existsSync(dest) || readFileSync(dest, 'utf8') !== text) {
      writeFileSync(dest, text);
      changed.push(rel(dest));
    }
  }

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

    --check   is every catalog in step with package.json and src/setup/rules.js?
    --sync    put them back in step

`);
  process.exit(2);
}
