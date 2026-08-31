/* `tailr init` — make Tailr durable in a project.
 *
 * A setup prompt is read once and then decays: it gets summarized on the way
 * in, and compacted away as the conversation grows. So setup's real job is not
 * to tell the agent the rules, it is to put the rules somewhere the agent
 * re-reads every turn. This command does that, and nothing else it doesn't have
 * to:
 *
 *   1. add @gcrft123/tailr to devDependencies
 *   2. write the operating rules into the project's agent instruction files,
 *      between markers, so re-running updates in place
 *   3. register the MCP server, whose tool descriptions can't be summarized away
 *   4. ignore .tailr/
 *
 * Everything is idempotent and merge-safe: run it again after upgrading and it
 * rewrites its own block, leaving anything around it alone.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rulesBlock, START, END } from './rules.js';

const self = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'), 'utf8'));
const PKG = self.name;

/* Every file that exists gets the block. If none do, AGENTS.md is created —
   it is the one convention more than one agent reads. */
const INSTRUCTION_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  join('.github', 'copilot-instructions.md')
];
const DEFAULT_INSTRUCTION_FILE = 'AGENTS.md';

export function init({ cwd = process.cwd(), install = true, mcp = true, file = null } = {}) {
  const done = [];
  const skipped = [];
  const at = (p) => resolve(cwd, p);

  const mcpTargets = mcp ? registerMcp(at, done, skipped) : [];
  writeRules(at, { mcp: mcpTargets.length > 0 }, file, done);
  if (install) addDependency(at, done, skipped);
  else skipped.push('install skipped (--no-install)');
  ignoreSessionDir(at, done);

  report(done, skipped);
  return { done, skipped };
}

/* ── 1. dependency ───────────────────────────────────────── */

function addDependency(at, done, skipped) {
  const manifest = at('package.json');
  if (!existsSync(manifest)) {
    skipped.push('no package.json here — install Tailr yourself, or use `npx @gcrft123/tailr`');
    return;
  }
  let pkg;
  try { pkg = JSON.parse(readFileSync(manifest, 'utf8')); } catch { pkg = {}; }

  if (pkg.name === PKG) { skipped.push(`${PKG} is this project — nothing to install`); return; }
  if ((pkg.dependencies && pkg.dependencies[PKG]) || (pkg.devDependencies && pkg.devDependencies[PKG])) {
    skipped.push(`${PKG} is already a dependency`);
    return;
  }

  process.stderr.write(`  installing ${PKG}…\n`);
  const r = spawnSync('npm', ['install', '--save-dev', PKG], {
    cwd: dirname(manifest), stdio: 'inherit', shell: process.platform === 'win32'
  });
  if (r.status === 0) done.push(`installed ${PKG} as a devDependency`);
  else skipped.push(`npm install failed — run \`npm install --save-dev ${PKG}\` yourself`);
}

/* ── 2. the rules, where they get re-read ────────────────── */

function writeRules(at, opts, override, done) {
  const block = rulesBlock(opts);
  let targets = override ? [override] : INSTRUCTION_FILES.filter((f) => existsSync(at(f)));
  if (!targets.length) targets = [DEFAULT_INSTRUCTION_FILE];

  for (const target of targets) {
    const path = at(target);
    const existed = existsSync(path);
    const before = existed ? readFileSync(path, 'utf8') : '';
    const had = before.includes(START);
    const after = replaceBlock(before, block);
    if (after === before) { done.push(`${target} already current`); continue; }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, after);
    done.push(had ? `updated the Tailr section of ${target}`
      : existed ? `added the Tailr section to ${target}`
      : `wrote the Tailr section to ${target}`);
  }
}

/** Replace what is between the markers, or append a fresh block. */
function replaceBlock(source, block) {
  const from = source.indexOf(START);
  const to = source.indexOf(END);
  if (from !== -1 && to > from) {
    return source.slice(0, from) + block + source.slice(to + END.length);
  }
  if (!source.trim()) return block + '\n';
  return source.replace(/\s*$/, '\n\n') + block + '\n';
}

/* ── 3. MCP, which survives summarization ────────────────── */

function registerMcp(at, done, skipped) {
  const written = [];
  // .mcp.json is the project-scoped file Claude Code and others read; Cursor
  // keeps its own copy. Only write Cursor's if the project already uses it.
  const targets = ['.mcp.json'];
  if (existsSync(at('.cursor'))) targets.push(join('.cursor', 'mcp.json'));

  for (const target of targets) {
    const path = at(target);
    let config = {};
    if (existsSync(path)) {
      try { config = JSON.parse(readFileSync(path, 'utf8')); }
      catch { skipped.push(`${target} is not valid JSON — left alone`); continue; }
    }
    const servers = config.mcpServers && typeof config.mcpServers === 'object' ? config.mcpServers : {};
    servers.tailr = { command: 'npx', args: [PKG, 'mcp'] };
    config.mcpServers = servers;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
    written.push(target);
    done.push(`registered the tailr MCP server in ${target}`);
  }
  return written;
}

/* ── 4. keep the session file out of git ─────────────────── */

function ignoreSessionDir(at, done) {
  const path = at('.gitignore');
  if (!existsSync(at('.git')) && !existsSync(path)) return;
  const before = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (/^\.tailr\/?\s*$/m.test(before)) return;
  writeFileSync(path, before.replace(/\s*$/, before.trim() ? '\n' : '') + '.tailr/\n');
  done.push('added .tailr/ to .gitignore');
}

/* ── what happened ───────────────────────────────────────── */

function report(done, skipped) {
  const lines = ['', '  Tailr is set up.', ''];
  for (const d of done) lines.push(`    ✓ ${d}`);
  for (const s of skipped) lines.push(`    · ${s}`);
  lines.push(
    '',
    '  Start a session against your dev server, as a long-running background',
    '  process, and review at the URL it prints:',
    '',
    '    npx tailr --target http://localhost:<dev server port>',
    '',
    '  Then wait for a batch. Its exit is your notification:',
    '',
    '    npx tailr wait && npx tailr pull',
    '');
  process.stdout.write(lines.join('\n'));
}
