/* The operating rules an agent needs *while* Tailr is running.
 *
 * Setup is one-shot and disposable; these are not. They have to be in the
 * agent's context on every turn, long after the setup prompt has scrolled
 * away — so `tailr init` writes them into the project's agent instruction
 * files, where they get re-read rather than remembered. This module is the
 * single source of truth for that text; PROMPT.md mirrors it.
 */

export const START = '<!-- tailr:start -->';
export const END = '<!-- tailr:end -->';

/** @param {{ mcp?: boolean }} opts  mcp: MCP tools are registered, so name them too. */
export function rulesBlock({ mcp = false } = {}) {
  const commands = mcp
    ? [
        '| Command | MCP tool | |',
        '|---|---|---|',
        '| `npx tailr status` | `tailr_status` | is a batch waiting? exit 0 yes · 3 session up, nothing waiting · 2 no session |',
        '| `npx tailr wait` | `tailr_wait` | block until Send is pressed; exit 0 a batch is waiting · 3 timed out, start it again · 2 session ended |',
        '| `npx tailr pull` | `tailr_pull` | lease the batch, printed as JSON |',
        '| `npx tailr variants <ref> <names…>` | `tailr_variants` | name the versions you built for one mark |',
        '| `npx tailr slider <ref> --min --max` | `tailr_slider` | report the continuous parameter you wired for a slider mark |',
        '| `npx tailr progress <ref>` | `tailr_progress` | report one mark as applied |',
        '| `npx tailr done` | `tailr_done` | the run finished |',
        '| `npx tailr fail "reason"` | `tailr_fail` | it returned incomplete |'
      ]
    : [
        '| Command | |',
        '|---|---|',
        '| `npx tailr status` | is a batch waiting? exit 0 yes · 3 session up, nothing waiting · 2 no session |',
        '| `npx tailr wait` | block until Send is pressed; exit 0 a batch is waiting · 3 timed out, start it again · 2 session ended |',
        '| `npx tailr pull` | lease the batch, printed as JSON |',
        '| `npx tailr variants <ref> <names…>` | name the versions you built for one mark |',
        '| `npx tailr slider <ref> --min --max` | report the continuous parameter you wired for a slider mark |',
        '| `npx tailr progress <ref>` | report one mark as applied |',
        '| `npx tailr done` | the run finished |',
        '| `npx tailr fail "reason"` | it returned incomplete |'
      ];

  return `${START}
## Tailr — visual markup from the reviewer

The reviewer marks up the running app in the browser and hands you the changes
as one batch. A session is up when \`.tailr/session.json\` exists; if it doesn't,
start one as a long-running background process — it must stay up, so don't block
your turn waiting on it:

    npx tailr --target http://localhost:<dev server port>

It prints a review URL (usually http://localhost:4100). Tell the reviewer to use
that URL, not the original port. Tailr proxies the app and injects its overlay;
the source is not modified.

The loop is \`wait\` → \`pull\` → \`progress\` per mark → \`done\` or \`fail\`.

${commands.join('\n')}

Each mark carries a \`ref\` ("01"), a \`type\`, the \`route\` it was made on, a
best-effort source \`address\`, a CSS \`selector\`, the element's text, and the
reviewer's \`comment\`.

- \`comment\` — change that element as described
- \`remove\` — delete that element
- \`text\` — carries \`before\`/\`after\`; change the text to \`after\`
- \`point\` — carries page \`x\`/\`y\` instead of an element. The reviewer marked a
  place, not a thing: they may want something new there, or may just be noting
  the spot. Their comment says which.
- \`choice\` — the reviewer picked between versions you built, or kept a value
  on a slider you built. See below.

### Versions

A \`comment\` or \`point\` mark can carry \`"variations": 3\`. That asks for three
different answers to the same comment, all built at once, so the reviewer can
compare them on the running page and keep one.

Build every version into the source together, each guarded on the switch Tailr
sets for that mark: the attribute \`data-tailr-var-<ref>\` on \`<html>\`, whose
value is the version number.

    /* mark 03, version 2 */
    [data-tailr-var-03="2"] .cart-total { font-size: 24px; border-radius: 14px }

Version 1 must also be what renders when the attribute is absent, so the page is
never broken for anyone who isn't looking through Tailr. Anything that has to
re-render rather than restyle reads \`document.documentElement.dataset.tailrVar03\`
and listens for the \`tailr:variant\` event on \`document\`; its \`detail\` carries
\`{ ref, variant, label }\`.

Then name them, in order, before you report that mark applied:

    npx tailr variants 03 "Softer edges" "Full width" "Two columns"

One to three concrete words each. They are the whole basis on which someone who
cannot read the diff decides, so \`"Two columns"\` earns its place and
\`"Option B"\` does not.

### Sliders

A \`comment\` or \`point\` mark can carry \`"slider": true\`. That asks you to make
the element numerically variable — glow intensity, a bevel depth, a 3d
parameter, anything the reviewer can scrub. Build one continuous parameter into
the source, guarded on the switch Tailr sets for that mark: the attribute
\`data-tailr-slide-<ref>\` on \`<html>\`, whose value is the number.

    /* mark 03, intensity driven by the slider */
    [data-tailr-slide-03] .hero { --glow: attr(data-tailr-slide-03 number) }

The default value must also be what renders when the attribute is absent.
Anything that has to re-render rather than restyle reads
\`document.documentElement.dataset.tailrSlide03\` and listens for the
\`tailr:slide\` event on \`document\`; its \`detail\` carries
\`{ ref, value, label, min, max, unit }\`.

Then report the range, before you report that mark applied:

    npx tailr slider 03 --min 0 --max 100 --value 40 --label "Glow" --unit "%"

A mark may ask for versions and a slider together; do both.

A \`choice\` mark closes either kind. For versions it carries \`variantOf\` and
\`variant\`:

- \`variant: 2\` — keep version 2 as the plain, unguarded code. Delete the other
  versions and every \`data-tailr-var-<ref>\` guard for that ref.
- \`variant: 0\` — keep none of them. Remove all the versions and the guards, and
  put the element back the way it was before you built them.

For a slider it carries \`sliderOf\` and \`value\`:

- \`value: 42\` — bake that number into the source as the plain value. Remove the
  \`data-tailr-slide-<ref>\` switch.
- \`value: null\` (or \`variant: 0\`) — discard the slider. Remove the switch and
  put the element back as it was.

### Rules that matter

- Run \`wait\` as a long-running background process and treat its exit as the
  notification. Never ask the reviewer to tell you a batch has arrived, and
  never poll for one. Start it again after each run you close.
- The reviewer can end the session from the page, which stops the server. \`wait\`
  then exits 2 and \`.tailr/session.json\` is gone. That is them finishing, not a
  crash: don't restart the session, and don't ask them to reopen the review URL.
  A last batch of \`choice\` marks usually arrives just before it — that is the
  cleanup, and it is the one batch worth closing quickly, because they are
  waiting on it to leave.
- Report each mark with \`progress\` as you land it, not all at once at the end.
  The reviewer watches them clear on screen; batching makes it look like nothing
  is happening.
- Always close the run with \`done\` or \`fail\`. Until you do, the reviewer cannot
  send another batch. If you hit something you can't do, \`fail\` with what
  actually went wrong — Tailr won't invent an explanation, it points them back
  to you.
- The guards are scaffolding, not code. They live for exactly one round trip:
  you write them when a mark asks for versions or a slider, and the \`choice\`
  mark that comes back is what takes them out. Never leave a guard standing
  after its choice has landed, and never write one for anything the reviewer
  didn't ask to see versions or a slider of.
- When the source address and the selector disagree, trust the source address.
- A mark with \`"orphaned": true\` lost its element before it was sent. Don't
  guess at what was meant — raise it with the reviewer.
- If a mark is ambiguous, ask rather than picking an interpretation.
- Run these commands from the project directory; that's how Tailr finds the
  session.
${END}`;
}
