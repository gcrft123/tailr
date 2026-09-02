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
| `npx tailr variants <ref> <names…>` | `tailr_variants` | name the versions you built for one mark |
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
- `choice` — the reviewer picked between versions you built. See below.

### Versions

A `comment` or `point` mark can carry `"variations": 3`. That asks for three
different answers to the same comment, all built at once, so the reviewer can
compare them on the running page and keep one.

Build every version into the source together, each guarded on the switch Tailr
sets for that mark: the attribute `data-tailr-var-<ref>` on `<html>`, whose
value is the version number.

    /* mark 03, version 2 */
    [data-tailr-var-03="2"] .cart-total { font-size: 24px; border-radius: 14px }

Version 1 must also be what renders when the attribute is absent, so the page is
never broken for anyone who isn't looking through Tailr. Anything that has to
re-render rather than restyle reads `document.documentElement.dataset.tailrVar03`
and listens for the `tailr:variant` event on `document`; its `detail` carries
`{ ref, variant, label }`.

Then name them, in order, before you report that mark applied:

    npx tailr variants 03 "Softer edges" "Full width" "Two columns"

One to three concrete words each. They are the whole basis on which someone who
cannot read the diff decides, so `"Two columns"` earns its place and
`"Option B"` does not.

A `choice` mark closes it. It carries `variantOf` (the ref whose versions are
being settled) and `variant`:

- `variant: 2` — keep version 2 as the plain, unguarded code. Delete the other
  versions and every `data-tailr-var-<ref>` guard for that ref.
- `variant: 0` — keep none of them. Remove all the versions and the guards, and
  put the element back the way it was before you built them.

### Rules that matter

- Run `wait` as a long-running background process and treat its exit as the
  notification. Never ask the reviewer to tell you a batch has arrived, and
  never poll for one. Start it again after each run you close.
- The reviewer can end the session from the page, which stops the server. `wait`
  then exits 2 and `.tailr/session.json` is gone. That is them finishing, not a
  crash: don't restart the session, and don't ask them to reopen the review URL.
  A last batch of `choice` marks usually arrives just before it — that is the
  cleanup, and it is the one batch worth closing quickly, because they are
  waiting on it to leave.
- Report each mark with `progress` as you land it, not all at once at the end.
  The reviewer watches them clear on screen; batching makes it look like nothing
  is happening.
- Always close the run with `done` or `fail`. Until you do, the reviewer cannot
  send another batch. If you hit something you can't do, `fail` with what
  actually went wrong — Tailr won't invent an explanation, it points them back
  to you.
- The guards are scaffolding, not code. They live for exactly one round trip:
  you write them when a mark asks for versions, and the `choice` mark that comes
  back is what takes them out. Never leave a guard standing after its choice has
  landed, and never write one for anything the reviewer didn't ask to see
  versions of.
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
