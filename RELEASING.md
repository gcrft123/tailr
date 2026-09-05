# Releasing Tailr

**A tag is a release.** Pushing `vX.Y.Z` is the only thing that publishes: it
runs the tests at that commit, publishes to npm with provenance, and cuts the
GitHub Release from the matching section of [CHANGELOG.md](CHANGELOG.md).
Nothing else does, and nothing publishes off `main` on its own.

## Cutting one

Write what changed under `## [Unreleased]` in `CHANGELOG.md` as you go — those
lines become the release notes verbatim, so write them for whoever reads the
release, not for yourself. Then:

```bash
npm version minor
```

That runs the tests, refuses if `Unreleased` is empty, stamps it with the new
version and today's date, and commits the bump and the changelog together under
an annotated tag. Nothing has left the machine yet. When it looks right:

```bash
git push --follow-tags
```

The tag arriving on GitHub is what starts the release. `npm version patch` and
`npm version major` work the same way, as does `npm version 1.0.0-rc.1` — a
version with a hyphen in it is published as a pre-release.

The push is deliberately yours to make rather than something `npm version` does
for you: an npm version number can never be reused, so the irreversible step is
worth a second command. If you would rather it went in one move, add
`"postversion": "git push --follow-tags"` to `package.json`.

`npm version` also runs `scripts/plugin.js --sync`, which stamps every agent
marketplace catalog from `package.json` so Claude, Cursor, Codex, and the rest
advertise the same version. Gemini installs by cloning this repo; its skills
sit next to `gemini-extension.json` at the root so that clone sees them.

To list Tailr on Cursor's public marketplace, submit
`https://github.com/gcrft123/tailr` at
[cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).

## What the tag has to satisfy

The workflow refuses to release a tag that fails any of these, before it
publishes anything:

- **The tag matches the manifest.** `v0.4.0` must point at source whose
  `package.json` says `0.4.0`. `npm version` makes this true by construction;
  a hand-made tag is where it goes wrong.
- **The tag is on `main`.** A release you cannot reach from the default branch
  is a release nobody can get back to.
- **The changelog has notes for it.** A release with an empty body is one
  nobody can read.
- **The tests pass at the tagged commit** — not on main, at the tag.

Re-running a tag's workflow is safe. npm publishing is skipped if that version
is already there, and the GitHub Release is edited rather than duplicated.

## No secrets

npm publishing uses **trusted publishing**: this repository is registered as a
trusted publisher on npm, and the release workflow authenticates with the OIDC
token GitHub mints for it. There is no `NPM_TOKEN`, nothing to rotate, and
nothing that can be leaked out of a workflow log.

Three things make that work, and all three are already in `release.yml`:

- **`id-token: write` on the publish job.** That permission is not a
  convenience; it *is* the credential.
- **Node 22 and npm 11.5.1 or newer.** Trusted publishing does not exist in
  older npm, and the runner's bundled version is not guaranteed to be new
  enough — so the job upgrades npm explicitly rather than hoping.
- **The workflow filename npm was told to expect.** npm matches the OIDC claim
  against one specific workflow file, so renaming `release.yml` stops
  publishing until the trusted publisher entry on npm is updated to match. If
  the entry names a GitHub environment, the `npm` job needs a matching
  `environment:` key too.

Provenance comes with it. npm records which repository, commit and workflow
built the package without the workflow asking for it, which is worth having for
a tool whose first act in someone's project is to edit their files.

A trusted publisher that is misconfigured **fails the publish** rather than
skipping it, and the GitHub Release job needs the publish job — so a release
that cannot reach npm stops instead of cutting a release that advertises a
version nobody can install. That is the intended behaviour: silence would be
worse.

## A caveat worth knowing once

A tag-triggered workflow runs **the version of the workflow file that exists at
that tag**. Changes to `.github/workflows/release.yml` therefore have to be on
`main` *before* the tag is cut — editing it afterwards has no effect on a tag
that already exists.

## The state of the existing tags

The tags predating this flow do not satisfy it, and it is worth knowing why
rather than being surprised by a failing release later.

- **`v0.3.0` points at the wrong commit.** It points at `4b806b3` — the
  `tailr 0.2.0` commit, whose `package.json` says `0.2.0`, and which is on no
  branch at all. It is also already pushed to `origin`. A release cut from it
  would fail both the manifest check and the `main` check.

  The commit it should point at is `ec0000c` ("Bump to 0.3.0 and read the MCP
  server version from the manifest"), which is on `main` and whose tree matches
  the published `@gcrft123/tailr@0.3.0` tarball exactly. Repairing it means
  force-updating a tag that has already been published:

  ```bash
  git tag -f -a v0.3.0 ec0000c -m "v0.3.0" && git push --force origin v0.3.0
  ```

  Leaving it alone is also fine. Nothing is cut from it unless someone re-pushes
  it, and the flow starts working correctly from the next release either way.

- **`v0.2.0` was never pushed**, and points at that same off-branch commit. The
  0.2.0 source in `main`'s history stops at `a997b4e`; the version bump itself
  only ever existed on the detached commit. There is no clean commit on `main`
  to move it to, so it is best left as a local artifact.

- **`0.1.0` has no tag at all.**

Backfilling GitHub Releases for 0.1.0 through 0.3.0 would mean inventing tags
for commits that do not cleanly represent them. The honest version is to start
the release history at the next tag and leave the npm registry as the record of
what came before.
