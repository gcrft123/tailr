# The Tailr plugin

This directory is the installable bundle: skills, the MCP server, and a
manifest for each agent that has a plugin format. It is not part of the npm
package — `files` in `package.json` keeps it out of the tarball.

The catalogs that point here live at the repository root:

| Catalog | Manifest |
|---|---|
| Claude Code | [`../.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) |
| Cursor | [`../.cursor-plugin/marketplace.json`](../.cursor-plugin/marketplace.json) |
| GitHub Copilot CLI | [`../.github/plugin/marketplace.json`](../.github/plugin/marketplace.json) |
| Codex | [`../.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json) |
| Gemini CLI | [`../gemini-extension.json`](../gemini-extension.json) |

```
plugin/
  .claude-plugin/plugin.json    Claude Code
  .cursor-plugin/plugin.json    Cursor
  .codex-plugin/plugin.json     Codex
  plugin.json                   Agent Plugins / Copilot
  .mcp.json                     Claude, Codex, Copilot (`tailr mcp`)
  mcp.json                      Cursor / Agent Plugins (same server, stdio typed)
  skills/start/SKILL.md         /tailr:start — start a session, hand over the URL
  skills/review/SKILL.md        the operating rules for the review loop
```

The repository root also carries Claude and Cursor plugin manifests that point
into this directory. That is what the in-app directories read when someone
submits `gcrft123/tailr` — they look for a plugin at the repo root, not a
marketplace wrapping one. Marketplace installs still copy only `plugin/`.

Gemini CLI clones the whole repository as an extension, so `skills/` at the
repo root is a copy of `plugin/skills/` — Gemini only discovers skills next to
`gemini-extension.json`.

## What it is for

`tailr init` makes the rules durable by writing them into the project's
`AGENTS.md` / `CLAUDE.md` and registering the MCP server in its `.mcp.json`.
That works, but it edits four files in someone's repository to do it.

The plugin is the same durability by a different route: install it once, and the
rules arrive as a skill and the MCP server as part of the plugin. Nothing in the
user's project is touched, and updating the plugin is how it stays current.

Both routes are supported. The plugin suits someone who reviews across several
projects; `tailr init` suits a project that wants Tailr committed as part of
its own setup.

## Keeping it honest

The rules in `skills/review/SKILL.md` are generated from
[`src/setup/rules.js`](../src/setup/rules.js), the same source `tailr init`
writes from. Every catalog's version, and the Gemini copy of the skills, is
stamped from `package.json`.

    node scripts/plugin.js --check    is every catalog in step with the source?
    node scripts/plugin.js --sync     put them back in step

`--check` runs in the test suite, so CI fails on drift and so does the release
workflow at the tag. `--sync` runs as part of `npm version`, so cutting a
release stamps every catalog without anyone having to remember it.
