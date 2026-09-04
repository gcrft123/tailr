# Changelog

Everything notable that has changed in Tailr, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Every release is a `vX.Y.Z` git tag. Pushing that tag is what publishes to npm
and cuts the matching [GitHub Release](https://github.com/gcrft123/tailr/releases),
and the notes it carries are the section below that bears its version — so a
release with nothing written here does not go out. See [RELEASING.md](RELEASING.md).

## [Unreleased]

### Added

- `/tailr:start` is a slash-command skill. Typing it starts a session against
  the dev server and begins watching for the first batch; the model will not
  fire it on its own. The review loop stays a background skill, loaded when a
  batch is in play rather than offered as a second command.
- Plugin catalogs for Cursor, Codex, GitHub Copilot CLI, and Gemini CLI, so the
  same bundle that Claude Code installs is what those agents install too. Agents
  without a marketplace of their own take the skills globally through
  `npx skills add gcrft123/tailr -g`.

### Fixed

- The Claude Code app would not add Tailr from this repository. It looks for a
  plugin at the repo root (`.claude-plugin/plugin.json`, `.mcp.json`, skills)
  and the `owner/repo` marketplace shorthand clones over SSH, which the app
  cannot complete. The root now carries a plugin manifest that points into
  `plugin/`, the MCP server lives at `.mcp.json` where the app discovers it,
  and the README's add command is the HTTPS git URL.
- Latched markup read what someone was typing as commands. With the mode on, a
  caret in the application's own text box — or in the one Tailr opens to edit
  text in place — lost `c`, `r` and `e` to the comment, remove and edit verbs
  and the arrow keys to structural walking, and the characters never reached the
  field. A keystroke on its way into an input, a textarea, a select or a
  contenteditable is now typing rather than a shortcut. Escape still reaches
  Tailr from a field of the application's, where it is not swallowed and the
  field answers it too; the exception is Tailr's own inline editor, which
  answers Escape by putting the text back without also dropping the mode the
  reviewer was editing from.

## [1.1.0] — 2026-09-02

### Added

- Versions. A comment on an element or a spot can ask for up to four answers
  instead of one: the composer carries a `1×` button beside Add that cycles to
  `4×`. The agent builds every version at once, each guarded on an attribute
  Tailr sets on `<html>`, and names it in a word or three. After the reload a
  pill sits on the element with a tab per version — hover one and it widens to
  the name while the page switches to that version live, so the comparison is
  between the real things rather than between two descriptions of them.
- Keeping a version is a mark like any other. It joins the batch, and sending it
  is what makes that version permanent and takes the losing ones — and the
  guards — out of the source. Turning the whole set down is the `×` on its row.
  An unresolved set keeps the island awake, because the alternative is versions
  sitting in someone's repository with nothing on screen that would remove them.
- `tailr variants <ref> <names…>`, and the matching `tailr_variants` MCP tool,
  for reporting what was built. The operating rules carry the whole contract:
  where the switch lives, that version 1 must also be what renders without it,
  and that a guard never outlives the choice that settles it.
- A way out. **End session** sits under the island's panel, and it asks before
  it acts: the card names what is being agreed to, one consequence per line —
  the marks that go unsent, the versions that get cleaned up, the address the
  application goes back to once Tailr stops proxying, and that the browser is
  cleared. Until now the only way to end a session was a terminal the reviewer
  does not have.
- A cleanup pass on the way out, because ending is the last moment anything can
  be done about what Tailr left behind. Versions nobody chose between go to the
  agent as one final batch that takes them, and the switches guarding them, out
  of the source; the switches come off the document; what Tailr kept in the
  browser is cleared; the server stops and the overlay takes itself off the
  page. If the agent never answers, **End anyway** leaves regardless and says
  the cleanup did not finish rather than implying it did.

### Fixed

- A session was good for exactly one batch. The server keeps the last run
  indefinitely, so a reviewer who reloaded was handed a finished run again and
  the overlay re-entered its "Needs refresh" state — against changes they were
  already looking at — with Send locked and no way back. A closed run now only
  prompts the page that watched it close.

## [1.0.0] — 2026-09-02

### Added

- A Claude Code plugin, with this repository as its marketplace:
  `/plugin marketplace add gcrft123/tailr`, then `/plugin install tailr@tailr`.
  It carries the MCP server, the operating rules as a skill, and a `/tailr:start`
  command — the same setup `tailr init` performs, without editing anything in the
  project, and updatable from `/plugin` rather than by re-running a script. The
  rules in it are generated from the same source `init` writes from, and the
  version it advertises is stamped when a release is cut; `npm test` fails if
  either drifts, so an installed plugin cannot quietly fall behind the protocol
  Tailr actually speaks.
- A release flow keyed to the tags: pushing `vX.Y.Z` verifies the tag against
  the manifest, runs the tests, publishes to npm with provenance, and cuts a
  GitHub Release from this file. Publishing authenticates as a trusted publisher
  over OIDC, so no npm token is stored anywhere. `npm version` is the whole
  interface to it.
- A test suite — `npm test`, no dependencies — covering the bridge state machine
  and its refusals, the proxy's injection and passthrough, the three outcomes of
  `tailr wait`, and the idempotence of `tailr init`. CI runs it on Node 18, 20
  and 22, and fails if Tailr ever takes on a runtime dependency.
- Source resolution reads more of what dev tooling already emits:
  `data-v-inspector` (Vue), `data-inspector-relative-path` (react-dev-inspector),
  `data-astro-source-file` (Astro), Svelte's `__svelte_meta`, and a generic
  `data-source`, alongside the React fibers and `data-tailr-source` it already
  read. Windows paths and trailing column numbers are handled.
- `npm run demo` starts the demo app itself instead of expecting one on a port
  nothing had started.

### Fixed

- An `https://` target crashed the session process on the first page request.
  https dev servers are now proxied, hot-reload upgrade included, and a
  self-signed certificate is accepted — a local dev server's always is.
- Rewritten HTML carried both the upstream's `transfer-encoding: chunked` and a
  freshly computed `content-length`. Strict clients refuse that combination
  outright, and every dev server streams its HTML. HTML arriving compressed is
  now passed through whole rather than decoded as utf-8 and injected into.
- `tailr status` exited `0` while the agent's own run was still in flight,
  reporting leased work back to it as a waiting batch. It now reports what the
  server calls pending.
- Closing a run that was already closed returned `500 Server error.` rather than
  `409 No open run.` — an agent retrying `tailr done` after a dropped connection
  could not tell that apart from a real failure.
- A synchronous failure inside the proxy took the whole session down with it. It
  now costs one page, and the review URL stays up.

### Changed

- `PRODUCT.md` no longer describes the project as having no implementation, and
  states exactly how far source resolution reaches. The overlay surface doc
  describes the Island that shipped rather than the withdrawn Callout direction.

## [0.3.0] — 2026-08-31

### Added

- `tailr init`: installs Tailr, registers its MCP server in `.mcp.json` (and
  Cursor's copy where a project uses it), and writes the agent's operating rules
  into `AGENTS.md` / `CLAUDE.md` between markers, so re-running rewrites its own
  block and leaves everything around it alone. A setup prompt is read once and
  then falls out of context; these rules have to hold for the whole session.
- `PROMPT.md`, an agent-facing setup document, replacing `SETUP-PROMPT.md`.
- `tailr wait` and the `tailr_wait` MCP tool: hang on the session's event stream
  and return within a moment of Send being pressed, so an agent learns a batch
  has arrived without polling and without asking the reviewer to announce it.
  Exit `0` a batch is waiting · `3` timed out · `2` the session ended.
- `tailr pull --wait`, and `wait: true` on the `tailr_pull` MCP tool.

### Fixed

- Double-click to edit did nothing on elements with no children.

### Changed

- The MCP server reports its version from the package manifest instead of a
  string kept in step by hand.

## [0.2.0] — 2026-08-30

### Fixed

- Two Tailr sessions in one project fought over `.tailr/session.json`: a second
  `tailr` that failed to bind the port would deregister the session that was
  actually serving. A session file is now only ever cleared by the process that
  wrote it.

## [0.1.0] — 2026-08-30

First published release.
