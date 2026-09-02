# The Tailr Claude plugin

This directory is the Claude Code plugin, published through the marketplace
manifest at [`../.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json).
It is not part of the npm package — `files` in `package.json` keeps it out of
the tarball.

```
plugin/
  .claude-plugin/plugin.json    the manifest an install reads
  mcp.json                      registers `tailr mcp` as an MCP server
  commands/start.md             /tailr:start — start a session, hand over the URL
  skills/review/SKILL.md        the operating rules for the review loop
```

## What it is for

`tailr init` makes the rules durable by writing them into the project's
`AGENTS.md` / `CLAUDE.md` and registering the MCP server in its `.mcp.json`.
That works, but it edits four files in someone's repository to do it.

The plugin is the same durability by a different route: install it once, and the
rules arrive as a skill and the MCP server as part of the plugin. Nothing in the
user's project is touched, and `/plugin update` is how it stays current.

Both routes are supported. The plugin suits someone who reviews across several
projects; `tailr init` suits a project that wants Tailr committed as part of its
own setup.

## Keeping it honest

The rules in `skills/review/SKILL.md` are generated from
[`src/setup/rules.js`](../src/setup/rules.js), the same source `tailr init`
writes from, and the version in both manifests is stamped from `package.json`.

    node scripts/plugin.js --check    is the plugin in step with the source?
    node scripts/plugin.js --sync     put it back in step

`--check` runs in the test suite, so CI fails on drift and so does the release
workflow at the tag. `--sync` runs as part of `npm version`, so cutting a
release stamps the plugin without anyone having to remember it.
