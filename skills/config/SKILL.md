---
name: config
description: "Read or change the reviewer's Tailr settings — the key they hold to mark, and whether Tailr makes a sound. Invoke with /tailr:config (Cursor: /config)."
disable-model-invocation: true
argument-hint: "[name:value ..., e.g. sfx:false modifier:cmd]"
license: MIT
---

# Tailr settings

The user invoked this with: $ARGUMENTS

Carry this out now. Do not summarize it back or ask whether to proceed.

Settings belong to the person, not to the project. They are kept in their home
directory (`~/.tailr/config.json`) and hold across every project and every
session, so nothing here touches the repository you are working in.

## What there is

| Setting    | Values             | Default | What it does                                                          |
| ---------- | ------------------ | ------- | --------------------------------------------------------------------- |
| `sfx`      | `true` / `false`   | `true`  | A short sound on each action — a mark made or dropped, a batch sent, a run closing. |
| `modifier` | `alt` `ctrl` `cmd` | `alt`   | The key held to arm marking. `cmd` is ⌘ on a Mac, the Windows key elsewhere. |

## Do it

**With no arguments**, report where the settings stand. Read them — do not
recall them from earlier in the conversation and do not guess.

**With arguments**, apply them. `$ARGUMENTS` is `name:value` pairs, e.g.
`sfx:false modifier:cmd`.

Either way, use the `tailr_config` MCP tool, or run:

    npx -y @gcrft123/tailr config [name:value ...]

Both work whether or not a session is running. When one is, the change is
pushed to the open review page and takes effect there without a reload.

If a value is rejected, say what was rejected and what it accepts. Do not
substitute a nearby value you think they meant, and do not change a setting
they did not name.

## Then say what changed

One line. Name the setting, the new value, and — if a session is running and
the modifier changed — that the key they hold to mark is now the new one,
starting immediately on the page in front of them.
