/* `--target` is typed by a person, so it arrives in every shape a dev server
   address gets said in. Each has one obvious meaning; none should reach the
   proxy as a 502 or the terminal as a stack trace. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTarget } from '../src/server/target.js';

test('a full URL is kept, a trailing slash is not', () => {
  assert.deepEqual(normalizeTarget('http://localhost:5173'), { url: 'http://localhost:5173' });
  assert.deepEqual(normalizeTarget('http://localhost:5173/'), { url: 'http://localhost:5173' });
  assert.deepEqual(normalizeTarget('https://app.local:8443'), { url: 'https://app.local:8443' });
});

test('a path or query is the user’s and stays', () => {
  assert.deepEqual(normalizeTarget('http://localhost:5173/app'), { url: 'http://localhost:5173/app' });
  assert.deepEqual(normalizeTarget('http://localhost:5173/?x=1'), { url: 'http://localhost:5173/?x=1' });
});

test('host:port and a bare port are read the way they were meant', () => {
  assert.deepEqual(normalizeTarget('localhost:5173'), { url: 'http://localhost:5173' });
  assert.deepEqual(normalizeTarget('127.0.0.1:3000'), { url: 'http://127.0.0.1:3000' });
  assert.deepEqual(normalizeTarget('5173'), { url: 'http://localhost:5173' });
  assert.deepEqual(normalizeTarget(' localhost:3000 '), { url: 'http://localhost:3000' });
});

test('what cannot be a dev server URL is refused with a sentence, not a stack trace', () => {
  for (const bad of ['', ':::', 'ftp://x', 'http://', 'ws://localhost:3000']) {
    const r = normalizeTarget(bad);
    assert.ok(r.error, `${JSON.stringify(bad)} is refused`);
    assert.match(r.error, /--target must be a dev server URL/);
  }
});
