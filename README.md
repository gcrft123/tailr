<pre>          
                                                                       #####   #####              
                                             ...                       #####   #####              
                                             ...                               #####              
                                         ...........     #########     #####   #####   ####  #### 
                                         ...........   ############    #####   #####   #### ##### 
                                           .....      #####    #####   #####   #####   ########## 
   ................   ...............      .....               #####   #####   #####   #####      
   ...............   ................      .....       +############   #####   #####   #####      
                                           .....      #####    .####   #####   #####   #####      
                                           ......  . #####    .#####   #####   #####   #####      
                                            ........  ######### ####   #####   #####   #####      
                                             .......   ######   ####   #####   #####   #####      
</pre>

https://github.com/user-attachments/assets/bb164693-9f44-4e16-95c4-7357c798ab38

Mark up a running dev server and hand the changes to your coding agent as one batch.

You can review the real application in the browser, mark what's wrong directly on the page, and press Send once. The agent then receives a batch that names each element, resolves it toward source, and pushes changes to the dev server so you can see them live.

## Quick start

Paste this to your coding agent:

```
Set up Tailr so I can mark up my running dev server visually and hand you the
changes as one batch. Fetch
https://raw.githubusercontent.com/gcrft123/tailr/main/PROMPT.md
and follow it exactly, without summarizing it.
```

Or, if you'd rather not have your agent fetch anything, run it yourself and then
tell the agent to start a session:

```bash
npx -y @gcrft123/tailr init
```

Either way the same thing happens. `init` installs Tailr, registers its MCP
server, and writes the agent's operating rules into your `AGENTS.md` /
`CLAUDE.md` — because a setup prompt is read once and then falls out of context,
while those rules have to hold for the whole session. It is safe to re-run, and
it only rewrites its own marked-off block. `--no-mcp` and `--no-install` opt out
of either half; `--file <path>` puts the rules somewhere else.

The agent then starts a session against your dev server, hands you a review URL,
and watches for your first batch. [PROMPT.md](PROMPT.md) is what it is following,
if you want to read it first.

## As a Claude plugin

If you use Claude Code, the marketplace is the least invasive way in — it edits
nothing in your project:

```
/plugin marketplace add gcrft123/tailr
/plugin install tailr@tailr
```

That gives you Tailr's MCP server, the operating rules for the review loop as a
skill, and `/tailr:start` to open a session against your dev server and hand
you the review URL. Tailr itself is fetched with `npx` when a session starts,
so there is nothing to install first.

Updating is `/plugin` → **Update**, which re-reads the marketplace listing. The
version the plugin advertises is stamped from `package.json` when a release is
cut, so it moves when Tailr does.

This is an alternative to `tailr init`, not an addition to it. The plugin suits
someone reviewing across several projects; `tailr init` suits a project that wants
Tailr committed as part of its own setup, and is the only one of the two that
writes anything into your repository. Running both is harmless — the rules are
the same text either way.

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
| Left-click | Comment on an element, and ask for several versions of the change if you want to compare |
| Right-click | Stage an element for removal (right-click again to undo) |
| Double-click text | Edit text in place |
| Shift-click | Mark a spot rather than an element. Use it both to ask for something new and to note a place; what you write says which. Middle-click does the same thing if you have one |

Release Alt and you can control the application again. Double-tap Alt to latch markup on
for keyboard use. Marks persist in the browser across reloads, span routes, and
survive the reload after the agent has worked.

## Asking for versions

A comment on an element, or on a spot, can ask for more than one answer. The
composer carries a **1×** button next to Add; click it for 2×, 3×, 4×. The agent
then builds that many versions of the change instead of one.

After the reload, a small pill sits on the element with a tab per version. Hover
one and the pill widens to the name the agent gave it while the page switches to
it live, so you are comparing the real thing rather than two descriptions of it.
Click to keep one. That goes into your batch like any other mark, and the next
Send is what makes it permanent and clears the rest out of the source. The × on
its row in the island keeps none of them.

