---
name: Tailr — Island
description: One small dark object at the corner of someone else's app that changes shape to match its state.
colors:
  ink: "#0B0B0C"
  ink-raised: "#1A1B1E"
  paper: "#F2EDE1"
  text: "#FFFFFF"
  text-muted: "rgba(255, 255, 255, 0.56)"
  live: "#2FD4A8"
  redline: "#E8483C"
  working: "#F0A93B"
  halo: "rgba(255, 255, 255, 0.92)"
  halo-soft: "rgba(255, 255, 255, 0.65)"
  fill-1: "rgba(255, 255, 255, 0.06)"
  fill-2: "rgba(255, 255, 255, 0.12)"
  fill-3: "rgba(255, 255, 255, 0.18)"
  hairline: "rgba(255, 255, 255, 0.10)"
  shadow: "rgba(0, 0, 0, 0.30)"
  shadow-near: "rgba(0, 0, 0, 0.34)"
  served: "rgba(11, 11, 12, 0.30)"
  on-live: "#04231B"
typography:
  display:
    fontFamily: "ui-sans-serif, -apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  label:
    fontFamily: "ui-sans-serif, -apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  strong:
    fontFamily: "ui-sans-serif, -apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  body:
    fontFamily: "ui-sans-serif, -apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  meta:
    fontFamily: "ui-sans-serif, -apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.005em"
  count:
    fontFamily: "ui-sans-serif, -apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
    fontFeature: "'tnum' 1"
  badge:
    fontFamily: "ui-sans-serif, -apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
    fontFeature: "'tnum' 1"
  address:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "10.5px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.01em"
rounded:
  ring: "3px"
  badge: "5px"
  row: "9px"
  field: "12px"
  panel: "16px"
  island: "19px"
  pill: "999px"
  dot: "50%"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  edge: "20px"
components:
  pill:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "38px"
    padding: "0 14px"
  pill-send:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.strong}"
    rounded: "{rounded.pill}"
    height: "38px"
    padding: "0 16px"
  panel:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "6px"
  action-primary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.strong}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  action-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  composer:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
    width: "268px"
  badge:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.text}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    size: "17px"
---

# Tailr — Island

## Overview

**One small dark object at the corner of someone else's app, which changes shape to match its state.**

Not a toolbar, not a panel system, not a set of windows that open and close. A single continuous thing that is tiny when there is nothing to say and grows only as far as the current state requires. Everything Tailr needs to tell you happens by that object changing shape.

Three rules:

1. **One object, many shapes.** States are transitions of the same element, never new elements appearing. If something new must be shown, the island morphs to contain it.
2. **Resting size is the design.** Idle is nearly nothing. Every pixel it occupies at rest must be earned.
3. **The page is never touched.** No dimming, tinting, insetting, padding, resizing, or restyling of the host application.

## Colors

`ink` is the object. Near-black, opaque, never translucent or blurred — glass reads as another app's chrome and dissolves over unpredictable content.

`paper` is the committed action. It appears only on the thing you are meant to press: Send, Reload, Undo. One paper element on screen at a time, and its presence means "this is the move."

There are two text levels on the ink, not three. A third, fainter one existed and measured 3.03:1 — below the 4.5 floor everywhere it carried text, and raising it far enough to pass would have put it within a hair of `text-muted`. A token that cannot be used legibly is not a token. Recession is carried by size and family instead: source addresses are already mono and 10.5px, and do not need to be dim as well.

`live` (teal) means Tailr is armed, with `on-live` as the only text colour that sits on it. `working` (amber) means the agent is running. `redline` means removal, and only removal.

**On-page marks must survive unknown ground.** Every outline drawn on the host page is a paired stroke: an `ink` line with a `halo` line outside it. A mark that reads on white and vanishes on a photograph is broken.

## Typography

The system UI stack, deliberately. This is floating chrome over a native-feeling desktop app, and SF Pro / Segoe is what that chrome is made of — it loads instantly, costs nothing, and cannot be blocked by a host page's CSP. A display face here would be a lapse.

Weight and tracking carry the hierarchy. Numerals in badges and counts are tabular.

`display` 19px exists for the one surface Tailr owns that is not floating chrome: the full-page notice the CLI serves when the dev server it proxies cannot be reached. Nothing inside the island may use it.

The ramp settled by the first build is narrow on purpose — 10, 10.5, 11, 11.5, 12, 12.5, 13 — because this is dense floating chrome where a wide scale reads as noise. `label` 13px carries actions and titles, `body` 12.5px carries comment text and list rows, `meta` 11px carries kinds and secondary labels, `badge` 10px and `address` 10.5px carry the reference numbers and source paths.

Source addresses are the only monospace, because file paths and line numbers need to align in the batch list.

## Layout

The island lives in a **corner of the viewport**, 20px from both edges, fixed, above everything, and outside the host's tab order while inert. It defaults to bottom-right and can be dragged to any of the four; the chosen corner persists per origin.

Everything about it mirrors to suit the corner it occupies, because the corner it is anchored to is the only part of it that holds still:

- The second pill always sits **outboard** of the batch pill — to its left on the right-hand corners, to its right on the left-hand ones — so the batch pill stays nearest the corner.
- On the top corners the action row sits above and the list grows **downward**; on the bottom corners it grows upward.
- The agent icon takes the **anchored corner itself**, and the action button the far side. Every pill packs its content against that same corner, so nothing moves while the box resizes.
- Row content aligns to the anchored edge, so the action never moves when the panel opens.

