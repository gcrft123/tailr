/* `tailr init` is the only thing in Tailr that edits a user's files. Its whole
   licence to do that rests on being idempotent and merge-safe: it rewrites its
   own block and leaves everything around it alone. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../src/setup/init.js';
import { START, END } from '../src/setup/rules.js';
import { silently } from './helpers.js';

const project = () => mkdtempSync(join(tmpdir(), 'tailr-init-'));
const run = (cwd, opts = {}) => silently(() => init({ cwd, install: false, ...opts }));
const read = (cwd, f) => readFileSync(join(cwd, f), 'utf8');

test('a fresh project gets the rules, the MCP entry, and nothing else', async () => {
  const cwd = project();
  run(cwd);

  const rules = read(cwd, 'AGENTS.md');
  assert.ok(rules.includes(START) && rules.includes(END), 'the block is marked off');
  assert.match(rules, /## Tailr — visual markup from the reviewer/);
  assert.match(rules, /tailr_wait/, 'the MCP tools are named when they are registered');

  const mcp = JSON.parse(read(cwd, '.mcp.json'));
  assert.deepEqual(mcp.mcpServers.tailr, { command: 'npx', args: ['@gcrft123/tailr', 'mcp'] });

  assert.equal(existsSync(join(cwd, 'package.json')), false, 'nothing else is created');
});

test('running it again changes nothing', async () => {
  const cwd = project();
  run(cwd);
  const first = { rules: read(cwd, 'AGENTS.md'), mcp: read(cwd, '.mcp.json') };

  run(cwd);
  assert.equal(read(cwd, 'AGENTS.md'), first.rules, 'byte-identical on a re-run');
  assert.equal(read(cwd, '.mcp.json'), first.mcp);
});

test('it rewrites its own block in place instead of stacking copies', async () => {
  const cwd = project();
  run(cwd, { mcp: false });
  const withoutMcp = read(cwd, 'AGENTS.md');
  assert.doesNotMatch(withoutMcp, /tailr_wait/, 'no MCP column when nothing was registered');

  run(cwd, { mcp: true });
  const withMcp = read(cwd, 'AGENTS.md');

  assert.equal(withMcp.split(START).length - 1, 1, 'exactly one block');
  assert.equal(withMcp.split(END).length - 1, 1);
  assert.match(withMcp, /tailr_wait/, 'and it was updated, not appended to');
});

test('a project that already has instructions keeps them', async () => {
  const cwd = project();
  const existing = '# House rules\n\nAlways run the linter.\n';
  writeFileSync(join(cwd, 'AGENTS.md'), existing);

  run(cwd);
  const after = read(cwd, 'AGENTS.md');
  assert.ok(after.startsWith(existing.trimEnd()), 'the project’s own text stays at the top, untouched');
  assert.ok(after.includes(START));

  // and text added *after* the block survives the next run
  writeFileSync(join(cwd, 'AGENTS.md'), after + '\n## Deploys\n\nAsk first.\n');
  run(cwd);
  assert.match(read(cwd, 'AGENTS.md'), /## Deploys\n\nAsk first\./);
});

test('every instruction file the project actually uses gets the block', async () => {
  const cwd = project();
  writeFileSync(join(cwd, 'CLAUDE.md'), '# Claude\n');
  mkdirSync(join(cwd, '.github'), { recursive: true });
  writeFileSync(join(cwd, '.github', 'copilot-instructions.md'), '# Copilot\n');

  run(cwd);

  assert.ok(read(cwd, 'CLAUDE.md').includes(START));
  assert.ok(read(cwd, '.github/copilot-instructions.md').includes(START));
  assert.equal(existsSync(join(cwd, 'AGENTS.md')), false,
    'AGENTS.md is the fallback, not an extra file forced on a project that has its own');
});

test('--file sends the rules somewhere else entirely', async () => {
  const cwd = project();
  run(cwd, { file: 'docs/agent.md' });

  assert.ok(read(cwd, 'docs/agent.md').includes(START), 'nested paths are created');
  assert.equal(existsSync(join(cwd, 'AGENTS.md')), false);
});

test('an existing MCP config keeps its other servers', async () => {
  const cwd = project();
  writeFileSync(join(cwd, '.mcp.json'),
    JSON.stringify({ mcpServers: { other: { command: 'node', args: ['x.js'] } } }, null, 2));

  run(cwd);
  const mcp = JSON.parse(read(cwd, '.mcp.json'));
  assert.ok(mcp.mcpServers.other, 'someone else’s server is left alone');
  assert.ok(mcp.mcpServers.tailr);
});

test('an MCP config that is not valid JSON is left alone rather than clobbered', async () => {
  const cwd = project();
  writeFileSync(join(cwd, '.mcp.json'), '{ not json');

  const { skipped } = run(cwd);
  assert.equal(read(cwd, '.mcp.json'), '{ not json', 'untouched');
  assert.ok(skipped.some((s) => s.includes('not valid JSON')), 'and said so');
});

test('cursor’s copy is written only for projects that use cursor', async () => {
  const plain = project();
  run(plain);
  assert.equal(existsSync(join(plain, '.cursor', 'mcp.json')), false);

  const cursor = project();
  mkdirSync(join(cursor, '.cursor'));
  run(cursor);
  assert.ok(existsSync(join(cursor, '.cursor', 'mcp.json')));
});

test('the session file is ignored once, not on every run', async () => {
  const cwd = project();
  writeFileSync(join(cwd, '.gitignore'), 'node_modules/\n');

  run(cwd);
  run(cwd);

  const ignore = read(cwd, '.gitignore');
  assert.equal(ignore.match(/^\.tailr\/$/gm).length, 1);
  assert.match(ignore, /node_modules\//, 'existing entries survive');
});
