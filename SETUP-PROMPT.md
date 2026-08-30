# The prompt

Paste this to your coding agent. It installs Tailr, starts a session against your
dev server, and — importantly — tells the agent how to behave once markup starts
arriving.

---

```
Install and set up Tailr so I can mark up my dev server visually and hand you the
changes as a batch.

1. Install it:  npm install --save-dev @gcrft123/tailr
2. Register the MCP server:  claude mcp add tailr -- npx @gcrft123/tailr mcp
   (If that command isn't available, add it to the MCP config by hand:
    {"mcpServers": {"tailr": {"command": "npx", "args": ["@gcrft123/tailr", "mcp"]}}})
3. Start my dev server if it isn't running, then start Tailr pointed at it:
      npx tailr --target http://localhost:<my dev server port>
   Leave it running and tell me the review URL it prints. I review there, not on
   the original port.

Then call tailr_wait. It returns the moment I press Send, so I never have to
tell you a batch is ready — call it again after you close each run.

How to handle a batch:
- tailr_pull leases it. Every mark has a ref ("01"), a type, the route it was made
  on, a best-effort source address, a CSS selector and my comment.
  - comment — change that element as described
  - remove  — delete that element
  - text    — the mark carries before/after; change the text to `after`
  - point   — carries page x/y instead of an element. I marked a place, not a
              thing: I may be asking for something new there or noting the spot.
              My comment says which.
  - Any mark with orphaned:true lost its element before I sent it. Don't guess —
    raise it with me.
- Call tailr_progress with each ref as you land it, not all at once at the end.
  I watch each mark clear on my screen; batching them makes it look stalled.
- Always close the run: tailr_done, or tailr_fail with what actually went wrong.
  Until you do, I can't send another batch.
- Prefer the source address over the selector when they disagree, and tell me if
  a mark is ambiguous rather than picking an interpretation.
```

---

## If you don't use MCP

Drop step 2 and swap the tool names for the CLI, which does the same thing:

```
tailr status          # is a batch waiting? exit 0 yes, 3 no
tailr wait            # block until one is — run it in the background and its
                      # exit is the notification. 0 waiting, 3 timed out, 2 ended
tailr pull            # lease it, printed as JSON
tailr progress <ref>  # one mark applied
tailr done            # finished
tailr fail "reason"   # returned incomplete
```
