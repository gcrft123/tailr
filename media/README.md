# Media

Web-ready renders of the Tailr intro. The masters are 7680×4320 at 60fps and
live outside the repo, next to the Remotion project — these are the encodes
meant to be linked from a page.

| File | What it is |
| --- | --- |
| `tailr-intro.mp4` | The intro, framed close on the page being marked up. This is the one the README links. |
| `tailr-intro-website.mp4` | The same intro framed wide, with the whole app in shot. For a landing page hero. |
| `tailr-intro-poster.jpg` | Frame 16.5s of the intro with a play badge, used as the README thumbnail. |

Both videos are 1920×1080, 60fps, H.264 High, no audio, `faststart` so a browser
can start playing before the file finishes downloading. To re-encode a master:

```bash
ffmpeg -i "Tailr Intro.mov" -map 0:v:0 -an -dn \
  -vf "scale=1920:1080:flags=lanczos" \
  -c:v libx264 -preset slow -crf 21 -profile:v high -level 4.0 \
  -pix_fmt yuv420p -map_metadata -1 -write_tmcd 0 -movflags +faststart \
  media/tailr-intro.mp4
```

GitHub will not play a `<video>` tag that points at a file in a repository —
its `media-src` policy allows only its own upload host, and `raw.githubusercontent.com`
serves `.mp4` as `application/octet-stream`. So the README links the poster to
the file instead, which opens GitHub's own player. To embed a real player,
drag `tailr-intro.mp4` into a GitHub issue comment, copy the
`user-attachments` URL it produces, and use that as the `src`.
