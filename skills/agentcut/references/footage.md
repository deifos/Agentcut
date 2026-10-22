# Footage sent from the editor

"Send to Agentcut" in the ScreenSlick editor renders the user's edit and opens it here as a new
project sized to the video:

- **Footage** track: one video clip `footage` with `src: "assets/footage.<ext>"`, `fit: "contain"`,
  covering the whole project. Its audio is the user's voice and the editor mix.
- **Captions** track (when the edit had subtitles): one captions clip with the editor's words, timed in
  frames. Restyle it with `style`; don't retype the words.
- `notes.md` says what came over.

The user finishes the video here: cuts, color, motion graphics, sound, then exports from the studio.

## Remove silences / tighten pacing

1. `agentcut_transcribe` on `assets/footage.<ext>` for word timings (or
   `agentcut_analyze_audio` for per-frame energy when there is no speech).
2. Find gaps longer than ~0.6 s between words (keep ~0.15 s of air before and after each word; never cut
   inside a word). Keep breaths that land on a beat or a reveal.
3. Replace the single footage clip with one clip per kept range, back to back on the Footage track:
   each clip has `src` of the footage, `trimStart` = range start (frames in the file), `from` = where it
   lands on the timeline, `duration` = range length. Give them ids `footage-1`, `footage-2`, …
4. Move every caption word with its range (subtract the time removed before it), drop words in removed
   ranges, and set the project `durationInFrames` to the new end.
5. Tell the user how much you cut ("removed 14 pauses, 0:52 → 0:41"), then check the cut points with
   `agentcut_capture_frames` and `agentcut_listen_critique`.

Cuts "by transcript" ("remove the part where I say …") work the same way: find the words, cut their range.

## Color

Use the `grade` field on each footage clip (copy it to every piece after a cut). Small moves: contrast
1.05–1.15, saturation 1.05–1.2 for punch, warmth 0.1–0.25 for warmer skin, 0.8–0.9 saturation for a
muted look. Check with `agentcut_capture_frames` before and after.

## Motion graphics over footage

Add tracks above Footage (text, scenes, images) and keep the footage readable: lower thirds and callouts
at the edges, punch-in zooms by splitting the footage and giving that piece a bigger `box`, never covering
the speaker's face for long.

## Raw takes

"Send to Agentcut → Raw takes" sends the untouched recordings instead of a render. The project is
sized to the screen recording:

- **Screen** track: one clip per take (`screen`, or `screen-1`, `screen-2`, … back to back), `src:
  "assets/screen.<ext>"`, `fit: "contain"`. Its audio is the user's voice: the only audio in the project.
- **Camera** track (when they recorded one): clip `camera`, `src: "assets/camera.<ext>"`, `fit: "cover"`,
  a `box` where the editor showed it and a `radius` for its rounded corners. It is `muted` (the voice is on
  the screen file) and already synced: its `from`/`trimStart` line it up with the screen. Keep it muted.
- **Captions** track (when the editor had subtitles): words timed to the raw recording.
- **Cursor** (Companion recordings): `assets/screen.cursor.json` with the mouse path, clicks and scrolls,
  and a `cursor` field on the screen clip that draws the pointer. Copy that field to every piece you cut.
  See `references/cursor.md`; it also finds zoom, cut and speed-up candidates for step 1.
- `notes.md` lists the files and whether the user had the camera mirrored.

Nothing is cut yet, so a raw take is usually long. Ask what the video is for when it isn't clear, then:

1. **Cut both tracks together.** Work out the kept ranges on the screen take (silences, retakes, "by
   transcript" cuts, as above). For every range, add a screen piece *and* a camera piece with the same
   `from` and `duration`. With the range start `R` in frames on the *original* timeline, the screen
   piece's `trimStart` is `R` − its take's original `from`, and the camera piece's `trimStart` is
   `R` − camera's original `from` + camera's original `trimStart` (skip camera pieces where that is
   negative: the camera wasn't rolling yet). Ids: `screen-1…`, `camera-1…`. Move the captions with the cuts.
   Spot-check sync after cutting with `agentcut_capture_frames` (lips vs. the voice).
2. **Frame the screen.** A `box` is fixed for the whole clip, so a zoom is a cut: split the screen piece
   where the action starts and give that piece a bigger box (width/height 1.5–2, x/y negative to keep the
   area of interest in frame), then cut back. Hold each zoom long enough to read.
3. **Place the camera.** Bubble in a corner (keep `radius` at half the short side for a circle), full frame
   for an intro or outro (camera `box` to the whole frame; the Camera track sits above Screen), or
   side by side (shrink the screen `box`, give the camera the rest). Change layouts at cuts, not mid-sentence.
4. Then grade, captions, music and motion graphics as for any footage.