The island in the corner shows what is staged; hover it for the list. Drag it to any corner if it's covering page content.

## Ending a session

**End session** is at the bottom of the island's panel. It asks first, and the
card says what you are agreeing to: marks you never sent are discarded, and
Tailr stops proxying, so it names the address your app goes back to (or tells
you the dev server is stopping too, if Tailr started it).

Confirming runs a cleanup pass before anything shuts down. Any versions you
never chose between go to the agent as one last batch that takes them, and the
switches guarding them, out of your source — that scaffolding is Tailr's, and it
shouldn't outlive the session that asked for it. Then the server stops, the
overlay clears what it kept in your browser, and it takes itself off the page.

If the agent isn't listening, **End anyway** leaves without waiting; Tailr says
so on the way out rather than pretending the cleanup happened.

## The agent side

Run these from the same project directory, while a session is up.

```bash
tailr status          # is a batch waiting? exit 0 if yes, 3 if not
tailr wait            # block until one is; exit 0 waiting, 3 timed out, 2 session ended
tailr pull            # lease the pending batch, printed as JSON on stdout
tailr pull --wait     # lease it, blocking until one arrives
tailr variants <ref> "First name" "Second name"
                      # name the versions you built for a mark that asked for several
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

`type` is one of `comment`, `remove`, `text`, `point`, `choice`. A `text` mark carries
`before` and `after`. A `point` mark carries page coordinates `x`/`y` instead of
an element, and means the reviewer marked a place rather than a thing — they may
be asking for something new there or noting the spot, and the comment says which. `orphaned: true` means the element was gone when
the batch was sent — the address is the last one known, and the mark is worth
raising with the reviewer rather than guessing at.

**Versions.** A mark carrying `"variations": 3` asks for three answers to the
same comment, built together so the reviewer can compare them on the running
page. Guard each one on the attribute Tailr sets on `<html>` for that mark —
`[data-tailr-var-03="2"] .card { … }`, with version 1 also being what renders if
the attribute is absent — then name them in order with `tailr variants 03 "Softer
edges" "Full width" "Two columns"`. What comes back later is a `choice` mark
carrying `variantOf` and `variant`: keep that version as plain code and take the
others and the guards out with it. `variant: 0` means keep none of them.

**Where `address` comes from.** Nothing standard tells a page which file an
element came from, so Tailr reads whatever your dev tooling already emits:
`data-v-inspector` (vite-plugin-vue-inspector), `data-inspector-relative-path`
(react-dev-inspector), `data-astro-source-file`, Svelte's `__svelte_meta`, a
generic `data-source`, and React 18's development fibers. Emit
`data-tailr-source="Component.tsx:20"` yourself and that wins. With none of
them present `address` is `null` and the mark still carries its selector, its
text, and its route — which is the fallback, not a failure.

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

`tailr init` registers this for you, in `.mcp.json` (and `.cursor/mcp.json` if
the project uses Cursor), and the [Claude plugin](#as-a-claude-plugin) brings it
along without touching your project at all. By hand, most clients take:

```json
{
  "mcpServers": {
    "tailr": { "command": "npx", "args": ["@gcrft123/tailr", "mcp"] }
  }
}
```

Prefer it to the CLI where you can: a tool description is re-sent to the agent
on every turn, so the parts of the protocol that matter can't quietly decay out
of its context the way a pasted prompt does.

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
- **A session writes nothing to your repository** except `.tailr/session.json`,
  which records the running session so the CLI can find it. `tailr init` adds
  `.tailr/` to `.gitignore` for you.
- **`tailr init` is the only thing that edits your files**, and only these: a
  marked-off section in your agent instruction file, a `tailr` entry in
  `.mcp.json`, the `.gitignore` line, and the devDependency. Re-running rewrites
  its own block and leaves everything around it alone.

## Requirements

Node 18 or newer. No dependencies.

## License

MIT
