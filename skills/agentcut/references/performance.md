# Preview performance

The user watches the live preview, which draws every scene in their browser at playback speed. A scene
that takes too long per frame makes the preview skip frames (choppy) and can freeze the tab while you
capture frames. The export doesn't skip: it renders every frame at full quality. So:

**Never lower what the render shows to make the preview smoother.** No lower resolution, fewer
elements on screen, skipped frames, softer images or simpler motion. Every change below must render
the same frames as before (check with captures); when one can't, keep the look and tell the user that
part previews choppy but exports perfectly.

## Measure

- `agentcut_preview_check` (from/to in frames) plays a range muted in the user's preview and returns
  per visual clip: frames played and dropped, loading stalls, the longest freeze, the most DOM elements
  the clip drew, and a verdict: `smooth`, `choppy` from 20 % dropped, `heavy` from 40 % (and at least 6
  dropped frames); a freeze over a second or more than 0.5 s of stalls also counts as slow. It takes as
  long as the range plays: check the clip you changed, not the whole video every time. One check at a
  time; it stops if the user pauses or seeks.
- `slowClips` lists the likeliest cause first. `sharesDropsOnly` marks a clip (often text or captions)
  that only sits on top of a slower one: fix the other one. `slowToMount` means the clip drops frames in
  the second before it starts, while it mounts early: its setup work is heavy (see rule 4), even when it
  plays fine afterwards.
- `agentcut_status` → `page.previewPerformance` has the latest check (`lastCheck`) and the user's own
  playback (`playback`). `current: false` means it was measured on an older build.
- Run a check after building or changing a heavy scene (walls and grids, hundreds of elements, image
  sequences, big blurs, generated images) and before you say you're done. A first run includes loading
  (stalls); run it again to see steady playback. A machine's own jitter varies between runs: act on a
  `choppy` only when a second run agrees.

## Make it lighter (same pixels)

1. **Image sequences that stall.** Swapping a different picture every few frames makes the browser fetch
   and decode a full image each time. When a check shows stalls or drops on one, encode it into one video,
   but only if it keeps the same picture and timing:
   - Keep the images when the frames have transparency (H.264 has none, they'd render on black), or
     small text and hard-edged colored UI (4:2:0 color softens it).
   - The video must show each image on exactly the frames it shows now. Images held the same number of
     frames each: `-framerate <fps / frames per image>`. Any other timing (eased, held, reversed): write
     the images out in display order, one file per project frame, and encode at the project fps.
   - Encode at the frames' own size (never smaller than they ever appear), visually lossless, BT.709:
     ```
     ffmpeg -framerate <rate> -start_number <first> -i f%03d.png \
       -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
       -c:v libx264 -crf 12 -preset slow -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
       -color_range tv -movflags +faststart out.mp4
     ```
     `pad` adds one pixel on the right or bottom when a side is odd (H.264 4:2:0 needs even sizes):
     draw the video at its padded size inside a box of the frames' size with `overflow: hidden`.
   - ffmpeg is on PATH or in `~/.agentcut/tools/ffmpeg/`; if there's none, ask the user.
   - Play it with `<Video>` from `@remotion/media` (`trimBefore` in frames to start inside it). Many tiles
     of the same footage: one video per distinct clip.
   - Capture frames across the sequence before and after and compare; if colors or edges differ,
     keep the images.
2. **Repeated complex elements that never change** (a wall of the same static card): draw the piece
   once to an image and show the copies as `<Img>`. Make it with `agentcut_capture_frames` at `scale: 2`
   with `region` set to the piece's box in composition pixels, on a frame where it's fully drawn and
   unobstructed; save it in `assets/` and show it at its 1x size. Keep the live version for every copy
   that animates or changes, and for anything the camera zooms past 2x, so its text stays sharp (House
   style).
3. **Draw only what's visible.** An absolutely positioned element that is fully outside the frame or at
   opacity 0 can `return null`. Not when it sits in a flex or grid layout (opacity 0 still takes its
   space, so its siblings would move), not when it holds `<Audio>`/`<Video>` (the sound would stop), and
   "outside" means after the camera's transforms and including its shadow and blur.
4. **Compute once.** Canvases, data URLs, noise and layout math that don't depend on the frame go in
   `useMemo` (or module scope), never in every render; nothing heavy in a component that mounts per tile.
   Anything random must stay deterministic: `random("seed")` from `remotion`, never `Math.random()`,
   which differs on every load and between the export's render tabs (it would flicker).
5. **One filter on a wrapper** instead of the same `filter`/`blur` on dozens of children, only when the
   children don't overlap or touch (a blur or drop-shadow of the group differs where they meet), then
   compare captures. Big animated blurs are the most expensive thing to draw: keep their area as small as
   the look allows.
6. **Fewer DOM nodes for the same look.** A stack of plain divs for a skeleton UI can often be one
   element with a `linear-gradient` background or an inline SVG that draws the same lines (check
   `browser-export.md` for what the export draws). Never remove anything that shows.
7. **WebGL and canvas scenes**: `usePreviewQuality()` lowers resolution and redraw rate in the preview
   only (`browser-export.md`); captures and the export keep full quality.

After a change, capture the same frames as before (`agentcut_capture_frames`, the export's own
renderer) and compare: the frames must look the same. Then run `agentcut_preview_check` again and report
the before/after drop rates.
