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
