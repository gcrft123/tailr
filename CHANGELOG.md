# Changelog

Everything notable that has changed in Tailr, newest first. Versions follow
[semantic versioning](https://semver.org/spec/v2.0.0.html). Each release opens
with a short summary, then lists its changes grouped as New, Changed and Fixed —
one change per line, each naming the commit that carries it.

Every release is a `vX.Y.Z` git tag. Pushing that tag is what publishes to npm
and cuts the matching [GitHub Release](https://github.com/gcrft123/tailr/releases),
and the notes it carries are the section below that bears its version — so a
release with nothing written here does not go out. See [RELEASING.md](RELEASING.md).

## [Unreleased]

## [1.4.2] — 2026-09-23

Holding Alt lit whatever was under the cursor and then left the outline there.
On macOS the pointer keeps moving, but that move often shows up without the Alt
flag, or only as a pointer event, so the outline either dropped or never
retargeted. Mashing keys forced a fresh mouse event, which is why it eventually
followed. A click in that state was easy to lose as well: the chord sometimes
arrives as mouseup or a context menu instead of click, and the next press
committed the empty note and threw the mark away.

Zooming the page pulled marks off what they marked. A spot was stored as page
coordinates, and a zoom reflows the page, so the spot stayed where it was while
the content under it moved. A page that zooms itself with CSS `zoom` was worse
off: the overlay inherited that zoom and applied it a second time to every
outline it drew.

### Fixed

[4dfec4f] — The outline follows the pointer for as long as Alt is held.

[4dfec4f] — The first Alt-click places a comment from mouseup, and an empty composer does not swallow the next one.

[4dfec4f] — Over a modal, the overlay moves into the dialog and up into the top layer so the composer can take the caret.

[7aa5888] — A spot stays on the element it was placed on when the page is zoomed or reflows.

[7aa5888] — On a page with CSS `zoom` on `<html>`, the hover outline, marks and composer line up with the page again.

[7aa5888] — An open composer moves with its element when the page is zoomed.

## [1.4.1] — 2026-09-13

Agents were stopping after they closed a run. `done` and `fail` returned state
and named nothing to do next, and an agent that ends its turn under MCP cannot
be reached again unless something wakes it.

Both steps now say what follows, and the operating rules make re-arming `wait` a
rule of its own instead of a trailing clause.

### Changed

[90ad8a4] — `done` and `fail` name the next step instead of returning state alone.

[90ad8a4] — The MCP tools print that step as a `next:` line; the CLI writes it to stderr.

[90ad8a4] — The rules make re-arming `wait` a rule of its own.

[90ad8a4] — The rules treat "Tailr wakes this agent" as a condition to check, not permission to stop.

## [1.4.0] — 2026-09-12

A mark whose element left the page was flagged to the agent as `orphaned`, and
the rules told the agent to stop and ask the reviewer about it. The flag was
wrong: the agent works in the source, where an element that stopped rendering
and one that never moved are the same mark, and the address still resolves.

The flag is gone from the batch. The reviewer still sees the state, now called
hidden. The walkthrough became a setting that belongs to the person rather than
the project, and three overlay defects found while testing are fixed.

### Changed

[559ea73] — A mark whose element is off screen reads as hidden rather than orphaned.

[559ea73] — The batch sent to the agent no longer mentions it.

[559ea73] — The reviewer is still told, on the mark's row, because the missing badge is theirs to explain.

[559ea73] — A hidden mark stays editable from that row.

[559ea73] — Its composer opens in the middle of the viewport, having no element to sit on.

[559ea73] — Inline text edits are the exception: the reviewer types into the element.

[559ea73] — The walkthrough is a `tutorial` setting in `~/.tailr/config.json`.

[559ea73] — It shows until the first mark, then never again, on every project rather than once per dev server.

[559ea73] — `tailr config tutorial:true` asks for it back.

### Fixed

[559ea73] — Versions and slider chips no longer spill over the source address beside them.

[559ea73] — Reopening a mark updates its row in the staged list.

[559ea73] — The comment box draws its own scrollbar, on every engine, instead of the host browser's.

## [1.3.3] — 2026-09-07

Tailr can now wake the agent when Send is pressed, so the handoff works on
clients that cannot tell the model a background process exited — Codex among
them, where `tailr wait` exits into nothing and the MCP `tailr_wait` gives up
after a minute.

The rest of the release makes that wake survive a cleared conversation, adds
detached `start` / `stop` so a host runner cannot kill the session along with
the agent's shell, and pins the Claude Code plugin to the release tag.

### New

[743898e] — `--notify <command>` runs a command on each batch.

[743898e] — `%n` is the mark count, `%t` the agent's thread, `%u` the review URL.

[743898e] — `TAILR_NOTIFY` sets the same command from the environment.

[743898e] — `--no-notify` turns waking off.

[743898e] — A session started inside Codex wakes the agent with no configuration, off `CODEX_THREAD_ID`.

[743898e] — Thread ids are shape-checked and the argv is built directly, so nothing in the environment reaches a shell.

[743898e] — `status` reports `wakesAgent`, `wakesYou` on the MCP tool.

[743898e] — The operating rules tell the agent to skip `wait` when it is true.

[4ec6571] — Every agent-side command registers the thread it is running on, so a cleared conversation repairs the wake.

[4ec6571] — A batch still unclaimed 45 seconds after a wake says so.

[a02d5fd] — `tailr_status` asks for one `npx tailr status` when the MCP process can see no thread id of its own.

[6b54c97] — `tailr start` detaches inside Node and returns once the review URL is ready.

[6b54c97] — `tailr stop` is the teardown.

[6b54c97] — `tailr_start` and `tailr_stop` do the same over MCP.

[6b54c97] — Serve ignores SIGHUP, so a hung-up agent shell cannot take the session with it.

### Changed

[6b54c97] — Agent-facing docs no longer name `.tailr/session.json`.

[6b54c97] — They no longer ask the agent to background the server from a shell.

[5374b1e] — The Claude Code marketplace installs the plugin from the release tag rather than `main`.

[5374b1e] — The catalog entry is a `git-subdir` source, pinned during the version bump.

[5374b1e] — The tests fail if that entry ever names a branch.

[5374b1e] — Cursor, Codex, Copilot, Gemini and Antigravity still read `plugin/` from the default branch.

[9985fca] — The README documents sliders, which shipped in 1.2.0 and were never mentioned there.

[9985fca] — Its MCP table lists `tailr_variants`, `tailr_slider` and `tailr_config`.

[9985fca] — Four incorrect statements are corrected and three repeated explanations removed.

### Fixed

[7a96d2e] — The release workflow installs dependencies before running the suite, which needs `jsdom`.

[4c33cce] — Tailr refuses to wake a Codex conversation that has been cleared.

[4c33cce] — It checks Codex's thread store for a thread created later in the same directory.

[4c33cce] — `created_at` is compared, because `updated_at` is bumped by the queueing in question.

[4c33cce] — A machine that cannot read the store refuses rather than guessing, and the batch waits.

[89bf8a9] — The dev-server-down page says the session is still up and the marks are safe.

[89bf8a9] — It watches for the dev server and reloads when it answers.

[1ff6567] — `npx -y @gcrft123/tailr <command>` works inside a Tailr checkout.

[11a488e] — The end-of-session cards name the sliders in the cleanup, not only the versions.

## [1.3.2] — 2026-09-06

Most of this came from the first outside install report. One part was a defect:
a dev server that compresses its HTML regardless of what was asked of it had its
pages passed through unrewritten, so the reviewer got a page where holding the
key did nothing.

The rest was Tailr addressing the wrong person — handing the reviewer the
agent's commands, naming a modifier key they had changed — plus `tailr demo`,
which runs the whole loop against a sample app with nothing installed.

### New

[4ab2a67] — `tailr demo` starts a sample application, proxies it and prints a review URL.

[4ab2a67] — The sample app ships with the package, so nothing has to be cloned first.

### Changed

[4ab2a67] — The line printed at session start names the key the reviewer actually holds.

[4ab2a67] — It stops handing the reviewer's instructions and the agent's next command to one reader.

[4ab2a67] — `tailr init` closes with what the person who ran it should do next.

[4ab2a67] — The README lists all four files `init` edits, where `init` is first mentioned.

[4ab2a67] — Requirements covers what Tailr asks of a dev server, not only which Node it needs.

[4ab2a67] — It says a `null` source address is a fallback rather than a failure.

[4ab2a67] — Skills installed without a marketplace are now `tailr-start`, `tailr-review` and `tailr-config`.

[4ab2a67] — Their commands are `/tailr-start` and `/tailr-config`; the old bare names are gone rather than aliased.

[4ab2a67] — A marketplace install is unaffected and still reads `/tailr:start`.

[67fc956] — The README says what Antigravity actually calls these commands, checked by installing it.

[5032491] — A release note claiming extension installs were unaffected by the rename is corrected before shipping.

### Fixed

[4ab2a67] — A dev server that compresses its HTML regardless now gets the overlay, gzip, deflate or brotli.

[4ab2a67] — An encoding Tailr cannot undo still passes through intact.

## [1.3.1] — 2026-09-05

Found by installing 1.3.0 every documented way — through the Claude, Codex,
Copilot, Cursor and Antigravity CLIs — and driving a review loop through each.
Four defects in argument handling, session ownership and error reporting, and
three documentation corrections.

### Changed

[a1bc285] — PROMPT.md tells the agent to re-run `init` with `--file` when the project had no instruction file of its own.

[a1bc285] — The landing page's agent fan carries Antigravity in place of Gemini CLI.

[a1bc285] — The README's Gemini CLI section is now an Antigravity CLI one.

[a1bc285] — The `npx skills add` paragraph says where that installer puts things, and without which prefix.

### Fixed

[a1bc285] — `--target localhost:5173` and `--target 127.0.0.1:3000` proxy instead of answering 502.

[a1bc285] — `--target 5173` reads as a port instead of crashing with a stack trace.

[a1bc285] — What cannot be a dev server URL is refused in a sentence.

[a1bc285] — A second `tailr` in a project with a live session is turned away with that session's URL.

[a1bc285] — `tailr progress` with an unknown ref returns 400 and names the refs that are in the batch.

[a1bc285] — `tailr init` registers the MCP server with `-y`, the same as the plugin, so npx never stalls.

## [1.3.0] — 2026-09-05

Tailr answers every action with a sound now — nine cues, each with its own
shape, synthesized live so no audio file ships.

Sound is not something to give someone with no way out, and the key held to mark
was never going to suit every app or OS, so both are settings. They belong to
the person rather than the project, which is why they live in
`~/.tailr/config.json` and nothing new appears in anyone's repository.

### New

[c40b683] — Nine interaction sounds, one shape per action, on by default.

[c40b683] — They are synthesized through the Web Audio API, so nothing is fetched and no audio file ships.

[c40b683] — A key going down stays quiet, bar the Enter that commits a comment.

[c40b683] — `sfx:false` turns the lot off.

[c40b683] — `/tailr:config`, `tailr config` and the `tailr_config` MCP tool read or change settings.

[c40b683] — Settings live in `~/.tailr/config.json` and hold across every project.

[c40b683] — A change made while a session is up is pushed to the open review page.

[c40b683] — `modifier` sets the key held to mark: `alt` by default, or `ctrl` or `cmd`.

[c40b683] — Every hint on screen names whichever key is set.

[c40b683] — `tailr_status` reports it, so the agent never has to guess.

### Changed

[c40b683] — The sounds are [Cuelume](https://github.com/Danilaa1/cuelume), copied in under its MIT licence rather than installed.

## [1.2.0] — 2026-09-04

A comment could ask for up to four versions since 1.1.0; it can now ask for a
continuous parameter instead. The agent wires one value behind an attribute,
reports its range, and the reviewer scrubs it on the page before keeping a
number.

Tailr also became installable on Cursor, Codex, Copilot and Gemini, and a
handful of overlay defects around pills and latched markup are fixed.

### New

[76dfe2b] — A comment can ask for a continuous parameter instead of versions.

[76dfe2b] — The agent wires it behind `data-tailr-slide-<ref>`.

[76dfe2b] — `tailr slider` and `tailr_slider` report its range.

[76dfe2b] — The reviewer scrubs the pill on the page before keeping a value.

[76dfe2b] — Keep minimizes the pill to that value with its reference number, which reopens it.

[76dfe2b] — Reset puts the parameter back to the agent's default.

[76dfe2b] — Keeping the value already kept takes the keep back.

[2ffc783] — `/tailr:start` is a slash-command skill, which the model will not fire on its own.

[2ffc783] — Plugin catalogs for Cursor, Codex, GitHub Copilot CLI and Gemini CLI.

[2ffc783] — Agents with no marketplace take the skills through `npx skills add gcrft123/tailr -g`.

[eb9d89e] — On Cursor, `/start` is a command file rather than a plugin skill, which Cursor will not load.

### Changed

[76dfe2b] — Mark reference numbers reset with each session, starting at 01.

[76dfe2b] — Clicking a text mark's badge reopens the inline editor, with a Delete / Done bar.

[76dfe2b] — Marking something that already has a mark reopens it instead of stacking a second.

[76dfe2b] — A slider's row in the staged list carries Keep, Reset and the `×` that removes it.

### Fixed

[76dfe2b] — Pills near the edge of the viewport flip or slide instead of rendering offscreen.

[76dfe2b] — A slider pill follows its element while the page scrolls.

[76dfe2b] — Keeping a value no longer rebuilds the pill, so the button under the pointer survives the click.

[76dfe2b] — A sent batch disables a slider's controls rather than only greying them.

[76dfe2b] — Keep reads as kept: its lit state used to be the same paper as its resting state.

[2ffc783] — The Claude Code app can add Tailr from this repository.

[ca29138] — Typing into a field no longer loses characters to markup shortcuts.

[ca29138] — Escape still reaches Tailr from the application's own fields.

[ca29138] — Tailr's inline editor answers Escape without also dropping the mode it was edited from.

## [1.1.0] — 2026-09-02

A comment could only ever be answered once. It can now ask for up to four
versions of the same change, built at once and switched between live on the
page, so the comparison is between the real things rather than two descriptions
of them.

Versions leave guards in the source, so this release also adds the way out: End
session sits under the island's panel and runs a cleanup pass that takes the
undecided versions, and their switches, back out.

### New

[2574bbb] — A comment can ask for up to four versions of the same change.

[2574bbb] — The composer carries a `1×` button beside Add that cycles to `4×`.

[2574bbb] — The agent builds every version at once, each guarded on an attribute Tailr sets on `<html>`.

[2574bbb] — A pill on the element switches between them live, widening to each version's name on hover.

[2574bbb] — Keeping a version is a mark like any other, and joins the batch.

[2574bbb] — Sending it makes that version permanent and takes the losing ones, and the guards, out of the source.

[2574bbb] — The `×` on its row turns the whole set down.

[2574bbb] — An unresolved set keeps the island awake.

[2574bbb] — `tailr variants <ref> <names…>` and `tailr_variants` report what was built.

[8a21b28] — End session sits under the island's panel.

[8a21b28] — It asks first, with a card naming each consequence on its own line.

[8a21b28] — Confirming hands the agent a cleanup batch that removes undecided versions from the source.

[8a21b28] — The switches come off the document and what Tailr kept in the browser is cleared.

[8a21b28] — End anyway leaves without the agent and says the cleanup did not finish.

### Fixed

[2574bbb] — A session survives more than one batch.

[2574bbb] — A closed run only prompts the page that watched it close, rather than every reload.

## [1.0.0] — 2026-09-02

The first release with a release flow behind it: a pushed tag runs the tests,
publishes to npm as a trusted publisher and cuts the GitHub Release from this
file. Tailr also became installable as a Claude Code plugin, which is the same
durability `tailr init` gives without editing anything in the project.

Underneath, source resolution stopped depending on a React internal that was
removed in React 19, four bridge and proxy defects are fixed, and there is now a
test suite that caught one of them.

### New

[5c3cbb5] — Tailr installs as a Claude Code plugin, with this repository as its marketplace.

[5c3cbb5] — The plugin carries the MCP server, the operating rules as a skill, and `/tailr:start`.

[5c3cbb5] — `npm test` fails if the plugin's rules or advertised version drift from the source.

[a68c067] — Pushing a `vX.Y.Z` tag runs the tests, publishes to npm and cuts a GitHub Release.

[a68c067] — `npm version` is the whole local interface to it.

[b6fe152] — Publishing authenticates as a trusted publisher over OIDC, so no npm token is stored.

[875087b] — A test suite, `npm test`, with no dependencies, covering the bridge, proxy, `wait` and `init`.

[875087b] — CI runs it on Node 18, 20 and 22, and fails if Tailr takes on a runtime dependency.

[f919b5c] — Source resolution reads the markers Vue, react-dev-inspector, Astro and Svelte emit.

[f919b5c] — Windows paths and trailing column numbers are handled.

[369c6ab] — `npm run demo` starts the app it proxies.

### Changed

[65c98bb] — PRODUCT.md no longer describes the project as having no implementation.

[65c98bb] — The overlay surface doc describes the Island that shipped, not the withdrawn Callout direction.

### Fixed

[875087b] — An `https://` target no longer crashes the session process on the first page request.

[875087b] — Rewritten HTML no longer carries both chunked encoding and a computed `content-length`.

[875087b] — `tailr status` no longer reports the agent's own leased run back as a waiting batch.

[875087b] — Closing a closed run returns `409 No open run.` instead of `500 Server error.`

[875087b] — A synchronous failure inside the proxy costs one page rather than the session.

## [0.3.0] — 2026-08-31

A pasted setup prompt is read once and then falls out of context, which is fine
for installing Tailr and wrong for the protocol the agent has to hold all
session. Setup now ends by writing those rules into the project.

This release also gives the agent a way to learn a batch has arrived without
polling and without the reviewer announcing it.

### New

[46d3520] — `tailr init` installs Tailr and registers its MCP server in `.mcp.json`.

[46d3520] — It writes the operating rules into `AGENTS.md` / `CLAUDE.md` between markers.

[46d3520] — Re-running it rewrites its own block and leaves everything around it alone.

[46d3520] — `PROMPT.md`, addressed to the agent, replaces `SETUP-PROMPT.md`.

[dafd6ba] — `tailr wait` and `tailr_wait` return within a moment of Send being pressed.

[dafd6ba] — They exit `0` a batch is waiting, `3` timed out, `2` the session ended.

[dafd6ba] — `tailr pull --wait`, and `wait: true` on the `tailr_pull` MCP tool.

### Changed

[ec0000c] — The MCP server reports its version from the package manifest.

### Fixed

[dafd6ba] — Double-click to edit did nothing on elements with no children.

## [0.2.0] — 2026-08-30

Two Tailr sessions in one project fought over `.tailr/session.json`.

### Fixed

[a997b4e] — A second `tailr` that failed to bind the port no longer deregisters the session that is serving.

[a997b4e] — A session file is only ever cleared by the process that wrote it.

## [0.1.0] — 2026-08-30

First published release.

### New

[eb6ab76] — Tailr's first published version: the proxy, the overlay, the bridge and the CLI.
