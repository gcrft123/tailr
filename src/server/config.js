/* The reviewer's own preferences.
 *
 * These are about the person, not the project — which key they hold to mark,
 * whether Tailr makes a sound — so they live once in their home directory and
 * follow them into every project, rather than being set again in each one.
 * `.tailr/` in the project stays what it has always been: one running session.
 *
 * A running server holds the settings in memory and publishes them to the
 * overlay; writing them is this file's job, and the agent's side (`tailr
 * config`, the tailr_config MCP tool) does both — write here, then tell any
 * live session, so a change lands on the page without a reload.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readSession, isAlive } from './session.js';

/* Overridable so a test never writes to the machine it is running on. */
export function configDir() {
  return process.env.TAILR_HOME || join(homedir(), '.tailr');
}
export function configFile() {
  return join(configDir(), 'config.json');
}

/** One entry per setting. Adding a setting is adding an entry here. */
export const SETTINGS = {
  sfx: {
    default: true,
    values: 'true | false',
    summary: 'A short sound on every action — a mark made or dropped, a batch sent, a run closing.',
    parse(raw) {
      const v = String(raw).trim().toLowerCase();
      if (['true', 'on', 'yes', '1'].includes(v)) return { value: true };
      if (['false', 'off', 'no', '0'].includes(v)) return { value: false };
      return { error: `sfx is true or false, not "${raw}".` };
    }
  },
  modifier: {
    default: 'alt',
    values: 'alt | ctrl | cmd',
    summary: 'The key held to arm marking. Shown as ⌥/⌃/⌘ on a Mac.',
    parse(raw) {
      const v = String(raw).trim().toLowerCase();
      /* `cmd` is what people call it and `meta` is what the browser calls it;
         one canonical value, so the overlay has a single thing to test. */
      const alias = {
        alt: 'alt', option: 'alt', opt: 'alt',
        ctrl: 'ctrl', control: 'ctrl',
        cmd: 'meta', command: 'meta', meta: 'meta', super: 'meta', win: 'meta'
      };
      if (alias[v]) return { value: alias[v] };
      return { error: `modifier is alt, ctrl or cmd, not "${raw}".` };
    },
    /* Stored as the browser names it, read back as the reviewer typed it. */
    show(value) { return value === 'meta' ? 'cmd' : value; }
  }
};

export const KEYS = Object.keys(SETTINGS);

export function defaults() {
  const out = {};
  for (const key of KEYS) out[key] = SETTINGS[key].default;
  return out;
}

/** The settings as they stand. A file that is missing, unreadable, or carries
 *  a value this version no longer accepts falls back to the default for that
 *  key rather than to nothing — a stale preference must not disarm Tailr. */
export function readConfig() {
  const config = defaults();
  let stored = null;
  try { stored = JSON.parse(readFileSync(configFile(), 'utf8')); } catch { return config; }
  if (!stored || typeof stored !== 'object') return config;
  for (const key of KEYS) {
    if (!(key in stored)) continue;
    const parsed = SETTINGS[key].parse(stored[key]);
    if (!parsed.error) config[key] = parsed.value;
  }
  return config;
}

/** Merge a patch of already-parsed values in and persist the result. */
export function writeConfig(patch) {
  const config = { ...readConfig(), ...patch };
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(configFile(), JSON.stringify(config, null, 2) + '\n');
  return config;
}

/**
 * Turn `["sfx:false", "modifier=cmd"]` into a patch. Bare `key value` pairs
 * work too, because that is how someone types it half the time.
 * Returns every error rather than the first: being told about one typo, fixing
 * it, and being told about the next is a worse way to find out about both.
 */
export function parseSettings(tokens) {
  const patch = {};
  const errors = [];
  const parts = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = String(tokens[i]).trim();
    if (!token) continue;
    const split = token.match(/^([^:=]+)[:=](.*)$/);
    if (split) { parts.push([split[1], split[2]]); continue; }
    // `sfx false` — the value is the next token, if there is one.
    if (i + 1 < tokens.length && !/[:=]/.test(String(tokens[i + 1]))) {
      parts.push([token, tokens[++i]]);
      continue;
    }
    errors.push(`"${token}" is not a setting. Write it as name:value, e.g. sfx:false.`);
  }

  for (const [rawKey, rawValue] of parts) {
    const key = rawKey.trim().toLowerCase();
    if (!SETTINGS[key]) {
      errors.push(`There is no "${key}" setting. Tailr has: ${KEYS.join(', ')}.`);
      continue;
    }
    if (rawValue === '') {
      errors.push(`${key} was given no value. It takes ${SETTINGS[key].values}.`);
      continue;
    }
    const parsed = SETTINGS[key].parse(rawValue);
    if (parsed.error) errors.push(parsed.error);
    else patch[key] = parsed.value;
  }

  return { patch, errors };
}

/**
 * Write the settings, then tell a running session so the change lands on the
 * page the reviewer is already looking at. No session is not a failure — the
 * next one reads the file at startup — so the caller is told which it was
 * rather than being handed an error for the ordinary case.
 */
export async function applyConfig(patch) {
  const config = writeConfig(patch);
  const session = readSession();
  if (!session || !isAlive(session)) return { config, live: false };
  try {
    const res = await fetch(`http://127.0.0.1:${session.port}/__tailr/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config })
    });
    return { config, live: res.ok };
  } catch {
    return { config, live: false };
  }
}

/** The marking key as a person would say it out loud. The overlay draws the
 *  platform's own legend, which needs a font behind it; a terminal gets the
 *  word. Either way nothing hardcodes Alt, because the reviewer can move it. */
export function modifierLabel(config) {
  const value = (config && config.modifier) || SETTINGS.modifier.default;
  if (value === 'ctrl') return 'Ctrl';
  if (value === 'meta') return process.platform === 'darwin' ? 'Cmd' : 'Win';
  return 'Alt';
}

/** How the settings read back to a person, one per line. */
export function describeConfig(config) {
  return KEYS.map((key) => {
    const setting = SETTINGS[key];
    const value = setting.show ? setting.show(config[key]) : config[key];
    return `    ${key.padEnd(9)} ${String(value).padEnd(7)}` +
      (config[key] === setting.default ? '(default)  ' : '           ') + setting.summary;
  }).join('\n');
}
