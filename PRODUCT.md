# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: designers and product managers with no repo access.** They review a running local dev server in the browser. They do not open the codebase, do not run build tooling, and do not write code. The page in front of them is their entire surface — every action Tailr offers has to be available there. Setup is not their job: the coding agent installs and invokes Tailr on their behalf.

**Secondary consumer: the coding agent.** The batch Tailr emits is read and executed by an agent, not by a person. Output must be unambiguous enough to act on without a follow-up conversation.

Engineers are not the primary audience. They are the ones who ask an agent to install Tailr, and they are affected by the changes it produces, but the tool is not designed around them.

## Product Purpose

Tailr turns visual feedback on a running app into an executable batch of changes.

Today the loop between "this button is wrong" and a code change runs through prose: someone writes a description, an engineer or agent interprets it, and precision is lost at every hop. Tailr replaces the description with the thing itself — the user marks the actual element on the actual page, and the agent receives a batch that names what was marked and what should happen to it.

Success: a person who cannot open the repository marks up a page, presses Send once, and the corresponding source changes land — without a written spec, and without an engineer translating in the middle.

## Positioning

The mechanism is the position: **element-level markup performed on the live dev server, resolved back to source, and handed off as one atomic batch through a locked round trip.**

Three parts of that are load-bearing together:

- Markup happens on the running application, not on a screenshot, mockup, or copy of it. What the user points at is the real rendered element.
- Marks are resolved toward source on a best-effort basis, so the handoff carries more than "the third card on the page."
- The handoff is a batch with a closed loop, not a stream of requests. Send is a commitment; the agent works; the user is told when to reload.

## Operating Context

- The user runs a local development server on their own machine. Tailr is invoked by the agent as a CLI that wraps or proxies that dev server and injects its overlay into the served pages. The user opens the Tailr-served URL and works there.
- A session is a loop: browse → mark up across one or more pages → Send → wait while the agent works → reload when prompted → keep going.
- Staged markup lives in browser storage and survives reloads, including the reload that follows an agent's changes.
- The user is free to keep marking the page while the agent is working. Sending is what is blocked, not marking.
- The agent picks up the batch and reports completion through a local bridge (MCP tool or CLI command) that Tailr's local server exposes.

## Capabilities and Constraints

### Confirmed interaction model

**Alt is the modifier that activates markup.** Without it the application is fully interactive and Tailr is inert; the user browses, clicks links, and fills forms normally. Holding Alt arms the element hover inspector, in the manner of a browser inspect tool.

While Alt is held:

- **Left-click** opens a comment on the element under the cursor.
- **Right-click** stages the element for removal; it is outlined red.
- **Double-click on text** enters inline text editing.
- **Shift-click** marks a spot rather than an element. Holding Alt+Shift switches the hover model from element-picking to location-picking: a dot follows the cursor and can be dropped anywhere on screen. Whether the reviewer wants something new there or is simply noting the place is carried by what they write, not by which gesture they used — they are one operation.
- **Middle-click** is an unlisted alias for the same mark, for anyone who has a middle button. It is never taught, because Shift-click already reaches every pointing device.

There is no multi-selection. Each mark addresses one element or one point.

Entering a mark state is Alt-gated; being in one is not. Once a comment composer or an inline text edit is open, the user releases Alt and types normally.

Other confirmed behavior:

- All staged changes persist in browser storage.
- **Send** hands the batch to the agent. Send is then locked: the user can continue marking up the page but cannot send again until the agent reports it has finished.
- When the agent finishes, the UI prompts a reload. The reload shows the agent's changes and preserves any markup staged in the meantime.
- When the agent reports failure, the interface does not attempt to classify or explain it. Failure can mean many things, so the interface directs the user back to their agent session and releases the send lock so they can retry.

### Confirmed delivery model

- Distributed as a package the user's agent can install; invoked as a framework-agnostic CLI that wraps or proxies an existing dev server. No per-framework configuration, no build-step integration required.
- Handoff runs over a local server with an MCP tool / CLI bridge, which is what makes the completion signal — and therefore the send lock and the reload prompt — real rather than inferred.
- Elements are described to the agent with **best-effort source resolution**: framework runtime hooks and build-time source-location attributes are used to name a file and line where they exist, with a fall back to a stable selector plus surrounding markup and context where they do not. Tailr must degrade gracefully rather than refuse to describe an element it cannot trace.

### Constraints

- Tailr renders inside applications it does not own. Its overlay must not leak styles into the host page, must not be mistakable for host UI, and must not leave residue in the host DOM.
- Right-click as a primary action requires suppressing the host page's native context menu while markup mode is active.
- The primary user has no repository access and no terminal. Any capability that requires either is out of reach for them by definition.

### Confirmed persistence model

- Staged markup is scoped **per-origin**, and each mark carries its own route. A batch is session-wide across routes, so a per-route store could not express it. A dev server on a different port is a different origin and does not inherit marks.
- A mark whose element no longer exists after a reload is **orphaned, never silently re-anchored and never discarded**. It keeps its number and its comment, loses its tether, and is surfaced with the last known address and a snippet of the element as it was. Re-anchoring risks attaching a comment to the wrong element and having the agent act on it; discarding breaks the guarantee that staged markup is never lost.
- Orphaning is a claim about the element, so it may only be made from the route the mark was made on, and only once that route has had a chance to render. A mark belonging to a page the reviewer has since navigated away from is **not** orphaned — it is unverifiable, and stays staged under its own route until they return to it. A route-shaped hash (`#/orders`) is part of that address; a plain anchor (`#pricing`) is not. Telling the agent an element was lost when the reviewer merely changed pages sends it to ask about marks that are perfectly intact.

