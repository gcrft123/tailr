---
version: 1
slug: "site"
primary_target: "site"
related_targets: []
---

# Surface: the landing page

**Scope.** `site/`: one static page, built by `site/build.mjs` into `site/dist` and served as Cloudflare Workers static assets. Not the overlay, not the README. The page does not run the overlay on itself; that was built and then removed at the user's request.

**Visitor mode: Persuade.** A designer or PM who has heard of Tailr, or an engineer deciding whether to install it for their PM, arriving from the README or npm. They must understand the loop in one viewport, believe it, and leave with the prompt.

**Primary action.** Copy the README's agent prompt. One pill carries it, under the headline. The page asks once. If the browser blocks the clipboard, the prompt appears under the pill for the visitor to select by hand.

**Removed on request, do not reinstate:** the live overlay on the page, the hero background effect, and the bottom handoff section.

**The proof only Tailr has.** The showcases are not illustrations: each is a fragment of the Northwind demo wearing the Island chrome at its exact values, performing the gesture, and the handoff shows the batch those five marks produce in the shape an agent pulls it.

## Direction (chosen from four rendered comps; the giant-wordmark hero was rejected three times)

A white page. The wordmark small in the masthead, set at the source SVG's own metrics; a statement headline ("Mark up the running app. Hand your agent the batch."), the README's one-line description, an ink pill; then the wide intro video as a rounded window on its own lemon ground with a soft shadow. The six showcases follow, and an ink footer bar closes the page. Then six alternating showcases, each a paragraph beside a staged replay: a fragment of the Northwind demo wearing the Island chrome at its real values, performing its gesture once when scrolled into view (a pointer, the mark landing, the composer typing), then holding. Then an ink handoff: the batch JSON on the left, the prompt and copy pill on the right, the init and plugin commands in plain text, a one-line footer.

**Signature moment.** The mark landing in each showcase, at the overlay's own 180ms scale-and-settle, on a piece of a real app.

## Anti-goals

No eyebrows, no card grids, no icon tiles, no framework logo rows, no invented users, numbers or testimonials. Framework claims stay exactly where the README puts them. The video is a window on its own yellow ground, never feathered into the page and never re-rendered to match it. No background effect behind the hero, and the wordmark is never blown up into a poster.

## States

Video loading and paused (reduced motion shows the poster and a play button); reduced motion and no JS hold each replay's end state with no pointer; copy success and clipboard failure; narrow widths stack text over stage and scale the staged island.

## Unresolved

- A custom domain for the Worker.
- Whether the README should link the page once it is live.
