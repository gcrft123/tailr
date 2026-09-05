---
version: 1
slug: "site"
primary_target: "site"
related_targets: []
---

# Surface: the landing page

**Scope.** `site/`: one static page, built by `site/build.mjs` into `site/dist` and served as Cloudflare Workers static assets. Not the overlay, not the README. The page does not run the overlay on itself; that was built and then removed at the user's request.

**Visitor mode: Persuade.** A designer or PM who has heard of Tailr, or an engineer deciding whether to install it for their PM, arriving from the README or npm. They must understand the loop in one viewport, believe it, and leave with the prompt.

**Primary action.** Copy the README's agent prompt. One ink pill carries it, under the headline, and the run of showcases never asks again. It is answered once at the foot of the page by the agent fan, which offers something different rather than the same thing twice: the hero hands over the prompt an agent follows, each disc hands over the setup line for one named host. If the browser blocks the clipboard, the text appears on the page for the visitor to select by hand — under the pill for the prompt, under the fan for a host's line.

**Removed on request, do not reinstate:** the live overlay on the page, the hero background effect, and the bottom handoff section.

**The fan is bound to the README.** A disc exists only for a host the README documents a route for, and it copies that route verbatim. Claude Code takes the git URL, never the `owner/repo` shorthand, which hangs on an SSH host-key prompt. Cursor has no CLI for this, so its disc hands over the marketplace URL and says so. Hosts that read a global skills directory get `npx skills add`. A brand with no documented route does not get a disc, however good the logo looks in the arc.

**The proof only Tailr has.** The showcases are not illustrations: each is a fragment of the Northwind demo wearing the Island chrome at its exact values, performing the gesture, and the handoff shows the batch those five marks produce in the shape an agent pulls it.

## Direction (chosen from four rendered comps; the giant-wordmark hero was rejected three times)

A white page. The wordmark small in the masthead, set at the source SVG's own metrics; a statement headline ("Mark up the running app. Hand your agent the batch."), the README's one-line description, an ink pill; then the wide intro video as a rounded window on its own lemon ground with a soft shadow. The six showcases follow, and an ink footer bar closes the page. Then six alternating showcases, each a paragraph beside a staged replay: a fragment of the Northwind demo wearing the Island chrome at its real values, performing its gesture once when scrolled into view (a pointer, the mark landing, the composer typing), then holding. Then an ink handoff: the batch JSON on the left, the prompt and copy pill on the right, the init and plugin commands in plain text, a one-line footer.

**Signature moment.** The mark landing in each showcase, at the overlay's own 180ms scale-and-settle, on a piece of a real app.

## Anti-goals

No eyebrows, no card grids, no icon tiles, no invented users, numbers or testimonials. Framework claims stay exactly where the README puts them, and so do host claims: the agent fan is the one place brand marks appear, it is not a logo row standing in for evidence, and it may never grow a disc the README cannot back. The video is a window on its own yellow ground, never feathered into the page and never re-rendered to match it. No background effect behind the hero, and the wordmark is never blown up into a poster.

## States

Video loading and paused (reduced motion shows the poster and a play button); reduced motion and no JS hold each replay's end state with no pointer; copy success and clipboard failure, both announced in the page's one live region; narrow widths stack text over stage, scale the staged island, drop the fixture columns that carry no mark, and move the replay control onto its own line. The page body never scrolls sideways: verified at 320, 360, 375, 390, 412 and 430. Without hover, a disc's first press reveals its label and the second copies.

## Unresolved

- A custom domain for the Worker.
- Whether the README should link the page once it is live.
