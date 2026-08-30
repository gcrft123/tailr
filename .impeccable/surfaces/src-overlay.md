---
version: 1
slug: "src-overlay"
primary_target: "src/overlay"
related_targets: []
---

# Surface: the markup overlay

**Scope.** The overlay Tailr injects into a host application: hover inspector, mark gestures, the rail, the review sheet, the horizon, and the send → in-flight → reload cycle. Not the CLI, not the bridge protocol, not a landing page.

**Visitor mode: Operate.** A designer or PM mid-review on a dev server they did not start and cannot rebuild. They are accumulating corrections, not authoring. Their fear is that what they noticed gets lost or misread. The secondary reader is the agent, which never sees this interface — only the batch. Every decision is judged twice: does it help the person notice and mark, and does it make the batch unambiguous.

**Primary task.** Mark up one or more routes, send one batch, see the result. Success is that the user never wonders what they staged, where it is, or whether it survived.

**The proof only Tailr has.** The resolved source address, on hover, on the running page. That is where a comment layer becomes a code-change instrument.

## Direction: Island (user-pinned)

Pinned by the user against a Wispr Flow reference recording, which beats the roll. The earlier Callout direction is withdrawn; DESIGN.md carries the replacement world.

**One small dark object at the bottom-right corner of someone else's app, which changes shape to match its state.** Not a bar, not a panel system. A single continuous thing, tiny at rest, growing only as far as the current state requires.

- **Agent pill (left)** — present only while the agent is working or has something to report. Loader while running, icon at rest, expanding on hover. Its icon sits bottom-right, the one point in a bottom-right-anchored island that does not move as it grows; the action sits far left with its bottom edge on the icon's.
- **Batch pill (right)** — count plus the action, whose label is the state: Send, Send batch, Sent, or Needs refresh. Hover expands it upward into the staged list; the action stays in place.
- **On the page**, a marked element gets a halo-paired outline and a **small reference badge in its corner** — enough to name it in the batch list, never a balloon on a leader.
- **A comment is a textbox on the element itself**, opening from the point of click.

**Signature moment.** The morph. Shape changes animate width and height together over 320–420ms while content cross-fades a beat later. The island never appears or disappears; it grows and shrinks. This is the one place the design spends, and it is what the user pinned.

**The risk this direction must beat.** Fiddly. Two pills that expand on hover can turn into a hover-trap of nested surfaces. Expansion must be forgiving, dismissable, and never required to reach a primary action.

## Anti-goals

- Not a design tool. No dragging, resizing, colour picking. Tailr states intent; the agent writes code.
- Not a bug tracker. No assignees, threads, statuses, avatars, presence.
- Never changes the host layout. No insetting, no viewport resize, no injected padding — reviewing responsive layout at the wrong width is worse than no tool.
- Not the browser inspector. No DOM tree, no computed-style panel.
- No second bar, dock, sidebar, or persistent panel. If it cannot be the island, it does not ship.

## Ranges and states

**Ranges.** 0 marks (empty), 1–3 typical, 8–15 heavy, 40+ must not break the review sheet. 1 route typical, 3–6 for a flow review. Comments from five words to a paragraph. Targets from a 16px icon to a full-bleed hero — a balloon must never cover the element it describes, which forces dynamic leader length. Parent and child both marked must be representable.

**Host pages to survive.** Light, dark, dense dashboard, image-heavy, sticky headers, scroll containers, CSS transforms, canvas.

**States.** Inert (Alt released) · armed · location-picking (Alt+Shift) · hover · selected · multi-selected · composing a comment · staged · off-screen · on another route · review sheet open · sending · in flight · served per mark · all served · reload offered · agent failure · orphaned mark · bridge disconnected.

## Interaction and layout

- **The rail** floats at the bottom edge: mode hint and lamp left, staged count centre in tabular figures, SEND right as the only filled element on screen. It collapses to a sliver and must never permanently occlude an app's own bottom-fixed UI.
- **Hover** draws a hairline contour with the resolved source address set small at the corner.
- **Marking** plants a numbered balloon tethered by a leader, placed outside the element's bounds.
- **Point comments** place a dot and a leader with no element tether.
- **Insertion** (Alt+Shift) switches hover from element-picking to location-picking — a dot between siblings rather than a contour — and plants a caret balloon at that point.
- **Text edit** puts a caret in the text in place, with a change bar on the leader marking it revised.
- **Review sheet** opens from the count: rows keyed to the numbers visible on the page, grouped by route, each removable and re-editable, orphans grouped first.
- **Motion** is fluid but short and always state-bearing: spring-damped leader draw around 180ms, layer fade around 150ms, served balloons emptying in staggered order, horizon marks bound continuously to scroll position rather than transitioned. Physical, not lengthy.

## Constraints

Guest overlay over an unpredictable host page. No layout mutation. Red pinned for removal. Minimal at rest. Marks persist across reloads. Alt-gated entry, non-gated continuation.

Browser realities the build must handle: Alt-click default actions (link download on macOS, link save in Firefox), Alt keyup focusing the menu bar on Windows and Linux, contextmenu suppression while armed, auxclick suppression for middle-click, and middle-click being physically unreachable on an Apple trackpad — which requires a rail-armed equivalent that produces the identical mark.

## Keyboard operation

Hold Alt to peek; **double-tap Alt to latch**. The latched mode is what keyboard operation requires, and it is required rather than preferred: on macOS Alt+letter produces dead keys, so a held modifier cannot carry letter verbs.

In the latched mode every markable element in the viewport takes a callout key — the same balloon the marks use, which is why this costs almost nothing here. Type the key to select, a letter for the verb, and walk the selection to parent, child, or sibling to correct it. That correction is the real prize: hover picks the wrong node constantly, and structural walking is the accurate fix for everyone, pointer users included.

Tailr's own chrome is fully keyboard operable and labeled. Tailr never enters the host's tab order while inert. Escape exits any state without side effects. A screen-reader-equivalent visual review is explicitly out of scope and documented as such.

## First run

The aha is not learning five gestures — it is watching something you pointed at actually change. Everything here is in service of getting to a first mark and a first Send, and then getting out of the way.

The reviewer arrives having been handed a URL by someone else, so the island opens itself once with a line of orientation and the gesture key. After that the key returns only where it is useful: while Alt is held and nothing has been marked yet, which is the exact moment the gestures become usable. The first mark retires it permanently. Hovering the empty pill brings it back forever after — that is the empty state and the reference in one, with no help menu to build.

Four of the five gestures were undiscoverable before this, and middle-click was not merely undiscoverable but unreachable on the Apple trackpads most of these reviewers use. The key carries a door to the same mark for them.

## Transport

No longer a stub. The overlay posts its batch to the local Tailr server and follows a server-sent event stream for run state; the server is authoritative about whether a run is open, and the overlay renders what it is told rather than keeping a private idea of the truth. `sync()` is the only door in. A second batch is refused while a run is open — that refusal is what makes the send lock real rather than advisory.

## Hardening

Failure modes that were exercised and now hold: a bridge that throws, a run that never answers (the user can always cancel and get the batch back), blocked site data (surfaced in the list rather than silently losing work), a framework re-render that replaces the marked node, single-page navigation, sixty marks, 400-character comments, and Arabic, CJK and emoji comment text inside LTR chrome.

Two rules earned the hard way. A flex item carrying user text needs `min-width: 0` or it grows the island instead of ellipsising. And a re-resolved element must prove its identity before a mark adopts it, because a positional selector matches whatever slid into that slot.

## Unresolved

- Whether the agent's applied changes are reflected back into the overlay beyond the reload prompt.
- Batch history, versioning, replay.
