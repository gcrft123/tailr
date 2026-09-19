# Changelog

Everything notable that has changed in Tailr, newest first. Versions follow
[semantic versioning](https://semver.org/spec/v2.0.0.html). Each release opens
with a short summary, then lists its changes grouped as New, Changed and Fixed,
and every line names the commit that carries it.

Every release is a `vX.Y.Z` git tag. Pushing that tag is what publishes to npm
and cuts the matching [GitHub Release](https://github.com/gcrft123/tailr/releases),
and the notes it carries are the section below that bears its version — so a
release with nothing written here does not go out. See [RELEASING.md](RELEASING.md).

## [Unreleased]

## [1.4.1] — 2026-09-13

Agents were stopping after they closed a run. `done` and `fail` returned state
and named nothing to do next, and an agent that ends its turn under MCP cannot
be reached again unless something wakes it.

Both steps now say what follows, and the operating rules make re-arming `wait` a
rule of its own instead of a trailing clause.

### Changed

[90ad8a4] — `done` and `fail` report what to do next: arm `wait` when nothing
will wake the agent, end the turn when Tailr will, and neither when the reviewer
is ending the session. The MCP tools print it as a `next:` line above the state;
the CLI writes it to stderr.

[90ad8a4] — The operating rules state re-arming `wait` as its own rule, and
treat "Tailr wakes this agent" as a condition to check rather than standing
permission to stop.

## [1.4.0] — 2026-09-12

A mark whose element left the page was flagged to the agent as `orphaned`, and
the rules told the agent to stop and ask the reviewer about it. The flag was
wrong: the agent works in the source, where an element that stopped rendering
and one that never moved are the same mark, and the address still resolves. It
is gone from the batch. The reviewer still sees the state, now called hidden.

The walkthrough became a setting that belongs to the person rather than the
project, and three overlay defects found while testing the change are fixed.

### Changed

[559ea73] — A mark whose element is no longer on screen is hidden rather than
orphaned, and the batch no longer mentions it. The reviewer is still told,
because the missing badge is theirs to explain.

[559ea73] — A hidden mark stays editable from its row in the staged list, and
its composer opens in the middle of the viewport. Inline text edits are the
exception: the reviewer types into the element, so there has to be one.

[559ea73] — The walkthrough is a `tutorial` setting in `~/.tailr/config.json`.
It shows until the reviewer's first mark and then never again, on every project
rather than once per dev server. `tailr config tutorial:true` asks for it back.

### Fixed

[559ea73] — The versions and slider chips on a staged row sat in a fixed-width
box the kind label already filled and spilled over the source address beside
them. They have a column of their own now.

[559ea73] — Reopening a mark left the staged list showing the note it replaced.
The panel only redrew when a mark was added, removed or served.

[559ea73] — The comment box drew the host browser's scrollbar. It draws its own
now, on every engine.

## [1.3.3] — 2026-09-07

Tailr can now wake the agent when Send is pressed, so the handoff works on
clients that cannot tell the model a background process exited — Codex among
them, where `tailr wait` exits into nothing and the MCP `tailr_wait` gives up
after a minute. A session started from inside Codex needs no configuration.

The rest of the release makes that wake survive a cleared conversation, adds
detached `start` / `stop` so a host runner cannot kill the session with the
agent's shell, and pins the Claude Code plugin to the release tag.

### New

[743898e] — `--notify <command>` runs a command on each batch, with `%n` the
number of marks, `%t` the agent's thread and `%u` the review URL. `TAILR_NOTIFY`
sets the same from the environment and `--no-notify` turns it off.

[743898e] — A session started inside Codex wakes the agent with no
configuration. Codex exports `CODEX_THREAD_ID` into every command it runs, which
is the id `codex queue --thread` takes, so Tailr picks it up and says at startup
that Send will wake it. The preset builds its own argv and thread ids are
shape-checked, so nothing in the environment can be read as shell syntax.

[743898e] — `status` reports `wakesAgent` (`wakesYou` on the MCP tool), and the
operating rules tell the agent to skip `wait` when it is true.

[4ec6571] — Every agent-side command registers the thread it is running on, so
clearing the conversation no longer leaves the wake aimed at a dead thread — the
next thing the reviewer asks their agent repairs it. A batch still unclaimed 45
seconds after a wake says so.

[a02d5fd] — `tailr_status` asks the agent to run `npx tailr status` once when it
cannot see a thread id of its own. An MCP server is never told which
conversation it belongs to, so it is the one place that cannot re-register
itself.

[6b54c97] — `tailr start` and `tailr stop`, with matching `tailr_start` and
`tailr_stop` MCP tools. `start` detaches inside Node and returns once the review
URL is ready; `stop` is the teardown. Serve also ignores SIGHUP, so a hung-up
agent shell cannot take the session with it.

### Changed

[6b54c97] — Agent rules, start skills, `init`'s handoff, the landing page and
PRODUCT/DESIGN no longer mention `.tailr/session.json` or ask the agent to
background the server from a shell. Session liveness goes through `status`,
`start` and `stop` only.

[5374b1e] — The Claude Code marketplace installs the plugin from the release tag
instead of from `main`. The catalog entry is a `git-subdir` source pinned to
`v<version>`, written during the version bump, and the tests fail if it names a
branch. Cursor, Codex, Copilot, Gemini and Antigravity still read `plugin/` from
the default branch, because those catalogs are other schemas.

[9985fca] — The README documents sliders, which shipped in 1.2.0 and were never
mentioned there, and its MCP table now lists `tailr_variants`, `tailr_slider`
and `tailr_config`. Four incorrect statements are corrected and three repeated
explanations removed.

### Fixed

[7a96d2e] — The release workflow installs dependencies before running the suite.
Overlay tests need `jsdom` from `devDependencies`; without `npm ci` the tag
check failed after the version bump had already landed.

[4c33cce] — Tailr will not wake a Codex conversation that has been cleared. A
cleared thread stays alive on the local daemon and still runs what is queued to
it, so batches were being applied to the reviewer's repository out of sight.
Before waking, Tailr checks Codex's thread store for a thread created later in
the same directory and refuses if it finds one. `created_at` is the field
compared, because `updated_at` is bumped by the queueing whose safety is in
question. A machine that cannot read the store does not guess, and the batch
waits either way.

[89bf8a9] — The page shown when the dev server goes away no longer reads as
Tailr having died. It says whose fault it is, that the session is still up, and
that the marks in the browser are safe. It also watches for the dev server and
reloads when it answers.

[1ff6567] — `npx -y @gcrft123/tailr <command>` works inside a Tailr checkout. A
package's own bin is never linked into its own `node_modules/.bin`, so every
command the README hands out failed here with `sh: tailr: command not found`,
the MCP server included. A self-referencing devDependency links the bin and does
not reach the people who install Tailr.

[11a488e] — Ending a session says what the cleanup batch actually covers. It
takes sliders nobody kept a value on as well as versions nobody chose between,
and always did, but all three cards said "versions".

## [1.3.2] — 2026-09-06

Most of this came from the first outside install report. One part was a defect:
a dev server that compresses its HTML regardless of what was asked of it had its
pages passed through unrewritten, so the reviewer got a page where holding the
key did nothing.

The rest was Tailr addressing the wrong person — handing the reviewer the
agent's commands and naming a modifier key they had changed — plus `tailr demo`,
which runs the whole loop against a sample app with nothing installed.

### New

[4ab2a67] — `tailr demo` starts a small sample application, proxies it and
prints a review URL: the whole round trip with nothing installed into a project
and no agent involved. The sample app ships with the package.

### Changed

[4ab2a67] — The line printed when a session starts names the key the reviewer is
actually holding instead of always saying Alt, and stops handing the reviewer's
instructions and the agent's next command to the same reader.

[4ab2a67] — `tailr init` closes by telling whoever ran it what to do next. It
used to end on `tailr wait` and `tailr pull`, which are the agent's commands, not
a person's.

[4ab2a67] — The README lists all four files `init` edits where `init` is first
mentioned, and Requirements covers what Tailr asks of a dev server rather than
only which Node it needs — including that a mark's source address is `null` on a
project whose tooling emits none, and that this is a fallback rather than a
failure.

[4ab2a67] — The skills installed without a marketplace are now `tailr-start`,
`tailr-review` and `tailr-config`, so the commands are `/tailr-start` and
`/tailr-config`. The old names arrived bare and landed on commands agents
already had. A marketplace install is unaffected and still reads `/tailr:start`.
The old names are gone rather than aliased.

[67fc956] — The README says what Antigravity actually calls these commands,
checked by installing it and asking the agent to enumerate its skills. That path
clones the repository, reads the root `skills/` tree and adds no namespace.

[5032491] — The release note claiming an extension install was unaffected by the
rename is corrected before it ships as one. Antigravity, Gemini and the bare
installer all read the repository's skills directly, so all of them take the new
names.

### Fixed

[4ab2a67] — A dev server that compresses its HTML regardless of what was asked
of it now gets the overlay. gzip, deflate and brotli are decoded before
injection; an encoding Tailr cannot undo still passes through intact.

## [1.3.1] — 2026-09-05

Found by installing 1.3.0 every documented way — through the Claude, Codex,
Copilot, Cursor and Antigravity CLIs — and driving a review loop through each.
Four defects in argument handling, session ownership and error reporting, and
three documentation corrections.

### Changed

[a1bc285] — PROMPT.md tells the agent to run `init` again with `--file` when its
own instruction file is not one the project already had. On a fresh project
`init` writes `AGENTS.md`, which Claude Code does not read, so the rules landed
somewhere the agent would never look again.

[a1bc285] — The landing page's agent fan carries Antigravity in place of Gemini
CLI, with `agy plugin install` as the command it hands over.

[a1bc285] — The README's Gemini CLI section is now an Antigravity CLI one, since
Google turns individual accounts away from Gemini CLI, and the `npx skills add`
paragraph says where that installer puts things and that the skills land without
the `tailr:` prefix.

### Fixed

[a1bc285] — `--target localhost:5173`, `--target 5173` and
`--target 127.0.0.1:3000` now mean what they say. A scheme-less address started
a session that could only answer 502, and a bare port crashed with a stack
trace. What cannot be a dev server URL is refused in a sentence.

[a1bc285] — A second `tailr` started in a project that already has a live
session is turned away with that session's URL. It used to overwrite
`.tailr/session.json` and delete it on the way out, leaving the first session
running but unfindable by `status`, `wait` and the MCP tools.

[a1bc285] — `tailr progress` with a ref that is not in the batch returns 400 and
names the refs that are, rather than reporting success for a mark nobody made.

[a1bc285] — `tailr init` registers the MCP server as `npx -y @gcrft123/tailr
mcp`, the same as the plugin, so a client launching it in a `--no-install`
project never stalls on npx asking permission to fetch.

## [1.3.0] — 2026-09-05

Tailr answers every action with a sound now — nine cues, each with its own
shape, synthesized live so no audio file ships.

Sound is not something to give someone with no way out, and the key held to mark
was never going to suit every app or OS, so both are settings. They belong to
the person rather than the project, which is why they live in `~/.tailr/config.json`
and nothing new appears in anyone's repository.

### New

[c40b683] — Sound on every action: a mark made, kept, reopened, dropped or
discarded; versions or a slider asked for; a batch sent; a version picked, a
value kept or reset; the batch taken back, re-sent or reloaded into; the session
ended; the island landing in a new corner. A key going down stays quiet, bar the
Enter that commits a comment, as does a single mark coming back applied. On by
default; `sfx:false` turns the lot off.

[c40b683] — `/tailr:config` (`/config` in Cursor), `tailr config` and the
`tailr_config` MCP tool read or change settings, e.g. `/tailr:config sfx:false
modifier:cmd`. Settings are kept in `~/.tailr/config.json` and hold across every
project, and a change made while a session is up is pushed to the open review
page.

[c40b683] — `modifier` sets the key held to arm marking: `alt` (the default),
`ctrl` or `cmd`. Every hint on screen names whichever key is yours, and
`tailr_status` reports it so the agent never has to guess.

### Changed

[c40b683] — The interaction sounds are
[Cuelume](https://github.com/Danilaa1/cuelume), copied into
`src/overlay/cuelume.js` under its MIT licence rather than installed — its whole
seventeen-recipe palette, so a version bump stays a copy rather than a merge.
Tailr still has no dependencies.

## [1.2.0] — 2026-09-04

A comment could ask for up to four versions since 1.1.0; it can now ask for a
continuous parameter instead. The agent wires one value behind an attribute,
reports its range, and the reviewer scrubs it on the page before keeping a
number.

Tailr also became installable on Cursor, Codex, Copilot and Gemini, and a
handful of overlay defects around pills and latched markup are fixed.

### New

[76dfe2b] — A slider companion to the 1×–4× versions toggle on the comment
composer. The agent wires the parameter behind `data-tailr-slide-<ref>`, reports
the range with `tailr slider` / `tailr_slider`, and the reviewer scrubs it
before keeping a value. **Keep** minimizes the pill to that value with its
reference number, **Reset** restores the agent's default, and keeping the value
already kept takes the keep back.

[2ffc783] — `/tailr:start` is a slash-command skill. Typing it starts a session
against the dev server and begins watching for the first batch; the model will
not fire it on its own. The review loop stays a background skill, loaded when a
batch is in play.

[2ffc783] — Plugin catalogs for Cursor, Codex, GitHub Copilot CLI and Gemini
CLI, so the same bundle Claude Code installs is what those agents install too.
Agents without a marketplace take the skills through `npx skills add
gcrft123/tailr -g`.

[eb9d89e] — On Cursor, `/start` is a command file rather than a plugin skill.
Pointing `skills` at the start folder finds nothing, because Cursor wants a
parent of skill folders, and `disable-model-invocation` hides plugin skills from
the slash menu. The loop stays a rule so it does not collide with Cursor's
built-in `/review`.

### Changed

[76dfe2b] — Mark reference numbers reset with each Tailr session. The overlay
drops leftover marks from a previous process and starts the count at 01 again.

[76dfe2b] — Clicking the badge on a text mark reopens the inline editor, with a
Delete / Done bar. Double-clicking text that already has a mark, or commenting
an element that already has a comment, reopens the existing mark instead of
stacking a new one.

[76dfe2b] — A slider's row in the staged list carries what its pill carries —
Keep, lit when that value is the one being kept, and Reset — plus the `×` that
turns the slider down altogether.

### Fixed

[76dfe2b] — Version and slider pills on an element in the corner of the viewport
no longer render offscreen. Both flip below the element or slide along its edge,
the way the comment composer already did, and a slider pill follows its element
while the page scrolls.

[76dfe2b] — The slider pill is no longer rebuilt when the reviewer keeps a
value, so the button under the pointer survives being clicked and keyboard focus
stays where it was. Both faces are built once and swapped by class, which is
what lets the change of shape animate.

[76dfe2b] — A sent batch disables a slider pill's controls rather than only
greying them, and Keep reads as kept: its lit state used to be the same paper as
its resting state.

[2ffc783] — The Claude Code app can add Tailr from this repository. The root now
carries a plugin manifest pointing into `plugin/`, the MCP server lives at
`.mcp.json` where the app discovers it, and the README's add command is the
HTTPS git URL rather than the `owner/repo` shorthand, which clones over SSH.

[ca29138] — Latched markup read what someone was typing as commands. A keystroke
on its way into an input, textarea, select or contenteditable is now typing
rather than a shortcut; `c`, `r` and `e` used to be taken as the comment, remove
and edit verbs and the arrow keys as structural walking, and the characters
never reached the field. Escape still reaches Tailr from the application's own
fields, where the field answers it too. Tailr's inline editor is the exception:
it answers Escape by putting the text back without dropping the mode the
reviewer was editing from.

## [1.1.0] — 2026-09-02

A comment could only ever be answered once. It can now ask for up to four
versions of the same change, built at once and switched between live on the
page, so the comparison is between the real things rather than two descriptions
of them.

Versions leave guards in the source, so this release also adds the way out: End
session sits under the island's panel and runs a cleanup pass that takes the
undecided versions, and their switches, back out.

### New

[2574bbb] — Versions. The composer carries a `1×` button beside Add that cycles
to `4×`. The agent builds every version at once, each guarded on an attribute
Tailr sets on `<html>`, and names it in a word or three. After the reload a pill
sits on the element with a tab per version — hover one and it widens to the name
while the page switches to that version live.

[2574bbb] — Keeping a version is a mark like any other. It joins the batch, and
sending it makes that version permanent and takes the losing ones, and the
guards, out of the source. Turning the whole set down is the `×` on its row. An
unresolved set keeps the island awake, because the alternative is versions
sitting in someone's repository with nothing on screen that would remove them.

[2574bbb] — `tailr variants <ref> <names…>` and the matching `tailr_variants`
MCP tool report what was built. The operating rules carry the contract: where
the switch lives, that version 1 must also be what renders without it, and that
a guard never outlives the choice that settles it.

[8a21b28] — **End session** sits under the island's panel and asks before it
acts. The card names what is being agreed to, one consequence per line: the
marks that go unsent, the versions that get cleaned up, the address the
application goes back to once Tailr stops proxying, and that the browser is
cleared. Until now the only way out was a terminal the reviewer does not have.

[8a21b28] — A cleanup pass on the way out. Versions nobody chose between go to
the agent as one final batch that takes them, and their switches, out of the
source; the switches come off the document; what Tailr kept in the browser is
cleared; the server stops and the overlay takes itself off the page. If the
agent never answers, **End anyway** leaves regardless and says the cleanup did
not finish rather than implying it did.

### Fixed

[2574bbb] — A session was good for exactly one batch. The server keeps the last
run indefinitely, so a reviewer who reloaded was handed a finished run again and
the overlay re-entered its "Needs refresh" state — against changes they were
already looking at — with Send locked and no way back. A closed run now only
prompts the page that watched it close.

## [1.0.0] — 2026-09-02

The first release with a release flow behind it: a pushed tag runs the tests,
publishes to npm as a trusted publisher and cuts the GitHub Release from this
file. Tailr also became installable as a Claude Code plugin, which is the same
durability `tailr init` gives without editing anything in the project.

Underneath, source resolution stopped depending on a React internal that was
removed in React 19, four bridge and proxy defects are fixed, and there is now a
test suite that caught one of them.

### New

[5c3cbb5] — A Claude Code plugin, with this repository as its marketplace:
`/plugin marketplace add gcrft123/tailr`, then `/plugin install tailr@tailr`. It
carries the MCP server, the operating rules as a skill, and a `/tailr:start`
command. The rules are generated from the same source `init` writes from, and
the version it advertises is stamped when a release is cut; `npm test` fails if
either drifts.

[a68c067] — A release flow keyed to the tags. Pushing `vX.Y.Z` verifies the tag
against the manifest, runs the tests at that commit, publishes to npm and cuts a
GitHub Release from this file. `npm version` is the whole local interface.

[b6fe152] — Publishing authenticates to npm as a trusted publisher over OIDC, so
no token is stored anywhere. Provenance is generated automatically.

[875087b] — A test suite — `npm test`, no dependencies — covering the bridge
state machine and its refusals, the proxy's injection and passthrough, the three
outcomes of `tailr wait`, and the idempotence of `tailr init`. CI runs it on
Node 18, 20 and 22, and fails if Tailr ever takes on a runtime dependency.

[f919b5c] — Source resolution reads more of what dev tooling already emits:
`data-v-inspector` (Vue), `data-inspector-relative-path` (react-dev-inspector),
`data-astro-source-file` (Astro), Svelte's `__svelte_meta` and a generic
`data-source`, alongside the React fibers and `data-tailr-source` it already
read. Windows paths and trailing column numbers are handled.

[369c6ab] — `npm run demo` starts the demo app itself instead of expecting one
on a port nothing had started.

### Changed

[65c98bb] — `PRODUCT.md` no longer describes the project as having no
implementation, and states exactly how far source resolution reaches. The
overlay surface doc describes the Island that shipped rather than the withdrawn
Callout direction.

### Fixed

[875087b] — An `https://` target crashed the session process on the first page
request. https dev servers are now proxied, hot-reload upgrade included, and a
self-signed certificate is accepted.

[875087b] — Rewritten HTML carried both the upstream's `transfer-encoding:
chunked` and a freshly computed `content-length`, which strict clients refuse
outright. HTML arriving compressed is now passed through whole rather than
decoded as utf-8 and injected into.

[875087b] — `tailr status` exited `0` while the agent's own run was still in
flight, reporting leased work back to it as a waiting batch. It now reports what
the server calls pending.

[875087b] — Closing a run that was already closed returned `500 Server error.`
rather than `409 No open run.`, which an agent retrying `tailr done` after a
dropped connection could not tell apart from a real failure.

[875087b] — A synchronous failure inside the proxy took the whole session down
with it. It now costs one page, and the review URL stays up.

## [0.3.0] — 2026-08-31

A pasted setup prompt is read once and then falls out of context, which is fine
for installing Tailr and wrong for the protocol the agent has to hold all
session. Setup now ends by writing those rules into the project.

This release also gives the agent a way to learn a batch has arrived without
polling and without the reviewer announcing it.

### New

[46d3520] — `tailr init` installs Tailr, registers its MCP server in `.mcp.json`
(and Cursor's copy where a project uses it), and writes the agent's operating
rules into `AGENTS.md` / `CLAUDE.md` between markers, so re-running rewrites its
own block and leaves everything around it alone.

[46d3520] — `PROMPT.md`, an agent-facing setup document, replacing
`SETUP-PROMPT.md`.

[dafd6ba] — `tailr wait` and the `tailr_wait` MCP tool hang on the session's
event stream and return within a moment of Send being pressed. Exit `0` a batch
is waiting, `3` timed out, `2` the session ended.

[dafd6ba] — `tailr pull --wait`, and `wait: true` on the `tailr_pull` MCP tool.

### Changed

[ec0000c] — The MCP server reports its version from the package manifest instead
of a string kept in step by hand.

### Fixed

[dafd6ba] — Double-click to edit did nothing on elements with no children.

## [0.2.0] — 2026-08-30

One fix, for two Tailr sessions in the same project.

### Fixed

[a997b4e] — Two Tailr sessions in one project fought over
`.tailr/session.json`: a second `tailr` that failed to bind the port would
deregister the session that was actually serving. A session file is now only
ever cleared by the process that wrote it.

## [0.1.0] — 2026-08-30

First published release.

### New

[eb6ab76] — Tailr's first published version: the proxy, the overlay, the bridge
and the CLI.
