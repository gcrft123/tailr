# Tailr

Mark up a running dev server and hand the changes to your coding agent as one batch.

You can review the real application in the browser, mark what's wrong directly on the page, and press Send once. The agent then receives a batch that names each element, resolves it toward source, and pushes changes to the dev server so you can see them live.

## Quick start

Paste this prompt to your coding agent. It installs Tailr, starts a session against your dev server, and tells the agent how to behave once markup starts arriving.

``` 
Set up Tailr so I can mark up my running dev server visually and hand you the
changes as one batch.

SETUP
1. Install:  npm install --save-dev @gcrft123/tailr
2. Make sure my dev server is running, and note its port.
3. Start Tailr pointed at it, as a long-running background process — it must
   stay up, so don't block your turn waiting on it:
      npx tailr --target http://localhost:<dev server port>
4. Tell me the review URL it prints (usually http://localhost:4100). I review
   there, not on the original port. Tailr proxies my app and injects its overlay;
   my source is not modified.

Then tell me the URL and start watching for my batch, in the same message:

  npx tailr wait

Run it as a long-running background process. It prints nothing until I press
Send, then exits — that exit is how you find out a batch has arrived, so I never
have to tell you. Exit 0 a batch is waiting · 3 it timed out, start it again ·
2 the session ended. Start it again after each run you close.

HANDLING A BATCH
`npx tailr status` answers the same question at any moment: exit code 0 a batch
is waiting · 3 a session is running but nothing is waiting · 2 no session is
running, so ask me to start one. Then:

  npx tailr pull            lease the batch, printed as JSON
  npx tailr progress <ref>  report one mark as applied
  npx tailr done            the run finished
  npx tailr fail "reason"   it returned incomplete

Each mark in the batch has a ref ("01"), a type, the route it was made on, a
best-effort source address, a CSS selector, the element's text, and my comment.

  comment  change that element as I describe
  remove   delete that element
  text     carries before/after — change the text to `after`
  point    carries page x/y instead of an element. I marked a place, not a
           thing: I may want something new there, or may just be noting the
           spot. My comment says which.

A mark with "orphaned": true lost its element before I sent it. Don't guess at
what I meant — tell me about it.

RULES THAT MATTER
- Report each mark with `progress` as you land it, not all at once at the end.
  I watch them clear on my screen; batching makes it look like nothing is
  happening.
- Always close the run with `done` or `fail`. Until you do, I cannot send
  another batch. If you hit something you can't do, `fail` with what actually
  went wrong — Tailr won't invent an explanation, it points me back to you.
- When the source address and the selector disagree, trust the source address.
- If a mark is ambiguous, ask me rather than picking an interpretation.
- Run these commands from my project directory; that's how Tailr finds the
  session.
```

## Optional: register it as an MCP server

If your agent supports MCP, this replaces the `npx tailr …` calls with tools it
can call directly. Everything else in the prompt is unchanged.

Most clients take a config block like this:

```json
{
  "mcpServers": {
    "tailr": { "command": "npx", "args": ["@gcrft123/tailr", "mcp"] }
  }
}
```

Some ship a command that writes it for you. For example:
`claude mcp add tailr -- npx @gcrft123/tailr mcp`.

The tools map one-to-one onto the CLI, so the prompt above still applies:

| Tool | CLI |
|---|---|
| `tailr_status` | `npx tailr status` |
| `tailr_wait` | `npx tailr wait` |
| `tailr_pull` | `npx tailr pull` |
| `tailr_progress` | `npx tailr progress <ref>` |
| `tailr_done` | `npx tailr done` |
| `tailr_fail` | `npx tailr fail "reason"` |

---


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

Tailr proxies your dev server on `http://localhost:4100` and injects its overlay into the HTML. Your application is not modified — no script tag, no build step, no config. Hot-reload WebSockets pass through untouched.

```bash
npx tailr                         # proxies http://localhost:3000
npx tailr --target <url>          # a different dev server
npx tailr --port <n>              # serve Tailr somewhere else
npx tailr -- npm run dev          # start the dev server too, then proxy it
```

Review at the Tailr URL, not the original one.

## Marking up

Hold **Alt** to arm. While it is held:

| Gesture | Result |
|---|---|
| Left-click | Comment on an element, |
| Right-click | Stage an element for removal (right-click again to undo) |
| Double-click text | Edit text in place |
| Shift-click | Mark a spot rather than an element. Use it both to ask for something new and to note a place; what you write says which. Middle-click does the same thing if you have one |

Release Alt and you can control the application again. Double-tap Alt to latch markup on
for keyboard use. Marks persist in the browser across reloads, span routes, and
survive the reload after the agent has worked.

The island in the corner shows what is staged; hover it for the list. Drag it to any corner if it's covering page content.

## The agent side

Run these from the same project directory, while a session is up.

```bash
tailr status          # is a batch waiting? exit 0 if yes, 3 if not
tailr wait            # block until one is; exit 0 waiting, 3 timed out, 2 session ended
tailr pull            # lease the pending batch, printed as JSON on stdout
tailr pull --wait     # lease it, blocking until one arrives
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

**Don't wait to be told.** `tailr wait` hangs on the session's event stream and
returns within a moment of Send being pressed — no polling, and no asking the
reviewer to announce every batch. Run it as a background process and treat its
exit as the notification:

```bash
tailr wait && tailr pull
```

It returns immediately if a batch is already waiting, so there is no window in
which one can be missed. `--timeout <seconds>` bounds the wait and exits 3;
without it, it waits as long as the session lives. When the session goes away it
exits 2 rather than hanging on a server that is no longer there.

**Report progress as you go.** Each `tailr progress <ref>` empties that mark on
the reviewer's screen while they watch. It is the difference between a tool that
looks stuck and one that looks like it is working.

**Always close the run.** Until `tailr done` or `tailr fail` arrives, the reviewer
cannot send another batch. If you cannot finish, `tailr fail` with what happened —
Tailr deliberately does not guess at causes, it points the reviewer back to you.

## As an MCP server

It speaks JSON-RPC over stdio with no dependencies, and exposes the same round trip:

| Tool | What it does |
|---|---|
| `tailr_status` | Is a session running, is a batch waiting, and where should the reviewer go |
| `tailr_wait` | Block until the reviewer sends a batch, so they never have to tell you |
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