Dragging is throwable: release velocity is projected forward before the quadrant is chosen, so a flick can carry the island across the screen while a slow drag settles where it was let go.

It is up to two pills side by side, **agent on the left, batch on the right**:

- **Agent pill** — present only while the agent is working or has something to report. A loader while running, an icon at rest; expanding on hover into the message and its actions.

  Its icon sits at the **bottom-right**, and that position is forced rather than chosen: the island is anchored to the bottom-right corner, so it grows up and to the left, and the bottom-right is the only point in it that does not move. Any other seat makes the icon travel across the screen as the pill opens and closes. The action button sits at the far left of the panel, its bottom edge aligned with the icon's.
- **Batch pill** — the count and the action. With nothing staged it holds the gesture key instead of an empty list: that is the empty state, and it is also the onboarding. Hovering expands it upward into the staged list. Its label is the state: `Send` for a single mark, `Send batch` for several, `Sent` while locked, and `Needs refresh` — disabled — once the agent has finished and the page is stale.

The action never moves. The row is right-aligned inside the pill, so Send sits at the same point whether the panel is collapsed or expanded.

Everything else — comment composers, inline edits, marks — is anchored to the element it belongs to, on the page.

## Elevation & Depth

A single soft shadow, wide and low-opacity, plus a hairline inner light border so the object holds an edge against both white and black hosts. No blur, no glass, no translucency.

Marks on the page have no shadow at all. They use the halo pair instead.

## Shapes

The island carries **one radius in every state**: `island` 19px, which is exactly half its 38px resting height, so collapsed it reads as a true pill and expanded it reads as a rounded window — with no radius transition between them. A panel that changes its corner as it grows announces itself as a different object, and the island is one object.

Buttons inside it stay fully round (`pill`). The rest of the ramp descends with the size of the thing: `field` 12px, `row` 9px for list rows and inputs, `badge` 5px, and `ring` 3px for outlines drawn on the host page — small enough to trace an element honestly rather than round off its real shape.

The reference number is a **small badge in the corner of the element's selection**, not a balloon on a leader. It exists so a mark can be named in the batch list, and it must never compete with the element it labels.

## Components

- **Island** — dormant (a short capsule), armed, staged (count + Send), expanded (staged list), working, notifying.
- **Selection** — halo-paired outline, small corner badge, `redline` variant for removal. The badge is a control: clicking it reopens that mark to edit or delete. It is hidden while its own composer is open, where the number is already in the header.
- **Composer** — a text field anchored on the element being commented, 268px, opening from the point of click.
- **Inline edit** — the host's own text made editable in place with a faint underlay; no chrome around it.
- **Spot** — Alt+Shift pins a dot to the cursor that can be dropped **anywhere on screen**. It persists as a dot with its number beside it. One mark covers both asking for something new and noting a place; splitting them into two gestures only made the reviewer memorise a difference the comment already carries.
- **Action** — `paper` for the committed move, ghost for everything else.
- **Review row** — a way into its mark, not only a way to drop it: it opens that mark for editing, scrolling the element into view first. The on-page badge stays deliberately small so it never covers what it labels, which leaves it under the minimum target size; the row is its equivalent, and the only route to editing without a pointer.
- **Gesture key** — the four markup gestures as a two-column list. Shown once on a reviewer's first visit with a line of orientation, again whenever Alt is held before they have marked anything, and on demand forever after by hovering the empty pill. It retires itself the moment the first mark lands.

Every interactive part ships default, hover, focus, active, disabled. Focus is a 2px `live` ring at 2px offset.

## Motion

**Motion is the identity here, and it is the one place Tailr spends.** The island morphs; it does not appear.

- Shape changes animate width and height together on `cubic-bezier(0.32, 0.72, 0, 1)`. Duration scales with how far the shape actually travels, from 140ms for a small adjustment up to 380ms for a full open — deliberately longer than product-UI convention, because the morph is the thing being expressed.
- **Every shape change is interruptible.** A new transition cancels the one in flight and starts from the shape currently on screen, so re-hovering half-way through a close reopens from where it is rather than snapping to the closed size first. Two animations must never run on the same pill at once; that is what makes rapid hovering flicker.
- Content inside a morphing container cross-fades at 120–140ms with a 4px vertical offset, and always starts after the shape has begun moving.
- Marks land on the page with a fast scale-and-settle, 180ms. They never fade in.
- A running indicator is **never re-created by a re-render**. Rewriting the node restarts its animation, and a spinner that restarts every time a result lands reads as stalling rather than working. Update the state around it; leave the node alone.
- Settling into a corner is a single 460ms `cubic-bezier(0.22, 1, 0.36, 1)` — a longer, softer curve than the morph, because it is travel across the screen rather than a change of shape.
- The armed state fades in and out at 120ms, because it must feel instantaneous.
- Everything respects `prefers-reduced-motion`: shape changes become instant, content still cross-fades.

## Do's and Don'ts

**Do**

- Make idle nearly invisible, then let hover do the work.
- Animate the container and its content as one gesture.
- Keep exactly one `paper` element on screen.
- Let the list scroll without a scrollbar; the chrome is small enough that a system scrollbar reads as a seam.
- Draw every on-page mark as a halo pair; test on white, on black, and on a photograph.

**Don't**

- Never dim, tint, inset, pad, resize, or restyle the host page.
- No translucency, no backdrop blur, no glass.
- No leader lines, no callout balloons, no technical-drawing apparatus. The reference number is a small corner badge and nothing more.
- No second bar, dock, sidebar, or persistent panel. If it can't be the island, it doesn't ship.
- No color that doesn't encode state.
