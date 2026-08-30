## The prompt

Paste this prompt to your coding agent. It installs Tailr, starts a session against your dev server, and tells the agent how to behave once markup starts arriving.

``` 
Set up Tailr so I can mark up my running dev server visually and hand you the
changes as one batch.

SETUP
1. Install:  npm install --save-dev @gcrft123/tailr
2. Make sure my dev server is running, and note its port.
3. Start Tailr pointed at it, as a long-running background process — it must
   stay up, so don't block your turn waiting on it:
      npx tailr --target http://localhost:<dev server port>
4. Tell me the review URL it prints (usually http://localhost:4100). I review
   there, not on the original port. Tailr proxies my app and injects its overlay;
   my source is not modified.

Then tell me the URL and start watching for my batch, in the same message:

  npx tailr wait

Run it as a long-running background process. It prints nothing until I press
Send, then exits — that exit is how you find out a batch has arrived, so I never
have to tell you. Exit 0 a batch is waiting · 3 it timed out, start it again ·
2 the session ended. Start it again after each run you close.

HANDLING A BATCH
`npx tailr status` answers the same question at any moment: exit code 0 a batch
is waiting · 3 a session is running but nothing is waiting · 2 no session is
running, so ask me to start one. Then:

  npx tailr pull            lease the batch, printed as JSON
  npx tailr progress <ref>  report one mark as applied
  npx tailr done            the run finished
  npx tailr fail "reason"   it returned incomplete

Each mark in the batch has a ref ("01"), a type, the route it was made on, a
best-effort source address, a CSS selector, the element's text, and my comment.

  comment  change that element as I describe
  remove   delete that element
  text     carries before/after — change the text to `after`
  point    carries page x/y instead of an element. I marked a place, not a
           thing: I may want something new there, or may just be noting the
           spot. My comment says which.

A mark with "orphaned": true lost its element before I sent it. Don't guess at
what I meant — tell me about it.

RULES THAT MATTER
- Report each mark with `progress` as you land it, not all at once at the end.
  I watch them clear on my screen; batching makes it look like nothing is
  happening.
- Always close the run with `done` or `fail`. Until you do, I cannot send
  another batch. If you hit something you can't do, `fail` with what actually
  went wrong — Tailr won't invent an explanation, it points me back to you.
- When the source address and the selector disagree, trust the source address.
- If a mark is ambiguous, ask me rather than picking an interpretation.
- Run these commands from my project directory; that's how Tailr finds the
  session.
```

## Optional: register it as an MCP server

If your agent supports MCP, this replaces the `npx tailr …` calls with tools it
can call directly. Everything else in the prompt is unchanged.

Most clients take a config block like this:

```json
{
  "mcpServers": {
    "tailr": { "command": "npx", "args": ["@gcrft123/tailr", "mcp"] }
  }
}
```

Some ship a command that writes it for you. For example:
`claude mcp add tailr -- npx @gcrft123/tailr mcp`.

The tools map one-to-one onto the CLI, so the prompt above still applies:

| Tool | CLI |
|---|---|
| `tailr_status` | `npx tailr status` |
| `tailr_wait` | `npx tailr wait` |
| `tailr_pull` | `npx tailr pull` |
| `tailr_progress` | `npx tailr progress <ref>` |
| `tailr_done` | `npx tailr done` |
| `tailr_fail` | `npx tailr fail "reason"` |
