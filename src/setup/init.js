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
  const ruleFiles = writeRules(at, { mcp: mcpTargets.length > 0 }, file, done);
  if (install) addDependency(at, done, skipped);
  else skipped.push('install skipped (--no-install)');
  ignoreSessionDir(at, done);

  report(done, skipped, ruleFiles);
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
  return targets;
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
    // `-y`, so a client that launches this before anything is installed — a
    // `--no-install` project, or a stdin that is not a terminal — never stalls on
    // npx asking whether it may fetch the package. It is what the plugin uses too.
    servers.tailr = { command: 'npx', args: ['-y', PKG, 'mcp'] };
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

/** `a`, `a and b`, `a, b and c` — however many instruction files a project has. */
function list(items) {
  if (items.length < 3) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Wrap a paragraph to the width the rest of this report is written at. */
function wrap(text, width = 72, indent = '  ') {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > width) { lines.push(indent + line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(indent + line);
  return lines;
}

/* Whoever typed the command is who reads this, and that is as often a person
   as an agent — the README offers `init` to both. So it is written for the
   person, who has nowhere else to learn what happens next. An agent reading a
   sentence meant for someone else loses nothing: the rules this command just
   wrote say what to do, in the file it re-reads every turn, which is the whole
   point of the command. Telling it twice here is what used to leave the person
   holding `wait` and `pull`, which are not theirs to run. */
function report(done, skipped, ruleFiles = []) {
  const lines = ['', '  Tailr is set up.', ''];
  for (const d of done) lines.push(`    ✓ ${d}`);
  for (const s of skipped) lines.push(`    · ${s}`);
  // A project can carry four instruction files, so the sentence naming them
  // is wrapped rather than written out at one guessed length.
  const where = ruleFiles.length ? list(ruleFiles) : DEFAULT_INSTRUCTION_FILE;
  lines.push(
    '',
    ...wrap(`The rules for the review loop are in ${where} now, where your agent ` +
      're-reads them every turn. Ask it to start a Tailr session against your ' +
      'dev server and it will hand you a review URL — mark the page there, ' +
      'rather than on the dev server\'s own port.'),
    '',
    '  To start the session yourself instead:',
    '',
    '    npx tailr --target http://localhost:<dev server port>',
    '');
  process.stdout.write(lines.join('\n'));
}
