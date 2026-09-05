---
target: the landing page
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "file:/home/user/tailr/site/index.html"
target_fingerprint: "sha256:f4549b683956572072d3fbdc643ca8a37ca6486ee0879a91937a4cafca05d610"
target_path: /home/user/tailr/site/index.html
timestamp: 2026-09-05T20-02-42Z
slug: site-index-html
closed: true
---
Method: dual-agent (A: design review with visual inspection · B: detector + measured browser evidence). Both ran isolated; A finished before detector output entered synthesis.

# Critique: the Tailr landing page (`site/index.html`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Copy pill state work is excellent (icon morph, label swap, in-place fallback). No `aria-live` announces copy success/failure; `aria-expanded` on the fan stays `false` through hover- and focus-open. |
| 2 | Match System / Real World | 2 | The Alt key, the product's entire gate, is never named in words. JS swaps ⌥ for ⎇ off macOS, unreadable on Windows/Linux. Showcase 1 says "highlight DOMs" to an audience defined as people who don't write code. Removal is called three things: "Cross it out," "delete," "Remove." |
| 3 | User Control and Freedom | 1 | The 2.3MB hero video autoplays, loops forever, cannot be paused in any state. `controls` false, play button `display:none` unless `.paused`, clicking does nothing (verified), and with JS off the reduced-motion branch never runs. WCAG 2.2.2. |
| 4 | Consistency and Standards | 2 | DESIGN.md:357 commits to one action, never asked twice, with the per-showcase replay as the only other control. Measured tab order contains 14 copy actions. Inline `.altk` spans sit a line above styled `kbd` chips of the same key. Hero video gets a window treatment; the six stages get none. |
| 5 | Error Prevention | 1 | The Claude Code disc copies `/plugin marketplace add gcrft123/tailr`, the shorthand the README warns in bold "hangs and then fails." The Copilot disc copies a VS Code command. The Cursor disc copies a path documented nowhere. |
| 6 | Recognition Rather Than Recall | 1 | Thirteen icon-only controls, no labels until hover. "Play again" only exists after a stage finishes. Every row of the batch list, the page's central proof, truncates to an ellipsis. |
| 7 | Flexibility and Efficiency | 2 | Scored, not n/a: the page ships a real power-user accelerator (per-host install commands). It is the worst-built thing on the page. |
| 8 | Aesthetic and Minimalist Design | 2 | Hero and showcase run are clean. Then 250px of reserved dead space, five illegible 20px logos on the primary CTA, and a closing frame showing the Island at maximum extent, covering the app it is meant to sit beside. |
| 9 | Error Recovery | 2 | The blocked-clipboard path is genuinely designed. But the pill label reverts after 2400ms leaving an unexplained gray block under a button reading "Copy," and the 13 fan discs have no recovery at all. |
| 10 | Help and Documentation | 2 | Scored, not n/a: the page does real instructional work. Not task-focused. No requirements beyond "Node 18 or newer" in the footer strip, no statement of what the prompt does, one undifferentiated "GitHub" link as the only route to docs. |
| **Total** | | **18/40** | **Poor (12–19)** |

No rows scored n/a. Heuristics 7 and 10 are permitted n/a on a Persuade surface; both were considered and scored, because this page ships an expert accelerator and performs documentation, so marking them out of scope would bury two real failures behind a rubric allowance.

The 18 is not a verdict on the hero, which is 3-to-4 work. It is the arithmetic of one section and one broken breakpoint dragging a well-made page down.

## Design Specificity Verdict

**LLM assessment: authored for Tailr, roughly 85% of the way, with one bolted-on section any dev tool could ship unchanged.**