### Confirmed exit model

**The reviewer can end the session from the page, and it is the only way out that exists for them** — they have no terminal, and the process in front of their dev server is not theirs to stop. Ending is confirmed rather than immediate, and the confirmation states each consequence rather than summarizing them.

Ending is also the only cleanup stage Tailr has, so it does all of it in one pass:

- Versions nobody chose between go to the agent as a final batch that removes them and their guards. The reviewer cannot be left with scaffolding in their source and nothing on screen that would take it out.
- The switches come off the document, and everything Tailr kept in the browser for that origin is cleared. Staged markup that was never sent is lost — the one place the "staged markup is never lost" guarantee is deliberately spent, because ending is an explicit confirmed act and the confirmation says so in as many words.
- The server stops, which takes the review URL down with it. The overlay's last card is therefore the only thing that can tell the reviewer where their application is now, and it says which: the dev server is still running at its own address, or it stopped too because Tailr had started it.
- Dismissing that card removes the overlay from the host DOM entirely.

If the agent never answers the cleanup batch, the reviewer can still leave. Tailr says the cleanup did not finish rather than implying it did.

### Confirmed variation model

A comment on an element, or on a spot, can ask for **up to four versions of the same change**, built together so the reviewer compares them on the running page rather than in prose. This is the one place where the agent's work is reflected back into the overlay beyond the reload prompt.

- The versions are built into the source at once, each guarded on a switch only Tailr sets: `data-tailr-var-<ref>` on the `<html>` element. Version 1 is also what renders when the attribute is absent, so the application is never broken for anyone not looking through Tailr.
- The agent names each version in one to three words. Those names are the entire basis on which someone who cannot read the diff decides, so they describe the version rather than enumerate it.
- **The guards are scaffolding, and they live for exactly one round trip.** Keeping a version is itself a mark: it goes into the next batch, and it is what takes the losing versions and the switch out of the source. A reviewer must never be able to reach a state where versions are staged in their repository with nothing in Tailr that would remove them — which is why an unresolved set keeps the island awake, and why turning the whole set down is an offered action rather than something achieved by ignoring it.
- Removals and inline text edits have no versions. A deletion has one outcome, and an inline edit is the reviewer writing the answer themselves.

### Explicitly undecided

- Whether batch history is retained, versioned, or replayable.
- Remote or shared sessions. Current scope is a single local user on their own dev server.
- Licensing, pricing, and any distribution beyond a package install.

## Brand Commitments

- **Name:** Tailr. No logo, wordmark, or existing identity assets exist yet.
- The user has stated one binding constraint on the interface: it should be modern, as minimalist as possible, and use fluid animations.
- Voice and tone are undecided.

## Evidence on Hand

**An implementation, and nothing beyond it.** Tailr is built and published as `@gcrft123/tailr`: the CLI, the proxy and bridge, the overlay, the MCP server, and `tailr init`. That establishes that the loop runs. It does not establish that anyone has run it.

There are still no users, no collected feedback, no benchmarks, testimonials, case studies, adoption numbers, press, or screenshots. Future work must not fabricate any of these.

Framework compatibility is the claim most likely to outrun the evidence, so it is worth stating precisely. The proxy is genuinely framework-agnostic — it injects into HTML and passes everything else through, including the hot-reload WebSocket. Source resolution is not: it reads the attributes the Vue, Astro and React inspector plugins emit, Svelte's node-level meta, a generic `data-source`, and React 18's development fibers, and it resolves nothing at all for a project that emits none of those — which is the ordinary case for a project that has not opted in. A mark still carries its selector, its text and its route when that happens. Claims must stay on the correct side of that line.

## Product Principles

1. **Pointing replaces describing.** Every feature is judged by whether it removes a sentence someone would otherwise have had to write.
2. **The browser is the whole interface.** If the primary user cannot reach it from the page, it does not exist for them.
3. **Staged markup is never lost.** Reloads, agent runs, and mistakes must not cost the user work they have already done. This is the trust the entire loop rests on.
4. **Tailr is a guest.** It is injected into applications it does not own, and must never be confused with, or interfere with, the app it sits on top of.
5. **One batch, one round trip.** The handoff is explicit and closed: the user knows what was sent, that it is being worked on, and when to look again.

## Accessibility & Inclusion

No external standard has been adopted. The following are confirmed product decisions.

**Binding.** The overlay must never degrade the host page's accessibility tree, and must not appear in the host's tab order while inert. A review tool that adds tab stops to the application under review has corrupted the thing being tested.

**In scope.** Tailr's own chrome — island, staged list, comment composer, reload prompt — is fully keyboard operable and properly labeled. Element selection is keyboard operable: a latched markup mode (double-tap Alt, as against hold-to-peek), keyed hints that give every markable element in the viewport a callout key, letter verbs for each mark type, and structural walking to move a selection to its parent, child, or sibling. Escape always exits any Tailr state without side effects.

This is treated as a precision feature rather than a concession. Pointer hover picks the wrong node constantly — the span inside the heading inside the wrapper — and structural walking is the accurate correction. The keyboard path is also why the mode is latched rather than held: on macOS, Alt+letter produces dead keys and special characters, so a held modifier cannot carry letter verbs.

**Explicitly out of scope, and to be documented as such rather than half-claimed.** A screen-reader-equivalent review workflow. Marking up visual layout is an inherently visual task. Tailr's obligation is that its own interface is accessible and that the host's accessibility is never degraded, not that a non-sighted user can perform a visual design review through it.
