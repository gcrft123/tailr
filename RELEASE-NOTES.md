# Release notes

What each Tailr release changes for the people using it, newest first. Each section is the body of the matching [GitHub Release](https://github.com/gcrft123/tailr/releases), and its heading is that release's title. Every change, including the ones you wouldn't notice, is in [CHANGELOG.md](CHANGELOG.md).

## Unreleased: Your agent tells you what it changed after every batch

When an agent finished a batch, its account of what changed tended to vanish. Under MCP it went straight back to waiting, which keeps the turn open, so the summary ended up in its reasoning or in a note between tool calls. Apps like T3 Code fold both away and show only the message a turn ends on, so all you saw was "Still waiting for your next batch."

The agent now starts listening for your next batch first, then ends its turn on a written reply: what changed for each mark, and anything it couldn't do.

### Changed

* After each batch, your agent ends its turn with a reply saying what it changed for each mark. A Codex agent woken by Send gets the same instruction.
* Agents that use Tailr's MCP server wait for the next batch in the background, so that reply stays the last message you see.

## v1.4.2: Steadier Alt-hover, typing inside dialogs, and marks that hold when you zoom

On macOS, the Alt-hover outline stuck to the first thing it lit up instead of following the pointer, and Alt-clicks in that state were easy to lose. Zooming the page pulled marks away from what they marked, because a spot remembered a place on the page rather than the element under it.

### Fixed

* The outline follows the pointer for as long as you hold Alt.
* The first Alt-click always opens a comment, and an empty comment box no longer eats the next click.
* A comment box opened over a modal dialog takes your typing.
* Spots stay on what they marked when you zoom or the layout shifts.
* On pages that use CSS `zoom`, outlines, marks and the comment box line up with the page again.
* Other: an open comment box moves with its element when you zoom.

## v1.4.1: The agent keeps listening after it finishes a batch

Agents were stopping after they finished a batch, so the next one you sent went nowhere until you told them about it. Finishing or giving up on a batch now tells the agent what comes next, and its rules make going back to waiting a rule of its own.

### Fixed

* Your agent goes back to waiting for your next batch instead of stopping after the last one.

## v1.4.0: Hidden marks no longer stop the agent, and the walkthrough shows once

When a marked element stopped rendering, like a menu that closed, Tailr flagged the mark as orphaned and told the agent to stop and ask you about it. It never needed to: the agent works in the source, where that element is right where it was. The flag also fired when nothing was wrong, after a text change or an added wrapper.

The agent now just does the work. You still see which marks are off screen, and you can edit them from the island. The walkthrough is now your setting rather than each project's, and it shows only until your first mark.

### Changed

* A mark whose element is off screen goes to the agent like any other, and reads as hidden on its row in the island.
* You can edit a hidden mark from its row. Its comment box opens in the middle of the screen, since there's no element to sit on. Text edits are the exception, because you type into the element itself.
* The walkthrough shows until your first mark and then stays off on every project. `npx -y @gcrft123/tailr config tutorial:true` brings it back.

### Fixed

* Other: version and slider chips no longer cover the source address beside them, reopening a mark updates its row in the island, the comment box draws its own scrollbar in every browser.

## v1.3.3: Send wakes Codex, and sessions outlive the agent's shell

On Codex, pressing Send now wakes the agent. Codex can't tell the model that a background process finished, so `tailr wait` exited into nothing and the session sat idle until you told the agent a batch was waiting. When Codex starts the session, Tailr finds the conversation itself and wakes it on every Send. Other agents can be woken the same way with `--notify`.

Clearing the conversation doesn't break this. The next Tailr command the agent runs points the wake at the new conversation. Tailr also refuses to wake the old one, which Codex keeps running and which would otherwise apply your batch where you can't see it.

Agents now start and stop sessions with `tailr start` and `tailr stop`, so a host that kills the agent's shell no longer takes the session with it.

### New

* Send wakes a Codex agent that started the session, with no setup.
* `--notify <command>` runs a command on every Send, to wake any agent you can reach from the command line. `%n`, `%t` and `%u` stand for the number of marks, the agent's thread and the review URL.
* `tailr start` and `tailr stop` (`tailr_start` and `tailr_stop` over MCP) run the session apart from the agent's shell.
* Other: `TAILR_NOTIFY` to set the wake command from the environment, `--no-notify` to turn waking off, a warning when a batch sits unclaimed for 45 seconds after a wake.

### Changed

* The Claude Code plugin updates when Tailr releases, rather than with every change to the main branch.
* Other: the README covers sliders and lists every MCP tool.

### Fixed

* Tailr won't wake a Codex conversation you've cleared.
* When your dev server stops answering, the page Tailr shows says the session is still up and your marks are safe, and it reloads by itself once the dev server is back.
* Other: the end-of-session cards say "sliders" when sliders are what's being cleaned up.

## v1.3.2: Try Tailr with tailr demo, and the overlay on compressed pages

Most of this came from the first install report from outside the project. One part was a real defect: a dev server that compresses its HTML whether or not it's asked to had its pages passed through untouched, so holding the key did nothing and nothing said why. Tailr now unpacks those pages and adds the overlay.

The rest is Tailr addressing the right person, plus a way to try it without a project.

### New

* `npx -y @gcrft123/tailr demo` runs the whole loop against a sample app, with nothing installed in a project.

### Changed

* Skills installed without a marketplace are now `tailr-start`, `tailr-review` and `tailr-config`, so they no longer land on commands your agent already has. The commands are `/tailr-start` and `/tailr-config`. Marketplace installs still use `/tailr:start`.
* The line Tailr prints at startup names the key you actually set, and no longer mixes the reviewer's instructions with the agent's next command.
* `tailr init` ends by telling you what to do next.
* Other: the README lists what `init` edits, what Tailr needs from a dev server, and the command names Antigravity really uses.

### Fixed

* Dev servers that always compress their HTML get the overlay. Tailr handles gzip, deflate and brotli.

## v1.3.1: Setup fixes across Claude, Codex, Copilot, Cursor and Antigravity

Fixes from installing 1.3.0 every documented way, through the Claude, Codex, Copilot, Cursor and Antigravity CLIs, and running a review through each.

### Changed

* The README and website cover Antigravity CLI in place of Gemini CLI, which now turns individual accounts away.
* On a project with no agent instruction file yet, setup puts the rules where your agent will read them. They used to land in `AGENTS.md`, which Claude Code doesn't read.

### Fixed

* `--target localhost:5173`, `--target 127.0.0.1:3000` and `--target 5173` all work. The first two answered 502 and the last crashed.
* Starting a second Tailr in a project that already has a session points you at the running one instead of breaking it.
* The MCP `tailr_wait` finishes inside Cursor's time limit.
* Other: a one-line error for a `--target` that can't be a URL, `tailr init` registers the MCP server so `npx` never stops to ask, reporting progress on a mark that isn't in the batch names the ones that are.

## v1.3.0: Interaction sounds, and settings for sound and the marking key

Tailr plays a short sound for each action now: a mark made or dropped, a batch sent, a version picked, a run closing. There are nine, each with its own shape rather than one click at different volumes. They're synthesized in the browser by [Cuelume](https://github.com/Danilaa1/cuelume), so no audio files ship.

Sound needs an off switch, and Alt was never going to suit every app or OS, so both are settings. They belong to you rather than the project, live in `~/.tailr/config.json`, and apply across every project.

### New

* Nine interaction sounds, on by default. `sfx:false` turns them off.
* Pick the key you hold to mark: Alt (the default), Ctrl or Cmd. Every hint on the page names the key you picked.
* Change settings by asking your agent with `/tailr:config` (`/config` on Cursor), or run `npx -y @gcrft123/tailr config sfx:false modifier:cmd` yourself.
* A setting changed mid-session reaches the open review page without a reload.

## v1.2.0: Sliders, and plugins for Cursor, Codex, Copilot and Gemini

A comment can now ask for a slider instead of versions. The agent wires one adjustable value into the element, such as a glow, a depth or a scale, and you drag it on the page until it looks right, then keep that number.

Tailr also installs as a plugin on Cursor, Codex, GitHub Copilot CLI and Gemini CLI, and on other agents through `npx skills add`.

### New

* Ask for a slider from the comment box. After the reload, drag the pill on the element and the page follows.
* Keep holds the slider at your value, and your next Send bakes it in. Reset goes back to the agent's starting value.
* Plugins for Cursor, Codex, GitHub Copilot CLI and Gemini CLI.
* Agents without a plugin marketplace can install Tailr's skills with `npx skills add gcrft123/tailr -g`.

### Changed

* Marking something that already has a mark reopens it instead of adding a second one.
* Clicking a text edit's badge reopens the editor, with Delete and Done.
* Other: mark numbers restart at 01 each session, a slider's row in the island has Keep, Reset and ×.

### Fixed

* Typing into a text field while markup is latched on no longer loses letters to Tailr's shortcuts.
* Pills near the edge of the screen flip or slide into view instead of rendering off screen.
* The Claude Code app can add Tailr's marketplace.
* Other: a slider's pill follows its element as you scroll, clicking Keep no longer loses the click, slider controls are disabled once a batch is sent, Keep looks different once it's on.

## v1.1.0: Up to four versions of a change, and End session

A comment can now ask for up to four versions of the same change. The agent builds them all at once and you switch between them live on the page, so you compare the real things instead of descriptions of them. Keep the one you want, and your next Send makes it permanent and takes the others out of the source.

Versions leave switches in your code until you decide, so there's now a clean way out. End session has the agent remove whatever you didn't decide on before Tailr stops.

### New

* Click `1×` beside Add in the comment box to ask for 2, 3 or 4 versions.
* After the reload, a pill on the element has a tab per version. Hover a tab to switch the page to it, and click it to keep that version.
* End session, at the bottom of the island's panel, asks first and spells out what ending does. If the agent doesn't answer, End anyway leaves without the cleanup and says so.

### Fixed

* A session keeps working past its first batch. Reloading used to bring the finished run back and leave Send locked.

## v1.0.0: Claude Code plugin, and source addresses for Vue, Astro and Svelte

Tailr installs as a Claude Code plugin now, which gives your agent the MCP server and Tailr's operating rules without adding anything to your project. `tailr init` is still there if you'd rather Tailr live in the project's own setup.

Marks also find their source file in many more projects. Tailr used to read only React's development internals, which React 19 removed, so on a current React app most marks reached the agent without a file. It now reads what Astro, Svelte and the Vue and React inspector plugins already put on the page.

It's also the first version published as a GitHub Release.

### New

* Install Tailr as a Claude Code plugin, with this repository as its marketplace. It brings the MCP server, the operating rules and `/tailr:start`.
* Marks carry a file and line on Astro and Svelte projects, and on Vue or React projects that use vite-plugin-vue-inspector or react-dev-inspector. Windows paths included.

### Fixed

* An `https://` dev server works instead of crashing the session on the first page load. Self-signed certificates are fine.
* Your agent is no longer told that the batch it's already working on is a new one waiting.
* Other: rewritten pages no longer send conflicting length headers, a failure inside the proxy costs one page instead of the whole session, closing a run twice answers "No open run" instead of a server error.
