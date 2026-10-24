# Preview performance

The user watches the live preview, which draws every scene in their browser at playback speed. A scene
that takes too long per frame makes the preview skip frames (choppy) and can freeze the tab while you
capture frames. The export doesn't skip: it renders every frame at full quality. So:

**Never lower what the render shows to make the preview smoother.** No lower resolution, fewer
elements on screen, skipped frames, softer images or simpler motion. Every change below must render
the same frames as before; when one can't, keep the look and tell the user that part previews choppy
but exports perfectly.

## Measure

- `agentcut_preview_check` (from/to in frames) plays a range muted in the user's preview and returns
  per visual clip: frames played and dropped, loading stalls, the longest freeze, the most DOM elements
  seen, and a verdict (`smooth` under 12 % dropped, `choppy`, `heavy` from 30 %; a freeze over a second
  also counts as slow). It takes as long as the range plays: check the clip you changed, not the whole
  video every time.
- `agentcut_status` → `page.previewPerformance` reports the user's own playback (`source: "playback"`).
  `current: false` means it was measured on an older build.
- Run a check after building or changing a heavy scene (walls and grids, hundreds of elements, image
  sequences, big blurs, generated images) and before you say you're done. A first run includes loading
  (stalls); run it again to see steady playback.

## Make it lighter (same pixels)

1. **No image sequences.** Swapping a different picture every few frames makes the browser fetch and
   decode a full image per frame. Encode the frames into one video at the frames' own size (never
   smaller than they ever appear), visually lossless:
   `ffmpeg -framerate <fps> -i f%03d.jpg -c:v libx264 -crf 12 -preset slow -pix_fmt yuv420p out.mp4`
   (ffmpeg on PATH, or the helper's copy in `~/.agentcut/tools/ffmpeg/`; if there's none, ask the user).
   Play it with `<Video>` from `@remotion/media` (`trimBefore` to start inside it). Many tiles of the
   same footage: one video per distinct clip.
2. **Repeated complex elements** (a wall of the same card, a grid of mini UIs): render the repeated
   piece once to an image at least as large as it ever appears in the frame (2x for zooms), and draw the
   copies as `<Img>`. Keep the live version for the copy that changes (the hero tile) and for anything
   the camera zooms into, so its text stays sharp (House style).
3. **Draw only what's visible.** Skip elements that are fully outside the frame or at opacity 0
   (`return null`). That changes nothing in the picture.
4. **Compute once.** Canvases, data URLs, noise and layout math that don't depend on the frame go in
   module scope or `useMemo`, never in every render. Nothing heavy in a component that mounts per tile.
5. **One filter on a wrapper**, not the same `filter`/`blur`/`box-shadow` on dozens of children, when it
   looks the same. Big animated blurs are the most expensive thing to draw: keep their area as small as
   the look allows.
6. **Fewer DOM nodes for the same look.** A stack of plain divs for a skeleton UI can often be one
   element with a `linear-gradient` background or an inline SVG that draws the same lines (both export;
   radial gradients don't, see `browser-export.md`). Aim for under ~1,500 elements in the
   frame at once.

After a change, capture the same frames as before (`agentcut_capture_frames`) and compare: the frames
must look the same. Then run `agentcut_preview_check` again and report the before/after drop rates.
