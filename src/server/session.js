/* Where a running Tailr session records itself, so the agent's CLI commands can
   find the server without being told a port. */
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = '.tailr';
const FILE = join(DIR, 'session.json');

export function writeSession(info) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(info, null, 2));
}

export function readSession() {
  if (!existsSync(FILE)) return null;
  try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return null; }
}

/** Only ever clear a session this process actually registered. A second `tailr`
 *  that fails to bind the port must not deregister the one that is serving. */
export function clearSession() {
  try {
    const current = readSession();
    if (current && current.pid !== process.pid) return;
    rmSync(FILE, { force: true });
  } catch {}
}

/** A session file can outlive the process that wrote it. */
export function isAlive(session) {
  if (!session || !session.pid) return false;
  try { process.kill(session.pid, 0); return true; } catch { return false; }
}