Specific parts, named: the wordmark set live at the source SVG's own metrics (:79-86), Bricolage 800, two skewed yellow dashes translated a quarter-em above the baseline, with a text-shadow added only because #FFE023 disappears on white. The lemon ground under the intro window the page refuses to match elsewhere. Six Northwind fragments quoted at the demo's own tokens so marks land on somebody else's app. Above all the Island replicas rebuilt at real values: 19px pill radius held collapsed and expanded, 17px badge overhanging by 9px, the ink+halo paired ring, `paper` only on Add/Reload/Keep and never in the page's own chrome. `morph()` (:845-860) recomputes duration from travel and clamps to DESIGN.md's 140-380ms. `.stage.scrub .vset{transition:none}` kills version-ring easing during a drag.

Generic 15%, named: `.everywhere` (:646-671) is a logo cloud, the most interchangeable device in developer marketing, and on the brief's anti-goal list verbatim. The hero stack (centered headline, one-line lede, dark pill, 16:9 window) is the default dev-tool hero. The alternating text/stage rhythm is template grammar, worsened because the stages carry no frame or ground and read as loose UI debris on white. The five overlapping agent logos in the primary pill are pixel mush at 11px glyphs in 20px discs.

**Deterministic scan: 56 findings, exit 2. Thirty-six are false positives by DESIGN.md's own written exemptions.**

Counts: undersized functional text ×22, color outside DESIGN.md ×11, cramped padding ×9, low contrast ×8, radius outside DESIGN.md ×3, nested cards ×2, font size outside DESIGN.md ×1.

All 11 color flags, all 3 radius flags, the font-size flag, and 5 of 8 contrast flags land on :183-208, the Northwind block, whose values DESIGN.md:359 names as demo fixtures outside the system. The 22 undersized-text flags are inside staged Island chrome, where DESIGN.md:351 requires the overlay's exact values. Nested-cards and cramped-padding are structural misreads of the same fixtures.

Three survive:
- #FFFFFF on #E8483C at 3.87:1 (:312, batch remove badge). Replica-must-be-exact holds, which means the shipping overlay has the same failure. Log against src/overlay.
- `.li-c` overflow is deliberate ellipsis at desktop, a real defect at 390px where those spans render 34-54px wide carrying 133-235px of text.
- #9aa1a9 on #f4f4f1 at 2.37:1 is real but a Northwind placeholder.

