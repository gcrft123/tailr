
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

<h1 align="center">Tailr</h1>

### 

<p align="center">
  Mark up a running dev server and hand the changes to your coding agent as one batch.
</p>

<p align="center">
  <a href="https://trytailr.app"><b>Website →</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/gcrft123/tailr/releases">Releases</a>
  &nbsp;·&nbsp;
  <a href="https://www.npmjs.com/package/@gcrft123/tailr">npm</a>
</p>

<div align="center">

[![npm](https://img.shields.io/npm/v/%40gcrft123%2Ftailr)](https://www.npmjs.com/package/@gcrft123/tailr)
[![CI](https://img.shields.io/github/actions/workflow/status/gcrft123/tailr/ci.yml?branch=main&label=CI)](https://github.com/gcrft123/tailr/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/%40gcrft123%2Ftailr)](https://github.com/gcrft123/tailr#readme)
[![dependencies](https://img.shields.io/badge/dependencies-0-blue)](https://github.com/gcrft123/tailr/blob/main/package.json)
[![license](https://img.shields.io/npm/l/%40gcrft123%2Ftailr)](LICENSE)

</div>

<h1> </h1>

### 

### 

>[!TIP]
>### Quick start
>
>Paste this to your coding agent:
>
>```
>Set up Tailr so I can mark up my running dev server visually and hand you the changes as one batch. Fetch:
>https://raw.githubusercontent.com/gcrft123/tailr/main/PROMPT.md
>and follow it exactly, without summarizing it.
>```

<h1> </h1>

### 

<!-- A user-attachments URL, on its own line and free of Markdown, because that is
     the only way GitHub plays a video: its media-src policy allows only its own
     upload hosts, so a file in this repository is blocked whether it is reached
     through raw.githubusercontent.com or the github.com/.../raw/... redirect.
     Nothing is wrong with the file — it plays in a <video> on any other site,
     which is what site/ does with it. To replace this, drag the new mp4 into a
     GitHub issue comment and paste the URL that comment gives you. -->
https://github.com/user-attachments/assets/bb164693-9f44-4e16-95c4-7357c798ab38

---

## Get started

Paste this to your coding agent:

```
Set up Tailr so I can mark up my running dev server visually and hand you the
changes as one batch. Fetch
https://raw.githubusercontent.com/gcrft123/tailr/main/PROMPT.md
and follow it exactly, without summarizing it.
```


Or run it yourself, if you'd rather your agent didn't fetch anything, then ask
it to start a session:

```bash
npx -y @gcrft123/tailr init
```

Either way, `init` edits four things in your project and nothing else:

- adds `@gcrft123/tailr` to your devDependencies
- registers its MCP server in `.mcp.json`, and in `.cursor/mcp.json` too if the
  project already uses Cursor
- writes the agent's operating rules into your `AGENTS.md` / `CLAUDE.md`,
  between markers of its own
- adds `.tailr/` to your `.gitignore`, if the project is a git repository

Re-running it is safe: it rewrites its own block and leaves everything around it
alone. `--no-mcp` and `--no-install` opt out of either half; `--file <path>` puts
the rules somewhere else.

The agent then starts a session against your dev server, hands you a review URL,
and watches for your first batch. See [PROMPT.md](PROMPT.md) for what it follows.

## Try it first

```bash
npx -y @gcrft123/tailr demo
```

That starts a small sample application, proxies it, and prints a review URL —
nothing installed into a project, no agent involved. Hold Alt, mark a few things,
press **Send**, then run `npx -y @gcrft123/tailr pull` from the same directory in
another terminal to print the batch an agent would receive.

## As a plugin

The marketplace edits nothing in your project, and Tailr is fetched with `npx`
when a session starts, so there is nothing to install first. You get the MCP
server, the review loop's operating rules as a skill, and a command that opens a
session and hands you the review URL.

**Claude Code**

```
/plugin marketplace add https://github.com/gcrft123/tailr.git
/plugin install tailr@tailr
```

Use the git URL, not the `owner/repo` shorthand: the Claude Code app clones the
shorthand over SSH and has nothing to answer the host-key prompt with, so the add
hangs and then fails. Updating is `/plugin` → **Update**, which moves you to the
last release: the listing is read from the default branch, but the plugin it
installs is pinned to the release tag.

**Cursor**

Import `https://github.com/gcrft123/tailr` as a Team Marketplace (Dashboard →
Settings → Plugins). To load it on this machine only, copy `plugin/` to
`~/.cursor/plugins/local/tailr` and reload the window.

**Codex**

```
codex plugin marketplace add https://github.com/gcrft123/tailr.git
codex plugin add tailr@tailr
```

**GitHub Copilot CLI**

```
copilot plugin marketplace add gcrft123/tailr
copilot plugin install tailr@tailr
```

**Antigravity CLI**

```
agy plugin install https://github.com/gcrft123/tailr
```

That reads the same extension manifest Gemini CLI does, and brings the skills and
the MCP server with it. Gemini CLI still takes `gemini extensions install
https://github.com/gcrft123/tailr`.

**Everywhere else** — Windsurf, OpenCode, Cline, Amp, and the rest of the agents
that read a global `skills/` directory:

```
npx skills add gcrft123/tailr -g
```

That puts `tailr-start`, `tailr-review` and `tailr-config` in the shared
`~/.agents/skills` directory those agents read, symlinked into the folders of the
ones that keep their own. It does not register the MCP server; for that, use a
marketplace or extension command above, or `tailr init`.

Not every route namespaces a skill, so what the commands are called depends on
the way in:

| Installed with | Commands |
|---|---|
| Claude Code, Codex or Copilot marketplace | `/tailr:start` `/tailr:config` |
| Cursor | `/start` `/config` |
| Antigravity, Gemini, `npx skills add` | `/tailr-start` `/tailr-config` |

This is an alternative to `tailr init`, not an addition. The plugin suits someone
reviewing across several projects; `init` suits a project that wants Tailr in its
own setup, and is the only one of the two that writes to your repository. Running
both is harmless — the rules are the same text either way.

## Start a session

```bash
npx tailr start --target http://localhost:3000
```

`start` detaches inside Tailr and returns once the review URL is ready — that is
what agents should use. Bare `npx tailr --target …` still serves in the
foreground if you want the process attached to your terminal.

That assumes Tailr is in the project, which `init` sees to; `npm install
--save-dev @gcrft123/tailr` is the same thing by hand, and `npx
@gcrft123/tailr start --target …` skips it altogether.

Tailr proxies your dev server on `http://localhost:4100` and injects its overlay
into the HTML. Your application is not modified — no script tag, no build step, no
config. Hot-reload WebSockets pass through untouched.

```bash
npx tailr                         # proxies http://localhost:3000 (foreground)
npx tailr --target <url>          # a different dev server (foreground)
npx tailr start --target <url>    # same, detached — returns when ready
npx tailr stop                    # stop the project's session
npx tailr --port <n>              # serve Tailr somewhere else
npx tailr -- npm run dev          # start the dev server too, then proxy it
npx tailr --notify <command>      # run this when Send is pressed, to wake the agent
npx tailr --no-notify             # don't, even if there is an agent to wake
```

Review at the Tailr URL, not the original one. A session writes nothing to your
repository except a locator under `.tailr/`, so the CLI can find it.

## Marking up

Hold **Alt** to arm — **⌥ Option** on a Mac, or whichever key you have set under
[Settings](#settings). While it is held:

| Gesture | Result |
|---|---|
| Left-click | Comment on an element, and ask for versions or a slider if you want to compare |
| Right-click | Stage an element for removal (right-click again to undo) |
| Double-click text | Edit text in place |
| Shift-click | Mark a spot rather than an element — to ask for something new there, or to note the place. Middle-click does the same, if you have one |

Release the key and you can control the application again. Double-tap it to latch
markup on for keyboard use. Marks persist in the browser across reloads, span
routes, and survive the reload after the agent has worked.

The island in the corner shows what is staged; hover it for the list. Drag it to
any corner if it's covering page content.

## Versions and sliders

A comment on an element, or on a spot, can ask for more than one answer. The
composer carries a **1×** button next to Add; click it for 2×, 3×, 4×, and the
agent builds that many versions of the change instead of one. The button beside
it asks for a **slider** instead — one number you scrub on the page, for anything
continuous like a glow, a depth, a scale. A mark can ask for both.

After the reload, a small pill sits on the element. For versions it carries a tab
each: hover one and the pill widens to the name the agent gave it while the page
switches to it live, so you compare the real thing rather than two descriptions of
it. A slider's pill carries the control — drag it and the page follows.

Click a tab to keep that version, or **Keep** to hold a slider where you left it.
Keeping is itself a mark: it goes into your batch, and the next Send makes it
permanent and clears the rest out of the source. The × on its row in the island
keeps none of it.

## Ending a session

**End session** is at the bottom of the island's panel. It asks first, and the
card says what you are agreeing to: marks you never sent are discarded, and Tailr
stops proxying, so it names the address your app goes back to (or tells you the
dev server is stopping too, if Tailr started it).

Confirming runs a cleanup pass first. Anything you never decided — versions you
did not choose between, a slider you did not keep a value on — goes to the agent
as one last batch that takes it, and the switches guarding it, out of your source.
That scaffolding is Tailr's, and it shouldn't outlive the session that asked for
it. Then the server stops, the overlay clears what it kept in your browser, and it
takes itself off the page.

If the agent isn't listening, **End anyway** leaves without waiting; Tailr says so
on the way out rather than pretending the cleanup happened.

## Settings

Two things about Tailr are yours to set rather than the project's:

| Setting | Values | Default | What it does |
|---|---|---|---|
| `sfx` | `true` / `false` | `true` | A short sound on each action — a mark made or dropped, a batch sent, a version picked, a run closing |
| `modifier` | `alt` `ctrl` `cmd` | `alt` | The key you hold to arm marking |

Ask your agent with the config command your install gave you — see the table
[above](#as-a-plugin) — or set them yourself:

```bash
npx -y @gcrft123/tailr config sfx:false modifier:cmd
```

Either way they are written to `~/.tailr/config.json` and hold across every
project. With no arguments the command prints where they stand. A change made
while a session is up lands on the open review page without a reload.

## Waking the agent

`tailr wait` is the handoff on any agent whose client can tell the model that a
background process exited. Not every one can. On Codex a backgrounded `wait`
exits into nothing, and the MCP `tailr_wait` gives up after a minute and ends the
turn — so the session goes idle and the reviewer is back to saying "I've sent you
a batch", which is the thing Tailr exists to stop.

So on those the direction inverts, and Tailr pokes the agent instead:

```bash
npx tailr --notify 'codex queue --thread %t --message "%n Tailr marks are waiting"'
```

`%n` is the number of marks, `%t` the agent's thread, `%u` the review URL, `%%` a
literal `%`. The command runs once per batch, and a Send never fails because it
did.

If the agent started the session itself, none of that is needed. Codex exports
`CODEX_THREAD_ID` into every command it runs, and that is the same id `codex
queue --thread` takes — so Tailr finds it and says so on the way up:

```
  Send will wake codex thread 01a07c3e… on its own — nothing needs to watch for it.
```

The reviewer presses Send, the idle Codex session wakes with the batch, and the
loop runs. Nobody types anything. `tailr status` reports `wakesAgent` when this
is on, which is how an agent knows not to bother with `wait`.

Started the session in your own terminal rather than through the agent? Then
there is no thread to find at startup — but the first Tailr command the agent
runs registers it, and Send wakes the agent from then on.

### Clearing the conversation

A thread id is only good until you clear the conversation. Codex starts a new
thread for a cleared session, does not record it anywhere until something is
sent to it, and still accepts messages queued to the old one — so a wake aimed
at the id Tailr captured would report success and arrive nowhere.

Nothing can look that up, so the agent corrects it instead: every Tailr command
carries the thread it is running on, and Tailr re-aims at it. Clear the
conversation and the very next thing you ask the agent repairs the handoff,
whatever you ask for — the rules have it run `status` when a session is already
up, and that alone is enough:

```
  ⌁ waking codex thread 01a07c57… from now on
```

Between the clear and that first command there is a gap where Send reaches
nobody. Tailr says so rather than pretending, if a batch goes unclaimed:

```
  ⌁ r1 not picked up. If the agent's conversation was cleared it is on a new
    thread now — ask it for anything and it will re-register itself.
```

The session itself is never the problem: it is a separate process, holding its
state in `.tailr/session.json`, and a cleared conversation does not touch it.
Only the address of who to wake goes stale.

## The agent side

Run these from the same project directory, while a session is up.

```bash
tailr start --target <url>  # start the session (detached); prefer this to shell &
tailr stop                  # stop it
tailr status          # is a batch waiting? exit 0 if yes, 3 if not
tailr wait            # block until one is; exit 0 waiting, 3 timed out, 2 session ended
tailr pull            # lease the pending batch, printed as JSON on stdout
tailr pull --wait     # lease it, blocking until one arrives
tailr variants <ref> "First name" "Second name"
                      # name the versions you built for a mark that asked for several
tailr slider <ref> --min 0 --max 100 --value 40 --label "Glow" --unit "%"
                      # report the parameter you wired for a mark that asked for a slider
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

`type` is one of `comment`, `remove`, `text`, `point`, `choice`. A `text` mark
carries `before` and `after`. A `point` mark carries page coordinates `x`/`y`
instead of an element, and its comment says whether the reviewer wants something
new there or is noting the spot. `orphaned: true` means the element was gone when
the batch was sent — the address is the last one known, and the mark is worth
raising with the reviewer rather than guessing at.

**Versions.** A mark carrying `"variations": 3` asks for three answers to the same
comment, built together so the reviewer can compare them on the running page.
Guard each one on the attribute Tailr sets on `<html>` for that mark —
`[data-tailr-var-03="2"] .card { … }`, with version 1 also being what renders if
the attribute is absent — then name them in order with `tailr variants 03 "Softer
edges" "Full width" "Two columns"`.

**Sliders.** A mark carrying `"slider": true` asks for one continuous parameter
instead. Build it behind `data-tailr-slide-03` on `<html>`, with the default being
what renders if the attribute is absent, then report the range: `tailr slider 03
--min 0 --max 100 --value 40 --label "Glow" --unit "%"`. A mark can ask for
versions and a slider together; do both.

**Closing either.** What comes back later is a `choice` mark. For versions it
carries `variantOf` and `variant`: keep that version as plain code and take the
others and the guards out with it, or at `variant: 0` keep none of them. For a
slider it carries `sliderOf` and `value`: bake that number in and remove the
switch, or at `value: null` put the element back as it was.

**Where `address` comes from.** Nothing standard tells a page which file an
element came from, so Tailr reads whatever your dev tooling already emits:
`data-v-inspector` (vite-plugin-vue-inspector), `data-inspector-relative-path`
(react-dev-inspector), `data-astro-source-file`, Svelte's `__svelte_meta`, a
generic `data-source`, and React 18's development fibers. Emit
`data-tailr-source="Component.tsx:20"` yourself and that wins. With none of them
present `address` is `null` and the mark still carries its selector, its text, and
its route — which is the fallback, not a failure.

**Don't wait to be told.** `tailr wait` hangs on the session's event stream and
returns within a moment of Send being pressed — no polling, and no asking the
reviewer to announce every batch. Run it as a background process and treat its
exit as the notification:

```bash
tailr wait && tailr pull
```

It returns immediately if a batch is already waiting, so none can be missed.
`--timeout <seconds>` bounds the wait; without it, it waits as long as the session
lives.

**Report progress as you go.** Each `tailr progress <ref>` empties that mark on
the reviewer's screen while they watch — the difference between a tool that looks
stuck and one that looks like it is working.

**Always close the run.** Until `tailr done` or `tailr fail` arrives, the reviewer
cannot send another batch — and if you never answer, they can take that batch back
and send it again. If you cannot finish, `tailr fail` with what happened; Tailr
does not guess at causes, it points the reviewer back to you.

The whole contract, including the events to listen for when a version or a slider
has to re-render rather than restyle, is in the rules `tailr init` writes into
your agent instruction file.

## As an MCP server

`tailr init` registers this for you, and the [plugin](#as-a-plugin) brings it
along without touching your project at all. By hand, most clients take:

```json
{
  "mcpServers": {
    "tailr": { "command": "npx", "args": ["-y", "@gcrft123/tailr", "mcp"] }
  }
}
```

Prefer it to the CLI where you can: tool descriptions stay in the agent's context
every turn, so the protocol cannot quietly fall out the way a pasted prompt does.

Same round trip as the CLI:

| Tool | What it does |
|---|---|
| `tailr_start` | Start a session (detached); returns the review URL when ready |
| `tailr_stop` | Stop the project's session |
| `tailr_status` | Is a session running, is a batch waiting, and where should the reviewer go |
| `tailr_wait` | Block until the reviewer sends a batch, so they never have to tell you |
| `tailr_pull` | Lease the pending batch. `wait: true` blocks until one arrives |
| `tailr_variants` | Name the versions you built for a mark that asked for several |
| `tailr_slider` | Report the range of the parameter you wired for a slider mark |
| `tailr_progress` | Report a `ref`, or several `refs`, as applied |
| `tailr_done` | Close the run; the reviewer is prompted to reload |
| `tailr_fail` | Close it as incomplete with a `reason`, releasing the send lock |
| `tailr_config` | Read or change the reviewer's settings, when they ask |

The MCP tools talk to the same session the CLI does. If none is running,
`tailr_start` (or `npx tailr start --target <url>`) creates one — do not
shell-background a bare `tailr`, and do not edit anything under `.tailr/`.

## Requirements

Node 18 or newer, and nothing else — Tailr has no dependencies.

Of your dev server it asks almost nothing. Tailr injects into HTML responses and
passes everything else through, so there is no framework list here: if it serves
HTML over http or https, it works. A self-signed certificate is fine, and so is a
server that compresses — Tailr asks for uncompressed HTML and decodes gzip,
deflate or brotli when one arrives anyway. The hot-reload WebSocket is relayed
untouched.

Source addresses are the one part that depends on your setup — see [The agent
side](#the-agent-side) for what Tailr reads, and what a mark still carries when a
project emits none of it.

## License

MIT.

The interaction sounds are [Cuelume](https://github.com/Danilaa1/cuelume) — copied
into `src/overlay/cuelume.js` rather than depended on, under its MIT licence,
which travels with it at the top of that file. It synthesizes every sound through
the Web Audio API, so there are no audio files here either.
