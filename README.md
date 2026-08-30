# Tailr

Mark up a running dev server and hand the changes to your coding agent as one batch.

Someone who can't open the repository — a designer, a PM — reviews the real
application in the browser, marks what's wrong directly on the page, and presses
Send once. The agent receives a batch that names each element, resolves it toward
source where it can, and says what should happen to it.

## Setting it up with an agent

There's a prompt you can paste straight into your coding agent in
[SETUP-PROMPT.md](SETUP-PROMPT.md) — it installs Tailr, wires up MCP, starts a
session, and tells the agent how to handle a batch when one arrives.

## Install

```bash
npm install --save-dev @gcrft123/tailr
```

That puts a `tailr` command in the project. Everything below assumes it — prefix
with `npx` if you'd rather not install it (`npx @gcrft123/tailr --target …`).

## Start a session

```bash
npx tailr --target http://localhost:3000
```

Tailr proxies your dev server on `http://localhost:4100` and injects its overlay
into the HTML. Your application is not modified — no script tag, no build step,
no config. Hot-reload WebSockets pass through untouched.

```bash
npx tailr                         # proxies http://localhost:3000
npx tailr --target <url>          # a different dev server
npx tailr --port <n>              # serve Tailr somewhere else
npx tailr -- npm run dev          # start the dev server too, then proxy it
```

Review at the Tailr URL, not the original one.

## Marking up

Tailr introduces itself the first time a reviewer opens the page, and the gesture
key is always one hover away from the pill when nothing is staged. Nothing below
needs to be memorised.

Hold **Alt** to arm. While it is held:

| Gesture | Result |
|---|---|
| Left-click | Comment on the element, in a box on the element |
| Right-click | Stage the element for removal (right-click again to undo) |
| Double-click text | Edit that text in place |
| Shift-click | Mark a spot rather than an element — dropped anywhere on screen. Use it both to ask for something new and to note a place; what you write says which. Middle-click does the same thing if you have one |

Release Alt and the application is yours again. Double-tap Alt to latch markup on
for keyboard use. Marks persist in the browser across reloads, span routes, and
survive the reload after the agent has worked.

The island in the corner shows what is staged; hover it for the list. Drag it to
any corner — it can be thrown.

## The agent side

Run these from the same project directory, while a session is up.

```bash
tailr status          # is a batch waiting? exit 0 if yes, 3 if not
tailr pull            # lease the pending batch, printed as JSON on stdout
tailr pull --wait     # block until one arrives
tailr progress <ref>  # one mark applied — the reviewer sees it land, live
tailr done            # the run finished
tailr fail "reason"   # it returned incomplete
```

`tailr pull` prints:

```json
{
  "id": "r1",
  "sentAt": "2026-08-30T01:00:06.545Z",
  "marks": [
    {
      "ref": "01",
      "type": "comment",
      "route": "/invoices",
      "address": "InvoiceTable.tsx:20",
      "selector": "body > div > section:nth-of-type(2) > div:nth-of-type(3)",
      "element": "Bellweather Ltd",
      "comment": "Overdue pills should link to the invoice",
      "orphaned": false
    }
  ]
}
```

`type` is one of `comment`, `remove`, `text`, `point`. A `text` mark carries
`before` and `after`. A `point` mark carries page coordinates `x`/`y` instead of
an element, and means the reviewer marked a place rather than a thing — they may
be asking for something new there or noting the spot, and the comment says which. `orphaned: true` means the element was gone when
the batch was sent — the address is the last one known, and the mark is worth
raising with the reviewer rather than guessing at.

**Report progress as you go.** Each `tailr progress <ref>` empties that mark on
the reviewer's screen while they watch. It is the difference between a tool that
looks stuck and one that looks like it is working.

**Always close the run.** Until `tailr done` or `tailr fail` arrives, the reviewer
cannot send another batch. If you cannot finish, `tailr fail` with what happened —
Tailr deliberately does not guess at causes, it points the reviewer back to you.

## As an MCP server

Instead of shelling out, wire Tailr in as MCP tools:

```bash
claude mcp add tailr -- npx @gcrft123/tailr mcp
```

Or by hand, in whatever your client uses for MCP config:

```json
{
  "mcpServers": {
    "tailr": { "command": "npx", "args": ["@gcrft123/tailr", "mcp"] }
  }
}
```

It speaks JSON-RPC over stdio with no dependencies, and exposes the same round trip:

| Tool | What it does |
|---|---|
| `tailr_status` | Is a session running, is a batch waiting, and where should the reviewer go |
| `tailr_pull` | Lease the pending batch. `wait: true` blocks until one arrives |
| `tailr_progress` | Report a `ref`, or several `refs`, as applied |
| `tailr_done` | Close the run; the reviewer is prompted to reload |
| `tailr_fail` | Close it as incomplete with a `reason`, releasing the send lock |

The server must still be running — the MCP tools talk to the same session the CLI
does, found through `.tailr/session.json`. If none is running, the tools say so
and tell you what to ask the user for rather than failing opaquely.

## How it holds together

- **One batch at a time.** The server rejects a second batch while a run is open;
  that is what makes the send lock real rather than advisory.
- **The reviewer keeps working.** Marks made during a run stay staged and survive
  the reload afterwards.
- **A run is always escapable.** If the agent never answers, the reviewer can take
  the batch back and send it again.
- **Nothing is written to your repository** except `.tailr/session.json`, which
  records the running session so the CLI can find it. Add `.tailr/` to
  `.gitignore`.

## Requirements

Node 18 or newer. No dependencies.

## License

MIT
