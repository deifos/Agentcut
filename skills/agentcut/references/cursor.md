# Cursor and clicks (ScreenSlick Companion recordings)

Screen recordings made with ScreenSlick Companion come with a `<video>.cursor.json` next to the video
(`assets/screen.webm` → `assets/screen.cursor.json`): where the mouse was, every click and every scroll.
It tells you what the user *did*, so you can edit around the action instead of guessing from frames.

Start with `agentcut_media_info` on the screen video. When the file exists you get a `cursor`
summary:

- `clicks`, `scrolls`: counts.
- `busiest`: up to 3 stretches with the most clicks (`from`/`to` in seconds, `fromFrame`/`toFrame`), and
  `around`: the average click position (0–1 of the video). These are your zoom candidates.
- `idle`: stretches of 3 s or more with no movement, clicks or scrolls. Cut candidates.
- `typing`: a text cursor that stays put for 1.5 s or more. Speed-up candidates.

Read the JSON itself only for exact click positions. Never edit it.

## The file

```json
{
  "version": 1, "fps": 30, "durationInFrames": 14400, "width": 2560, "height": 1440,
  "space": "video",
  "cursorInVideo": false,
  "path": [[0, 0.41, 0.33], [12, 0.43, 0.35], [40, null, null]],
  "kinds": [[0, "arrow"], [310, "text"]],
  "clicks": [{ "frame": 95, "x": 0.62, "y": 0.18, "button": "left" }],
  "scrolls": [{ "frame": 400, "x": 0.5, "y": 0.6, "dy": 240 }]
}
```

- Frames are frames **of the video file** at `fps`: the same units as a clip's `trimStart`.
- `x`/`y` are 0–1 of the video's picture. `null` means the pointer was off the recorded screen.
- `space: "source"` (a rendered edit from the editor): clicks are timed to the edit, but positions are on
  the original screen, not the edited frame (it may be zoomed or padded). Use them for timing and rough
  side (left/right, top/bottom) only. These files have no `path`.

A click lands on the timeline of a piece at `from + (click.frame − trimStart) / (playbackRate ?? 1)`, if
that is inside the piece.

## Drawing the cursor

The `cursor` field on a video clip draws the recorded pointer inside that clip:

```json
"cursor": { "src": "assets/screen.cursor.json", "style": "classic", "size": 100, "clicks": true, "smoothing": 0.3 }
```

- `style`: `classic` (white), `accent` (green), `spotlight` (green ring), `hand` (👆), `hidden` (no
  pointer, click rings still work).
- `size`: % of the default (50–200). `clicks`: a ring spreads from each click. `smoothing`: 0 follows the
  recorded path, 1 glides.
- It follows the clip's `trimStart`, `playbackRate` and `box`, so cuts, speed-ups and zooms keep it in
  place. When you split a screen clip, **copy `cursor` to every piece** (like `grade`).
- `cursorInVideo: false` means the recording has no pointer of its own: the import already set
  `style: "classic"`. Never remove it, or the video has no mouse. `cursorInVideo: true`: the import set
  `style: "hidden"` with `clicks: false`; turn `clicks` on for rings over the real pointer.
- The user can change all of this in the inspector's Cursor section.

## What to do with it

**Zoom where the action is.** For each `busiest` stretch (or a single important click), split the screen
piece around it (start ~0.5 s before the first click, end ~0.5 s after the last) and give that piece a
bigger `box` centered on `around` (cx, cy). For zoom `z` (1.5–2):

```
box = { width: z, height: z, x: clamp(0.5 − cx·z, 1 − z, 0), y: clamp(0.5 − cy·z, 1 − z, 0) }
```

(clamping keeps the frame covered). This assumes the screen fills the frame; with letterboxing, map the
point into the frame first. The cursor zooms with the picture automatically.

**Highlight clicks.** Keep `clicks: true` on the pieces that matter (or all of them). For a click that
starts a key step, add a callout (text clip or library component) near it: frame position =
`box.x + x·box.width`, `box.y + y·box.height`. Keep it on the side away from the pointer, 1.5–3 s.

**Cut dead time.** An `idle` stretch with no speech (check `agentcut_transcribe`) is waiting:
cut it, keeping ~0.3 s on each side. Idle *with* speech is the user explaining: keep it, maybe zoom on
what they talk about.

**Snap cuts to clicks.** When choosing between nearby cut points, put the cut 0.3–0.5 s before a click,
so each new section opens on the action.

**Speed up typing.** A `typing` stretch with no speech can play at `playbackRate` 2–4 on its own piece
(split it out). With speech over it, leave it at 1×.

**Scrolls.** A scroll right after a click often means "now look here": a slower zoom-out or a hold works
better than a zoom-in.

Check every change with `agentcut_capture_frames` at the click frames: the pointer should sit
on what was clicked.
