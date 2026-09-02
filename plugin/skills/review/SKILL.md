---
name: review
description: The Tailr review loop — wait for the reviewer's batch of visual markup on the running dev server, apply each mark, and report it as it lands. Use whenever a Tailr session is running or being started, whenever a batch of marks arrives, and whenever the user talks about marking up the app, the review URL, or handing you visual feedback from the browser.
---

# Tailr — the review loop

Tailr lets the person you are working with mark up their running dev server in
the browser — click an element, say what is wrong — and hand you every mark at
once as a batch. You apply the batch and report each mark as it lands.

The rules below are the whole protocol. They are the same rules `tailr init`
writes into a project's `AGENTS.md` / `CLAUDE.md`; this plugin carries them
instead, so nothing in the user's repository has to be edited.

<!-- tailr:start -->

## Tailr — visual markup from the reviewer

The reviewer marks up the running app in the browser and hands you the changes
as one batch. A session is up when `.tailr/session.json` exists; if it doesn't,
start one as a long-running background process — it must stay up, so don't block
your turn waiting on it:

    npx tailr --target http://localhost:<dev server port>

It prints a review URL (usually http://localhost:4100). Tell the reviewer to use
that URL, not the original port. Tailr proxies the app and injects its overlay;
the source is not modified.

The loop is `wait` → `pull` → `progress` per mark → `done` or `fail`.

| Command | MCP tool | |
|---|---|---|
| `npx tailr status` | `tailr_status` | is a batch waiting? exit 0 yes · 3 session up, nothing waiting · 2 no session |
| `npx tailr wait` | `tailr_wait` | block until Send is pressed; exit 0 a batch is waiting · 3 timed out, start it again · 2 session ended |
| `npx tailr pull` | `tailr_pull` | lease the batch, printed as JSON |
| `npx tailr progress <ref>` | `tailr_progress` | report one mark as applied |
| `npx tailr done` | `tailr_done` | the run finished |
| `npx tailr fail "reason"` | `tailr_fail` | it returned incomplete |

Each mark carries a `ref` ("01"), a `type`, the `route` it was made on, a
best-effort source `address`, a CSS `selector`, the element's text, and the
reviewer's `comment`.

- `comment` — change that element as described
- `remove` — delete that element
- `text` — carries `before`/`after`; change the text to `after`
- `point` — carries page `x`/`y` instead of an element. The reviewer marked a
  place, not a thing: they may want something new there, or may just be noting
  the spot. Their comment says which.

### Rules that matter

- Run `wait` as a long-running background process and treat its exit as the
  notification. Never ask the reviewer to tell you a batch has arrived, and
  never poll for one. Start it again after each run you close.
- Report each mark with `progress` as you land it, not all at once at the end.
  The reviewer watches them clear on screen; batching makes it look like nothing
  is happening.
- Always close the run with `done` or `fail`. Until you do, the reviewer cannot
  send another batch. If you hit something you can't do, `fail` with what
  actually went wrong — Tailr won't invent an explanation, it points them back
  to you.
- When the source address and the selector disagree, trust the source address.
- A mark with `"orphaned": true` lost its element before it was sent. Don't
  guess at what was meant — raise it with the reviewer.
- If a mark is ambiguous, ask rather than picking an interpretation.
- Run these commands from the project directory; that's how Tailr finds the
  session.
<!-- tailr:end -->

## Running the commands from this plugin

This plugin registers Tailr's **MCP server**, so `tailr_status`, `tailr_wait`,
`tailr_pull`, `tailr_progress`, `tailr_done` and `tailr_fail` are available to
you directly. Prefer them to the CLI: they are always present, whereas the
`npx tailr` shorthand only resolves in a project that has installed Tailr.

Where you do reach for the CLI, use the full package name so it works in a
project that has not installed anything:

    npx -y @gcrft123/tailr <command>

Starting a session is the one step with no MCP tool, because the session is the
server those tools talk to. Start it as a long-running background process — it
has to stay up, so don't block your turn waiting on it:

    npx -y @gcrft123/tailr --target http://localhost:<dev server port>

If the project has Tailr as a dependency, plain `npx tailr` is equivalent and
shorter.
