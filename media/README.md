# Media

Web-ready renders of the Tailr intro. The masters are 7680×4320 at 60fps and
live outside the repo, next to the Remotion project — these are the encodes
meant to be linked from a page.

| File | What it is |
| --- | --- |
| `tailr-intro.mp4` | The intro, framed close on the page being marked up. This is the one the README links. |
| `tailr-intro-website.mp4` | The same intro framed wide, with the whole app in shot. For a landing page hero. |
| `tailr-intro-poster.jpg` | Frame 16.5s of the intro with a play badge, used as the README thumbnail. |
| `tailr-intro-website-poster.jpg` | The first frame of the wide encode, so the landing page hero has the right yellow under it before the video plays. |

Both videos are 1920×1080, 60fps, H.264 High, no audio, `faststart` so a browser
can start playing before the file finishes downloading. To re-encode a master:

```bash
ffmpeg -i "Tailr Intro.mov" -map 0:v:0 -an -dn \
  -vf "scale=1920:1080:flags=lanczos" \
  -c:v libx264 -preset slow -crf 21 -profile:v high -level 4.0 \
  -pix_fmt yuv420p -map_metadata -1 -write_tmcd 0 -movflags +faststart \
  media/tailr-intro.mp4
```

GitHub will not play a `<video>` tag that points at a file in a repository. Its
`media-src` policy allows only its own upload hosts, so both
`raw.githubusercontent.com` and the `github.com/.../raw/...` URL that redirects
there are blocked. Nothing is wrong with the file — the same URL plays in a
`<video>` on any other site, which is what to use for a landing page.

So the README links the poster to the file instead, which opens GitHub's own
player. To get a real inline player, drag `tailr-intro.mp4` into a GitHub issue
comment and put the `user-attachments` URL it gives you in the README on a line
of its own, with no Markdown around it. That is how every working example does
it — the video lives on GitHub's upload host, not in the repository.
