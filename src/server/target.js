/* What people type for a dev server is not always a URL. `localhost:5173`,
   `5173` and `127.0.0.1:3000` all mean something obvious, and a proxy that
   answers them with a 502 — or a stack trace — is asking for the one form it
   accepts rather than reading the one it was given. */

/** @returns {{ url: string } | { error: string }} */
export function normalizeTarget(raw) {
  const typed = String(raw ?? '').trim();
  let s = typed;
  if (/^\d{1,5}$/.test(s)) s = `http://localhost:${s}`;
  else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `http://${s}`;
  let url;
  try { url = new URL(s); } catch { url = null; }
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) {
    return { error: `--target must be a dev server URL, like http://localhost:3000 — not "${typed}".` };
  }
  // A bare origin keeps the form people expect to see echoed back; a path is
  // theirs and stays as typed.
  const href = url.pathname === '/' && !url.search && !url.hash ? url.origin : url.href;
  return { url: href };
}
