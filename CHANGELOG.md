# Changelog

Everything notable that has changed in Tailr, newest first. Versions follow
[semantic versioning](https://semver.org/spec/v2.0.0.html). Each release opens
with a short summary, then lists its changes grouped as New, Changed and Fixed —
one change per line, each naming the commit that carries it.

Every release is a `vX.Y.Z` git tag. Pushing that tag is what publishes to npm
and cuts the matching [GitHub Release](https://github.com/gcrft123/tailr/releases),
whose notes come from [RELEASE-NOTES.md](RELEASE-NOTES.md) — the shorter account,
written for the people using Tailr. A release with nothing written here does not
go out either. See [RELEASING.md](RELEASING.md).

## [Unreleased]

## [1.5.0] — 2026-11-05

A pass over every state the overlay can be in, from the welcome card to the ended card, for radii, spacing, alignment and copy. Most of it is small: corners that weren't concentric, a button whose label sat 10px off the text above it, a column too narrow for the word it was sized for. Two were real faults. A slider and a version set on the same element were drawn on top of each other, and while a run was open both pills went half transparent over the page, which the design rules out.

Marks sit on top of the thing they mark, so judging how a page looks meant sending the batch or deleting marks to get them out of the way. They can now be put out of sight for a moment and brought back.

Agents that build versions or a slider were told to read the switch as `dataset.tailrVar03`. A hyphen is camel-cased only when a letter follows it, so `data-tailr-var-03` comes out as `dataset["tailrVar-03"]`, and an agent that followed the instructions read nothing and always rendered version 1. Slider values had the same fault.

Google also wouldn't index the landing page. It answered at trytailr.app, www.trytailr.app, both of those over http, and a workers.dev address, all with the same HTML and none naming itself the real one, so Search Console set the page aside as a duplicate. The page now names its canonical address, and www and http redirect to it through Cloudflare zone settings that live outside this repo.

### New

[77b1d16] — Pressing H while holding the marking key, or H alone once marking is latched, hides every mark, version pill and slider on the page, and pressing it again shows them.

[77b1d16] — The staged list has a Hide marks button across from End session, which reads Show marks while they're hidden.

[77b1d16] — The batch pill shows a crossed-out eye while marks are hidden.

[77b1d16] — Making a mark, or the agent adding versions or a slider, shows hidden marks again.

[77b1d16] — The walkthrough's gesture key lists H, except on a Mac whose marking key is Command, where ⌘H hides the browser instead.

[3d6a7c3] — The landing page serves a sitemap listing https://trytailr.app/, and a robots.txt that points to it.

### Changed

[a54c234] — The composer uses the panel radius (16px), and its text field is 6px so the two corners are concentric; the field's focus ring is 1px instead of 2px.

[a54c234] — The composer's footer puts the version and slider controls on the left and Discard and Add on the right.

[a54c234] — A spot's composer and list row no longer show its address, which was only the route.

[a54c234] — The staged list shows a route header only when it tells something apart, and the version and slider groups are headed `Versions — keep one` and `Sliders — keep a value` in the sans face.

[a54c234] — A list row's flags (`3×`, `slider`) come after the comment, so the address and comment columns line up across rows, and the kind column is wide enough for `Comment`.

[a54c234] — A list row's flags are quiet 18px chips in muted text instead of white on the badge fill, and the slider flag is the composer's slider icon instead of the word.

[a54c234] — The batch pill says `Needs reload` instead of `Needs refresh`, matching the agent pill's Reload button.

[a54c234] — The finished-run card says "Reload to see them." and the incomplete-run card drops "Tailr can't say why".

[a54c234] — Once the session is ending, the pill's row gives way to the card, which is 340px wide with its buttons right-aligned 10px from the corner.

[a54c234] — The count at the front of the batch pill sits concentric with the pill's end cap, End session lines up with the row's text margin, and the agent card's Cancel lines up with its title.

[a54c234] — The walkthrough and ending cards fill their width, and the gesture key has the same top margin as its side margins.

[a54c234] — The landing page's staged overlay replicas follow the new composer, list and pill values.

[3d6a7c3] — The landing page no longer deploys to a workers.dev address or to a preview URL for each version.

[ad60053] — The setup prompt, the rules `tailr init` writes, the plugin skills and the MCP tool descriptions say the `tailr:variant` and `tailr:slide` events carry the chosen version or value.

### Fixed

[ad60053] — The setup prompt, the rules `tailr init` writes, the plugin skills and the MCP tool descriptions read a version or slider switch with `getAttribute("data-tailr-var-<ref>")` instead of through `dataset`, which never matched it.

[a54c234] — A slider on an element that also has versions stacks above the version pill instead of covering it.

[a54c234] — Version and slider pills stay opaque while a run is open; only their contents dim.

[a54c234] — Editing text in place no longer shows the browser's focus ring on top of the mark's own outline.

[a54c234] — The slider row's Keep, reset and × sit at the row's end, and buttons in a card's action row no longer touch.

[3d6a7c3] — The landing page names https://trytailr.app/ as its canonical address, so Google indexes it instead of filing it as a duplicate.

[3d6a7c3] — The landing page's link preview image is an absolute URL, so previews that can't resolve a relative path still show it.

## [1.4.3] — 2026-10-07

Agents closed a run and went quiet. Under MCP, `done` sent them straight back
into `tailr_wait`, which holds the turn open, so the account of what changed
stayed in the agent's thinking or in a line written between tool calls. Clients
like T3 Code fold both away and show only the message a turn ends on, so the
reviewer saw "Still waiting for your next batch" and nothing about the batch.

Closing a run now asks for a reply as the last thing in the turn, after the
listener is armed, and points MCP agents at a backgrounded `wait` so the turn can
actually end on it.

Reopening a text mark puts a Delete and Done bar under the element, and that bar
was placed once when the edit opened. As the reviewer typed and the text wrapped,
the bar stayed under the first line and covered the new ones.

CI also failed now and then with "Unable to deserialize cloned data". It was
never a flake: the server's terminal lines reached the test runner's stdout,
which node:test can misread as a result.

Each GitHub Release was this file's section pasted in, every change keyed to
its commit, which suits a contributor rather than someone deciding whether to
update. Releases now carry notes of their own, written for the people using
Tailr.

The overlay also cost the page it sat on more than it had to. With marks on
the page it re-placed every one of them on every frame, whether or not anything
had moved, and interleaved reads with writes so each frame forced a style pass
per mark. Holding the key re-resolved the source address and redrew the outline
on every pointer event, and the outline's resizing repainted the host page's
whole paint list each time. Marks were placed by script over a fixed layer, so
they trailed their elements whenever the page scrolled under a busy main thread.
Every Alt-click waited 260ms to rule out a double-click, even where a
double-click meant nothing, and the proxy held a streamed page back until its
last byte.

Marks now live in a layer that scrolls with the document, the tracking loop
sleeps once nothing moves, and the hover outline is drawn from pieces that only
move. On a 6,000-element test page with 40 marks, the overlay's idle cost fell
from about 4% of the main thread to about 0.1%, and holding the key costs about
a third of what it did.

The landing page's copy button broke on phones: from 414px down, its label
wrapped onto two lines inside the pill. A copy also shrank the button under
the pointer and left a stray dot above the check.

### Changed

[34741b6] — `done` and `fail` ask the agent to end its turn on a written reply saying what changed for each mark.

[34741b6] — Under MCP, closing a run points at `npx -y @gcrft123/tailr wait` in the background, with `tailr_wait` as the fallback for clients that cannot run one.

[34741b6] — The operating rules make ending on a reply a rule of its own.

[34741b6] — The wake message Codex receives asks for the same reply.

[a6d2131] — A GitHub Release takes its title and notes from `RELEASE-NOTES.md` instead of copying its section of this file.

[a6d2131] — `npm version` refuses a release whose notes or title are missing, and stamps the notes with the version alongside the changelog.

[dfb9c9d] — Marks, version pills and slider pills on the page scroll with the document instead of being re-placed by script, so they no longer trail their elements while the page scrolls.

[dfb9c9d] — Marks on something fixed or sticky are still drawn over the viewport, and right-to-left pages keep every mark there.

[dfb9c9d] — The overlay stops tracking marks on frames where nothing moved, and wakes on scrolling, resizing, transitions, animations, loaded resources and DOM changes.

[dfb9c9d] — Each tracking frame reads every position before writing any, and writes only what changed.

[dfb9c9d] — Holding the key hit-tests once per frame instead of on every mouse event, and resolves each element's source address once.

[dfb9c9d] — The hover outline glides between elements and is drawn from pieces that only move, so following the pointer no longer repaints the page.

[dfb9c9d] — The hover outline's source address appears once the pointer rests on an element.

[dfb9c9d] — A press thickens the hover outline before anything opens.

[dfb9c9d] — Alt-clicking something with no text opens its comment at once; only text still waits to see whether the click starts a double-click.

[dfb9c9d] — Opening a mark from the staged list acts at once when its element is already on screen, and otherwise when the scroll to it finishes.

[dfb9c9d] — Scrubbing a slider updates the page once per frame.

[35d7dbc] — The proxy streams HTML the dev server streams, injecting the overlay as the page passes through.

[35d7dbc] — The overlay script is served with an ETag and revalidated, so a reload reuses the browser's copy instead of downloading and compiling it again.

[dfb9c9d] — A comment left empty, or a text edit that never changed the text, gives its number back, so the next mark takes it, unless a batch has gone out from the page.

[d5a73f6] — The landing page's copy button keeps one width through a copy, and the result slides in where the label was.

[d5a73f6] — A blocked copy turns the button's icon into an arrow pointing at the prompt revealed below it.

[d5a73f6] — The agent logos in the copy button are larger, and nod once along the row when the prompt is copied.

[d5a73f6] — With JavaScript off, the landing page shows the prompt in place of the copy button.

### Fixed

[1e48e4e] — The Delete and Done bar on a reopened text edit stays below the text as it grows, and follows it through a scroll.

[0a97b23] — Tests run the server with its terminal lines silenced, so node:test can no longer misread one as a result and fail the file.

[dfb9c9d] — A new mark, version pill or slider pill no longer flashes in the top-left corner of the page while it lands.

[dfb9c9d] — Holding the modifier on Windows or Linux no longer latches marking on once the key starts repeating.

[35d7dbc] — A HEAD request or a 304 for an HTML page is no longer handed a script tag as its body.

[d5a73f6] — The landing page's copy button stays on one line on phones instead of wrapping inside the pill.

[d5a73f6] — The check after a copy no longer has a stray dot above it.

[d5a73f6] — The copy button's hover no longer sticks on touch screens after a tap.

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

[b568a19] — The outline follows the pointer for as long as Alt is held.

[b568a19] — The first Alt-click places a comment from mouseup, and an empty composer does not swallow the next one.

[b568a19] — Over a modal, the overlay moves into the dialog and up into the top layer so the composer can take the caret.

[4484cb5] — A spot stays on the element it was placed on when the page is zoomed or reflows.

[4484cb5] — On a page with CSS `zoom` on `<html>`, the hover outline, marks and composer line up with the page again.

[4484cb5] — An open composer moves with its element when the page is zoomed.

## [1.4.1] — 2026-09-13

Agents were stopping after they closed a run. `done` and `fail` returned state
and named nothing to do next, and an agent that ends its turn under MCP cannot
be reached again unless something wakes it.

Both steps now say what follows, and the operating rules make re-arming `wait` a
rule of its own instead of a trailing clause.

### Changed

[24e06b9] — `done` and `fail` name the next step instead of returning state alone.

[24e06b9] — The MCP tools print that step as a `next:` line; the CLI writes it to stderr.

[24e06b9] — The rules make re-arming `wait` a rule of its own.

[24e06b9] — The rules treat "Tailr wakes this agent" as a condition to check, not permission to stop.

## [1.4.0] — 2026-09-12

A mark whose element left the page was flagged to the agent as `orphaned`, and
the rules told the agent to stop and ask the reviewer about it. The flag was
wrong: the agent works in the source, where an element that stopped rendering
and one that never moved are the same mark, and the address still resolves.

The flag is gone from the batch. The reviewer still sees the state, now called
hidden. The walkthrough became a setting that belongs to the person rather than
the project, and three overlay defects found while testing are fixed.

### Changed

[da1e332] — A mark whose element is off screen reads as hidden rather than orphaned.

[da1e332] — The batch sent to the agent no longer mentions it.

[da1e332] — The reviewer is still told, on the mark's row, because the missing badge is theirs to explain.

[da1e332] — A hidden mark stays editable from that row.

[da1e332] — Its composer opens in the middle of the viewport, having no element to sit on.

[da1e332] — Inline text edits are the exception: the reviewer types into the element.

[da1e332] — The walkthrough is a `tutorial` setting in `~/.tailr/config.json`.

[da1e332] — It shows until the first mark, then never again, on every project rather than once per dev server.

[da1e332] — `tailr config tutorial:true` asks for it back.

### Fixed

[da1e332] — Versions and slider chips no longer spill over the source address beside them.

[da1e332] — Reopening a mark updates its row in the staged list.

[da1e332] — The comment box draws its own scrollbar, on every engine, instead of the host browser's.

## [1.3.3] — 2026-09-07

Tailr can now wake the agent when Send is pressed, so the handoff works on
clients that cannot tell the model a background process exited — Codex among
them, where `tailr wait` exits into nothing and the MCP `tailr_wait` gives up
after a minute.

The rest of the release makes that wake survive a cleared conversation, adds
detached `start` / `stop` so a host runner cannot kill the session along with
the agent's shell, and pins the Claude Code plugin to the release tag.

### New

[f313423] — `--notify <command>` runs a command on each batch.

[f313423] — `%n` is the mark count, `%t` the agent's thread, `%u` the review URL.

[f313423] — `TAILR_NOTIFY` sets the same command from the environment.

[f313423] — `--no-notify` turns waking off.

[f313423] — A session started inside Codex wakes the agent with no configuration, off `CODEX_THREAD_ID`.

[f313423] — Thread ids are shape-checked and the argv is built directly, so nothing in the environment reaches a shell.

[f313423] — `status` reports `wakesAgent`, `wakesYou` on the MCP tool.

[f313423] — The operating rules tell the agent to skip `wait` when it is true.

[6aa78a7] — Every agent-side command registers the thread it is running on, so a cleared conversation repairs the wake.

[6aa78a7] — A batch still unclaimed 45 seconds after a wake says so.

[fff0c7d] — `tailr_status` asks for one `npx tailr status` when the MCP process can see no thread id of its own.

[5421132] — `tailr start` detaches inside Node and returns once the review URL is ready.

[5421132] — `tailr stop` is the teardown.

[5421132] — `tailr_start` and `tailr_stop` do the same over MCP.

[5421132] — Serve ignores SIGHUP, so a hung-up agent shell cannot take the session with it.

### Changed

[5421132] — Agent-facing docs no longer name `.tailr/session.json`.

[5421132] — They no longer ask the agent to background the server from a shell.

[825e2b4] — The Claude Code marketplace installs the plugin from the release tag rather than `main`.

[825e2b4] — The catalog entry is a `git-subdir` source, pinned during the version bump.

[825e2b4] — The tests fail if that entry ever names a branch.

[825e2b4] — Cursor, Codex, Copilot, Gemini and Antigravity still read `plugin/` from the default branch.

[1895585] — The README documents sliders, which shipped in 1.2.0 and were never mentioned there.

[1895585] — Its MCP table lists `tailr_variants`, `tailr_slider` and `tailr_config`.

[1895585] — Four incorrect statements are corrected and three repeated explanations removed.

### Fixed

[2a2ce4f] — The release workflow installs dependencies before running the suite, which needs `jsdom`.

[d8f6a0a] — Tailr refuses to wake a Codex conversation that has been cleared.

[d8f6a0a] — It checks Codex's thread store for a thread created later in the same directory.

[d8f6a0a] — `created_at` is compared, because `updated_at` is bumped by the queueing in question.

[d8f6a0a] — A machine that cannot read the store refuses rather than guessing, and the batch waits.

[ee344ff] — The dev-server-down page says the session is still up and the marks are safe.

[ee344ff] — It watches for the dev server and reloads when it answers.

[2cc2680] — `npx -y @gcrft123/tailr <command>` works inside a Tailr checkout.

[470a0ce] — The end-of-session cards name the sliders in the cleanup, not only the versions.

## [1.3.2] — 2026-09-06

Most of this came from the first outside install report. One part was a defect:
a dev server that compresses its HTML regardless of what was asked of it had its
pages passed through unrewritten, so the reviewer got a page where holding the
key did nothing.

The rest was Tailr addressing the wrong person — handing the reviewer the
agent's commands, naming a modifier key they had changed — plus `tailr demo`,
which runs the whole loop against a sample app with nothing installed.

### New

[01dfe04] — `tailr demo` starts a sample application, proxies it and prints a review URL.

[01dfe04] — The sample app ships with the package, so nothing has to be cloned first.

### Changed

[01dfe04] — The line printed at session start names the key the reviewer actually holds.

[01dfe04] — It stops handing the reviewer's instructions and the agent's next command to one reader.

[01dfe04] — `tailr init` closes with what the person who ran it should do next.

[01dfe04] — The README lists all four files `init` edits, where `init` is first mentioned.

[01dfe04] — Requirements covers what Tailr asks of a dev server, not only which Node it needs.

[01dfe04] — It says a `null` source address is a fallback rather than a failure.

[01dfe04] — Skills installed without a marketplace are now `tailr-start`, `tailr-review` and `tailr-config`.

[01dfe04] — Their commands are `/tailr-start` and `/tailr-config`; the old bare names are gone rather than aliased.

[01dfe04] — A marketplace install is unaffected and still reads `/tailr:start`.

[4eca43f] — The README says what Antigravity actually calls these commands, checked by installing it.

[b74e0d7] — A release note claiming extension installs were unaffected by the rename is corrected before shipping.

### Fixed

[01dfe04] — A dev server that compresses its HTML regardless now gets the overlay, gzip, deflate or brotli.

[01dfe04] — An encoding Tailr cannot undo still passes through intact.

## [1.3.1] — 2026-09-05

Found by installing 1.3.0 every documented way — through the Claude, Codex,
Copilot, Cursor and Antigravity CLIs — and driving a review loop through each.
Four defects in argument handling, session ownership and error reporting, and
three documentation corrections.

### Changed

[a63941f] — PROMPT.md tells the agent to re-run `init` with `--file` when the project had no instruction file of its own.

[a63941f] — The landing page's agent fan carries Antigravity in place of Gemini CLI.

[a63941f] — The README's Gemini CLI section is now an Antigravity CLI one.

[a63941f] — The `npx skills add` paragraph says where that installer puts things, and without which prefix.

### Fixed

[a63941f] — `--target localhost:5173` and `--target 127.0.0.1:3000` proxy instead of answering 502.

[a63941f] — `--target 5173` reads as a port instead of crashing with a stack trace.

[a63941f] — What cannot be a dev server URL is refused in a sentence.

[a63941f] — A second `tailr` in a project with a live session is turned away with that session's URL.

[a63941f] — `tailr_wait` gives up after 55 seconds by default instead of 300, inside the per-call limit Cursor's MCP client allows.

[a63941f] — The MCP server sends progress notifications while a wait lasts, for clients that reset their timeout on them.

[a63941f] — `tailr progress` with an unknown ref returns 400 and names the refs that are in the batch.

[a63941f] — `tailr init` registers the MCP server with `-y`, the same as the plugin, so npx never stalls.

## [1.3.0] — 2026-09-05

Tailr answers every action with a sound now — nine cues, each with its own
shape, synthesized live so no audio file ships.

Sound is not something to give someone with no way out, and the key held to mark
was never going to suit every app or OS, so both are settings. They belong to
the person rather than the project, which is why they live in
`~/.tailr/config.json` and nothing new appears in anyone's repository.

### New

[0613fc0] — Nine interaction sounds, one shape per action, on by default.

[0613fc0] — They are synthesized through the Web Audio API, so nothing is fetched and no audio file ships.

[0613fc0] — A key going down stays quiet, bar the Enter that commits a comment.

[0613fc0] — `sfx:false` turns the lot off.

[0613fc0] — `/tailr:config`, `tailr config` and the `tailr_config` MCP tool read or change settings.

[0613fc0] — Settings live in `~/.tailr/config.json` and hold across every project.

[0613fc0] — A change made while a session is up is pushed to the open review page.

[0613fc0] — `modifier` sets the key held to mark: `alt` by default, or `ctrl` or `cmd`.

[0613fc0] — Every hint on screen names whichever key is set.

[0613fc0] — `tailr_status` reports it, so the agent never has to guess.

### Changed

[0613fc0] — The sounds are [Cuelume](https://github.com/Danilaa1/cuelume), copied in under its MIT licence rather than installed.

## [1.2.0] — 2026-09-04

A comment could ask for up to four versions since 1.1.0; it can now ask for a
continuous parameter instead. The agent wires one value behind an attribute,
reports its range, and the reviewer scrubs it on the page before keeping a
number.

Tailr also became installable on Cursor, Codex, Copilot and Gemini, and a
handful of overlay defects around pills and latched markup are fixed.

### New

[c1e4062] — A comment can ask for a continuous parameter instead of versions.

[c1e4062] — The agent wires it behind `data-tailr-slide-<ref>`.

[c1e4062] — `tailr slider` and `tailr_slider` report its range.

[c1e4062] — The reviewer scrubs the pill on the page before keeping a value.

[c1e4062] — Keep minimizes the pill to that value with its reference number, which reopens it.

[c1e4062] — Reset puts the parameter back to the agent's default.

[c1e4062] — Keeping the value already kept takes the keep back.

[f04b502] — `/tailr:start` is a slash-command skill, which the model will not fire on its own.

[f04b502] — Plugin catalogs for Cursor, Codex, GitHub Copilot CLI and Gemini CLI.

[f04b502] — Agents with no marketplace take the skills through `npx skills add gcrft123/tailr -g`.

[bdc041b] — On Cursor, `/start` is a command file rather than a plugin skill, which Cursor will not load.

### Changed

[c1e4062] — Mark reference numbers reset with each session, starting at 01.

[c1e4062] — Clicking a text mark's badge reopens the inline editor, with a Delete / Done bar.

[c1e4062] — Marking something that already has a mark reopens it instead of stacking a second.

[c1e4062] — A slider's row in the staged list carries Keep, Reset and the `×` that removes it.

### Fixed

[c1e4062] — Pills near the edge of the viewport flip or slide instead of rendering offscreen.

[c1e4062] — A slider pill follows its element while the page scrolls.

[c1e4062] — Keeping a value no longer rebuilds the pill, so the button under the pointer survives the click.

[c1e4062] — A sent batch disables a slider's controls rather than only greying them.

[c1e4062] — Keep reads as kept: its lit state used to be the same paper as its resting state.

[f04b502] — The Claude Code app can add Tailr from this repository.

[eb9edfc] — Typing into a field no longer loses characters to markup shortcuts.

[eb9edfc] — Escape still reaches Tailr from the application's own fields.

[eb9edfc] — Tailr's inline editor answers Escape without also dropping the mode it was edited from.

## [1.1.0] — 2026-09-02

A comment could only ever be answered once. It can now ask for up to four
versions of the same change, built at once and switched between live on the
page, so the comparison is between the real things rather than two descriptions
of them.

Versions leave guards in the source, so this release also adds the way out: End
session sits under the island's panel and runs a cleanup pass that takes the
undecided versions, and their switches, back out.

### New

[fd99842] — A comment can ask for up to four versions of the same change.

[fd99842] — The composer carries a `1×` button beside Add that cycles to `4×`.

[fd99842] — The agent builds every version at once, each guarded on an attribute Tailr sets on `<html>`.

[fd99842] — A pill on the element switches between them live, widening to each version's name on hover.

[fd99842] — Keeping a version is a mark like any other, and joins the batch.

[fd99842] — Sending it makes that version permanent and takes the losing ones, and the guards, out of the source.

[fd99842] — The `×` on its row turns the whole set down.

[fd99842] — An unresolved set keeps the island awake.

[fd99842] — `tailr variants <ref> <names…>` and `tailr_variants` report what was built.

[2237228] — End session sits under the island's panel.

[2237228] — It asks first, with a card naming each consequence on its own line.

[2237228] — Confirming hands the agent a cleanup batch that removes undecided versions from the source.

[2237228] — The switches come off the document and what Tailr kept in the browser is cleared.

[2237228] — End anyway leaves without the agent and says the cleanup did not finish.

### Fixed

[fd99842] — A session survives more than one batch.

[fd99842] — A closed run only prompts the page that watched it close, rather than every reload.

## [1.0.0] — 2026-09-02

The first release with a release flow behind it: a pushed tag runs the tests,
publishes to npm as a trusted publisher and cuts the GitHub Release from this
file. Tailr also became installable as a Claude Code plugin, which is the same
durability `tailr init` gives without editing anything in the project.

Underneath, source resolution stopped depending on a React internal that was
removed in React 19, four bridge and proxy defects are fixed, and there is now a
test suite that caught one of them.

### New

[bce61a7] — Tailr installs as a Claude Code plugin, with this repository as its marketplace.

[bce61a7] — The plugin carries the MCP server, the operating rules as a skill, and `/tailr:start`.

[bce61a7] — `npm test` fails if the plugin's rules or advertised version drift from the source.

[a01a431] — Pushing a `vX.Y.Z` tag runs the tests, publishes to npm and cuts a GitHub Release.

[a01a431] — `npm version` is the whole local interface to it.

[97790dd] — Publishing authenticates as a trusted publisher over OIDC, so no npm token is stored.

[5ff0fbd] — A test suite, `npm test`, with no dependencies, covering the bridge, proxy, `wait` and `init`.

[5ff0fbd] — CI runs it on Node 18, 20 and 22, and fails if Tailr takes on a runtime dependency.

[99fb2a0] — Source resolution reads the markers Vue, react-dev-inspector, Astro and Svelte emit.

[99fb2a0] — Windows paths and trailing column numbers are handled.

[cd384d5] — `npm run demo` starts the app it proxies.

### Changed

[6bbaadc] — PRODUCT.md no longer describes the project as having no implementation.

[6bbaadc] — The overlay surface doc describes the Island that shipped, not the withdrawn Callout direction.

### Fixed

[5ff0fbd] — An `https://` target no longer crashes the session process on the first page request.

[5ff0fbd] — Rewritten HTML no longer carries both chunked encoding and a computed `content-length`.

[5ff0fbd] — `tailr status` no longer reports the agent's own leased run back as a waiting batch.

[5ff0fbd] — Closing a closed run returns `409 No open run.` instead of `500 Server error.`

[5ff0fbd] — A synchronous failure inside the proxy costs one page rather than the session.

## [0.3.0] — 2026-08-31

A pasted setup prompt is read once and then falls out of context, which is fine
for installing Tailr and wrong for the protocol the agent has to hold all
session. Setup now ends by writing those rules into the project.

This release also gives the agent a way to learn a batch has arrived without
polling and without the reviewer announcing it.

### New

[9b644e7] — `tailr init` installs Tailr and registers its MCP server in `.mcp.json`.

[9b644e7] — It writes the operating rules into `AGENTS.md` / `CLAUDE.md` between markers.

[9b644e7] — Re-running it rewrites its own block and leaves everything around it alone.

[9b644e7] — `PROMPT.md`, addressed to the agent, replaces `SETUP-PROMPT.md`.

[0b6ad7c] — `tailr wait` and `tailr_wait` return within a moment of Send being pressed.

[0b6ad7c] — They exit `0` a batch is waiting, `3` timed out, `2` the session ended.

[0b6ad7c] — `tailr pull --wait`, and `wait: true` on the `tailr_pull` MCP tool.

### Changed

[d164b04] — The MCP server reports its version from the package manifest.

### Fixed

[0b6ad7c] — Double-click to edit did nothing on elements with no children.

## [0.2.0] — 2026-08-30

Two Tailr sessions in one project fought over `.tailr/session.json`.

### Fixed

[b400430] — A second `tailr` that failed to bind the port no longer deregisters the session that is serving.

[b400430] — A session file is only ever cleared by the process that wrote it.

## [0.1.0] — 2026-08-30

First published release.

### New

[aa87b0b] — Tailr's first published version: the proxy, the overlay, the bridge and the CLI.
