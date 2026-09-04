---
name: start
description: "Start a Tailr session against the running dev server and begin watching for the reviewer's first batch of visual markup. Invoke with /tailr:start."
disable-model-invocation: true
argument-hint: "[dev server url, e.g. http://localhost:3000]"
license: MIT
---

# Start a Tailr review session

The user invoked this with: $ARGUMENTS

Carry this out now. Do not summarize it back or ask whether to proceed.

## 1. Find the dev server

If `$ARGUMENTS` names a URL, use it. Otherwise work out where this project's dev
server runs — check `package.json` scripts, the framework's default port, or
whatever is already listening — and start it if it is not up. Ask only if you
genuinely cannot determine it.

## 2. Start Tailr against it

As a **long-running background process**. It has to stay up, so do not block
your turn waiting on it:

    npx -y @gcrft123/tailr --target <dev server url>

It proxies the app on its own port (usually 4100) and injects its overlay.
Nothing in the project's source is modified, and hot reload keeps working.

If it reports the port is taken by an existing session, that session is already
serving — use the URL it names rather than starting a second one.

## 3. Hand over the URL and start watching

In the same message, do both:

- Tell the reviewer the review URL Tailr printed, and that they should use it
  **instead of** the original dev server port. Tell them to hold **Alt** and
  click an element to comment, right-click to mark it for removal, double-click
  text to edit it, and Shift-click to mark a spot — then press **Send**.
- Call the `tailr_wait` MCP tool, or run `npx -y @gcrft123/tailr wait` as a
  background process.

`wait` stays quiet until Send is pressed and then returns — that return is how
you find out a batch has arrived, so the reviewer never has to tell you.

## 4. Then follow the review skill

From there the loop is `wait` → `pull` → `progress` per mark → `done` or
`fail`. The `review` skill in this plugin carries the full rules; follow it for
the rest of the session.