**Visual overlays: injection succeeded.** Mutation verified, live server on port 8400, detect.js loaded and reported 37 anti-patterns. It found two classes the CLI missed: text-overflow ×5 on span.li-c, and one layout-transition on animated width/height (the Island's real morph, correctly replicated). Both servers stopped and verified dead; git status clean.

## Overall Impression

The craft in the middle 80% is real and rare. Someone rebuilt the product's chrome at exact values on a marketing page rather than drawing a picture of it, and that is why the page is convincing. Then three things undo it: the page breaks horizontally on every phone below 455px, it ends by handing visitors two commands that do not work, and its focus ring is invisible against its own background on 23 of 26 tab stops.

Biggest opportunity: delete the agent fan. It costs 250px of reserved dead space, 13 tab stops, 13 sub-30px touch targets, the one-action rule, and a written anti-goal, to deliver two wrong commands and an unevidenced compatibility claim across five brands absent from the project's own docs.

## What's Working

**The Island replicas are the product, not a rendering of it.** Every value traces to DESIGN.md including the hard parts: interruptible morphs with duration scaled to travel, the version ring transitioning translate/width/height with the text as versions swap, easing killed during a scrub. This is the entire basis of the page's credibility.

**The blocked-clipboard state is designed, not handled.** navigator.clipboard falls back to execCommand, and on total failure the prompt appears in place, user-select:all, on page-fill, with a header saying exactly what to do. It never sends the visitor to GitHub. Verified with both APIs stubbed. Tailr's own principle ("the browser is the whole interface") applied to its marketing surface.

**The wordmark's restraint.** Refusing to blow the mark into a poster and setting it at 26px with the source's real metrics, adding a shadow only because the yellow vanishes on white, lets the headline carry the hero. The page's only decoration, and it earns the space.

## Priority Issues

### [P0] The page scrolls sideways on every phone, and the closing showcase is the frame that breaks
site/index.html:182 (.scene), :189 (.nw .row fixed widths), :307 (.list{width:340px}), :338-341 (island scale steps), :172 (.again positioning).

Threshold sweep: overflow below ~455px, worsening down. 360px +89px. 375px +74px. 393px +56px. 412px +37px. At 390px, scrollWidth 449 vs clientWidth 390. Cause: div.scene renders 429px because .nw .row's fixed 130px/80px columns floor min-content at ~405px, .stage{overflow:visible} does not clip, and the media queries scale .island but never .nw.

Result: "Send once.", the frame proving five marks become one legible batch, is worst. Entries truncated mid-word ("Roun…", "Custo…", "Warm…"), amounts cut ("$4,20…"), "Play again" printed on top of the panel, agent card overlapping rows. On a phone the central claim demonstrates its own opposite, and the body scrolls horizontally before a word is read.

Fix: give .stage an inner overflow-x:auto scroller or scale fragments with a container-relative transform instead of a fixed 340px panel; .list to min(340px, 100%); move .again out of the absolute layer at narrow widths. Re-verify scrollWidth === clientWidth at 320, 360, 375, 393, 412.

Suggested command: /impeccable adapt

### [P0] The agent fan hands visitors broken commands, claims compatibility it has no evidence for, and asks for the copy thirteen more times
:646-671 (markup), :762-768 (commands), :381 (the 250px hole it expands into).

INSTALL.claude is `/plugin marketplace add gcrft123/tailr`, the shorthand the README warns in bold "clones the shorthand over SSH and has nothing to answer the host-key prompt with, so the add hangs and then fails." The Copilot disc copies `code --add-mcp '{…}'`, a VS Code command. The Cursor disc copies a path documented nowhere. The first thing a Claude Code user does after leaving is paste a command that hangs.

The section is titled "Tailr works everywhere" over thirteen brands, of which Warp, JetBrains, v0, Replit and Zed appear nowhere in README or PRODUCT.md, on a product whose Evidence-on-Hand section says host and framework claims are the ones most likely to outrun the evidence.

It breaks two written commitments: DESIGN.md's one-action rule and the brief's "no framework logo rows" anti-goal. Both assessments found this independently; the tab-order measurement confirms 14 copy actions where the contract says one.

Fix: delete the section. If the claim must be made, one sentence of text under the hero pill phrased to the README's actual line, no logos, no second copy target.

Suggested command: /impeccable distill

### [P1] The focus ring is invisible against the page's own background on 23 of 26 tab stops, and six of those stops are invisible entirely
:69 (:focus-visible{outline:2px solid var(--live)}), :176-179 (.again{opacity:0}), :657-668 (absolutely positioned discs).

Measured: --live #2FD4A8 against white is 1.89:1; against --page-fill 1.67:1; against --lemon 1.65:1. SC 1.4.11 needs 3:1. It passes only on the ink footer (10.4:1). A system-level gap rather than an oversight: DESIGN.md specifies a 2px live focus ring for chrome that always sits on ink, and the page reused the token on a white ground where it was never tested.

.stage .again{opacity:0} until a stage plays means a keyboard user hits six focus stops that render nothing (verified: focused element reports opacity 0 with the outline applied). Tabbing forward through the fan scrolls the viewport up ~3000px (scrollY 3673 → 622 across six presses) because the discs are absolutely positioned and still animating when the browser scrolls to them.

Fix: give the page its own focus token (ink ring with a white halo, the paired-stroke logic the marks already use for unknown ground), and either make .again visible on focus or remove it from the tab order until its stage has played.

Suggested command: /impeccable audit

### [P1] Nothing on the page says what the prompt does, and every showcase implies source resolution that usually will not happen
:486-487 (pill and prompt), :509 and :631-635 (file:line chips), :501 ("Comments add the element source"), :675-683 (footer).

The primary action copies "Fetch [raw URL] and follow it exactly, without summarizing it." The page never says what happens next. The README has all of it: Tailr proxies rather than patches, a session writes nothing to your repository except .tailr/session.json, tailr init is the only thing that edits your files and only these four, hot-reload WebSockets pass through untouched. None of it made the trip. The only technical fact on the page is "Node 18 or newer" in the footer strip. The brief names this visitor explicitly, and that person is being asked to hand an autonomous agent a fetch-and-execute instruction on faith.

Truth problem: every showcase shows a real file and line, and the differentiating sentence says comments "add the element source." PRODUCT.md is explicit that resolution "resolves nothing at all for a project that emits none of those, which is the ordinary case for a project that has not opted in." Not a word of that boundary is on the page. The engineer installs, marks an element in a plain Vite React app with no inspector plugin, gets a null address, concludes the page lied.

Fix: three lines under the pill (proxies your dev server, no build step, no config / writes nothing to your repo but .tailr/session.json / Node 18+, no dependencies, MIT), text only. One sentence in showcase 1 stating where source locations come from and what a mark carries when they are absent.

Suggested command: /impeccable clarify

### [P1] Three of six resting states demonstrate nothing, and with JS off none of them do
:992-1002 (hold()), :368 (.no-js rules), :888-905.

hold() never restores .w1, so "Rewrite it in place." rests showing "Recent invoices," the unedited original, ringed. hold() also sets .vset.gone, so "Ask for options and compare them live." rests with version tabs dismissed: the section about options shows no options, in reduced motion and in the normal post-animation state. .no-js hides .ov, .composer, .cur, .vset, .sset, .again, so a JS-off visitor gets six bare Northwind fragments with zero Tailr chrome. The brief promises no-JS holds each replay's end state; the page delivers no end state at all.

Every animation is one-shot. The frame that persists is the frame most visitors study, and it is what a screenshot, a scroll-back, or a reduced-motion setting gives them.

Fix: in hold(), set .w1 to "Latest" with a before/after chip so the change reads at rest. Split showcase 5 or hold with both pills visible. For no-JS, author static end states in markup rather than shipping six pictures of an app with nothing happening to it.

Suggested command: /impeccable harden

## Persona Red Flags

**Priya, the PM with no repo access** (project-specific, PRODUCT.md's stated primary user). No terminal, deciding whether to ask for this. The page's dominant visual motif is source-code addresses (TopBar.tsx:9, MetricCard.tsx:8) on every showcase, exactly what she cannot read and does not care about. Showcase 1 tells her to "highlight DOMs." The frame that should convert her, "Send once.", resolves into a panel of truncated file paths. The single action is "Copy the prompt for your agent." She has an engineer, not an agent, and there is nothing here for her to send him. Nothing states that she can do this without opening the repo, without a terminal, and without writing a spec, which is the product's entire premise.

**Marcus, the engineer installing it for her** (project-specific). Asked to paste a fetch-and-obey instruction with no statement of what it writes. Goes looking for the install path, finds the fan, and the Claude Code command hangs. Wants to know whether it works with his stack; the page answers with thirteen agent logos, which answer a different question, and .tsx filenames quietly implying React. Framework-agnosticism, the actual differentiator, is never claimed.

**Jordan (first-timer).** The ⎇ glyph in "Hold ⎇ and hover anywhere on the page" is an unrecognizable squiggle on Windows and Linux; the words "Alt" and "Option" appear nowhere. Thirteen unlabeled logo circles read as decoration. After copying, gets "Copied. Paste it to your agent." and no answer to "what agent, and where?"

**Casey (mobile).** First thumb-swipe moves the page horizontally. The signature showcase is unreadable and self-overlapping. The fan's discs are ~30×30px, overlapping, unlabeled, copying silently on tap so the first feedback arrives after the clipboard is written. The hero video is a 219px strip of a deeply zoomed app showing a sentence sliced to "e and," and it is 2.3MB Casey cannot stop.

## Minor Observations

- 2.51MB on first load, 92% the video. preload="metadata" is overridden by autoplay, so the full 2.4MB fetch starts immediately with no IntersectionObserver gate. The reduced-motion path is the light one.
- Google Fonts is a single point of failure for the display face. No @font-face fallback, no self-hosted copy, render-blocking in head. When the request failed in test, Bricolage silently dropped to ui-sans-serif page-wide.
- og:image is relative where the spec requires absolute, and points at a mid-animation frame cropped so hard the Northwind window is cut off left and bottom with a sentence reading "e and." Every link share previews as a yellow rectangle with "37" and "642" on it. Not a CSS bug: 1920×1080 into a 16:9 box, no cropping applied.
- `<h3>Hello, Pamela</h3>` (:585) is a Northwind fixture in the real document outline between two section headings.
- Copy bug at :579: "click have it applied" is missing "to." Same class of defect as the tagline fix in 76e487a.
- "Turn on Slider Mode" (:579) is capitalized as a feature name existing nowhere else; DESIGN.md calls it the slider toggle.
- Showcase 5 carries two features and 47 words in one beat, the only place the run breaks its one-idea rhythm.
- :focus-visible puts a square outline around the round, rotated fan discs.
- The masthead wordmark is an `<a href="#top">` inside the element it links to.
- section.everywhere has no heading and no accessible name while wrapping 13 buttons.
- 31 of 42 SVGs inside buttons and links lack aria-hidden="true"; the 4 that have it make the inconsistency visible.
- The spot showcase drops its dot into empty white page space below the Northwind fragment, so "mark a place on your app" is demonstrated on a place that is not the app.
- The ink footer is 30px of padding, closer to a legal strip than the second color field DESIGN.md describes.
- Zero console errors and zero failed requests on load (the one media abort is a headless-Chromium codec artifact).

## Cognitive Load

Failed items: 4 of 8. High (critical fix needed).
- Single focus: two mutually exclusive answers to "how do I start", the hero's PROMPT.md fetch prompt (:734) and, 4000px later, SETUP plus five install commands (:769). Seven starting instructions where the brief specified one.
- Chunking: 13 discs in one undifferentiated fan; 5 batch rows plus count, Send, End session; 5 kbd chips in showcase 5.
- Minimal choices: the fan is a 13-option decision point with no hierarchy, no recommended default, no labels. 3× over the limit and the page's only >4 decision point.
- Working memory: showcase 3's resting state says "Latest invoices," meaningless unless you watched it change; showcase 6's batch list requires holding five earlier showcases in memory, and row 05 refers to a mark never staged on screen.
Passing: grouping, visual hierarchy, one thing at a time, progressive disclosure.

## Emotional Journey

Peak early and real: small wordmark, two-line Bricolage headline, one honest sentence, one black pill, the top edge of a lemon window sliding under. Second peak: the first mark landing on "New invoice" at 180ms with the composer opening under it.
Valley 1: showcase 3 rests showing nothing rewritten. Valley 2: showcase 6, the payoff of the whole argument, physically broken on mobile. Valley 3: 250px of blank page after "Send once."
End, the weakest thing here: a black strip reading "Node 18 or newer. No dependencies. GitHub npm MIT." A license link is the final word; the CTA is four thousand pixels above and never returns.
Reassurance absent: the page asks a stranger to hand their agent a fetch-and-obey prompt and never says what it will do.

## Questions to Consider

- DESIGN.md says this page carries one action and never asks twice. It carries fourteen. Which sentence changes, the page or the design system?
- The most convincing thing about Tailr is that it writes nothing to your repo and proxies rather than patches. Why is that in the README and not on the page?
- Priya cannot run a terminal and cannot open the repo, and she is the primary user. What does she copy?
- Every mark on this page shows a file and a line. What does the page look like when it cannot?
- If a visitor only ever sees the resting frame of each showcase, does the argument still hold? Right now three of six say nothing.
- What would this page look like if it ended on the action instead of on "MIT"?
