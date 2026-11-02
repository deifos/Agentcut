# Colour grading

Grade in this order, measuring before and after. Never say a grade looks right without
`agentcut_color_check` numbers or a capture behind it.

1. **Measure.** `agentcut_color_check` with `stage: "source"`. Issues are conventions, not rules: a night
   scene is meant to be dark. `differenceFromReference.noticeable` shows the shots a cut would jump on.
2. **Balance.** `agentcut_match_shots` when shots differ. It writes `grade.match`, under everything else, and
   reports before and after. Pick the shot that looks best as `anchorClipId`. It doesn't copy looks or settings
   unless you pass `copyGrade: true`, which replaces each clip's own grade with the anchor's.
3. **Correct.** Fix what's left per clip: exposure, white balance, then contrast. Small moves.
4. **Look.** Set one look over the whole video: `project.json` `grade`, or `agentcut_match_look` to match a
   reference. `agentcut_color_looks` lists the built-in ones.
5. **Finish.** Grain, halation and vignette last, and lightly.
6. **Check again.** `agentcut_color_check` (`stage: "graded"`) and `agentcut_capture_frames` across a cut. Text
   and logos on other tracks aren't graded, so check that they still sit well on the new picture.

## Where a grade goes

| Where | What it grades |
| --- | --- |
| `grade` on a video clip | That clip. After a cut each piece keeps a copy. |
| `grade` on an image clip | That image. |
| An `adjustment` track's clip | All footage below it while it runs. `enter` and `exit` frames fade it in and out, `opacity` scales it. |
| `grade` in `project.json` | All footage, last. The place for the film's overall look. |

Clips draw their own grade, then adjustment layers (lowest first), then the project grade. Set
`inheritGrade: false` on a video clip (a screen recording, say) to keep the last two off it. Images are the
other way round: they only inherit with `inheritGrade: true`, so logos keep their colours. Graphics, scenes,
text and captions are never graded.

```json
{ "id": "grade", "name": "Flashback", "kind": "adjustment", "clips": [
  { "id": "flashback", "from": 120, "duration": 90, "enter": { "preset": "fade", "frames": 12 }, "exit": { "preset": "fade", "frames": 12 },
    "grade": { "look": "faded-print" } }
] }
```

## Fields

All optional. Multipliers are neutral at 1, amounts are neutral at 0 and run −1 to 1 unless noted.

- **Light:** `exposure` (stops, −5…5), `temperature`, `tint`, `contrast` (1), `pivot` (0…1), `brightness` (1)
- **Tone:** `highlights`, `shadows`, `whites`, `blacks`, `blackPoint`, `whitePoint` (0…1), `gamma` (1)
- **Colour:** `saturation` (1), `vibrance`, `hue` (degrees), `warmth`, `skinProtect` (0…1, keeps skin's own colour)
- **Wheels:** `wheels: { shadows, midtones, highlights }`, each `{ x, y, level }`. `x`/`y` push towards a hue
  (x+ red, x− cyan, y+ green-yellow, y− blue-magenta). Teal shadows: `{ "x": -0.3, "y": -0.1 }`.
- **Curves:** `curves: { master, r, g, b }`, each a list of `[input, output]` pairs from 0 to 1.
  A gentle S: `[[0,0],[0.25,0.22],[0.75,0.78],[1,1]]`.
- **Colour mixer:** `hsl: { red, orange, yellow, green, aqua, blue, purple, magenta }`, each
  `{ hue, saturation, luminance }`. Skin lives in orange; leave it alone unless that's the point.
- **Looks:** `look` (built-in id), `lookStrength` (0…1), `lut` (a `.cube` under `assets/`), `lutStrength` (0…1)
- **Finish:** `grain` (0…1), `grainSize` (0.5…4), `halation` (0…1), `bloom` (0…1), `vignette` (+ darkens corners)
- **Over time:** `keys`, grades at clip-local frames: `[{ "frame": 0, "saturation": 0, "hold": true }, { "frame": 24, "saturation": 1 }]`.
  A key only overrides the fields it names. Keys ease to the next one; `hold` jumps instead. Cuts on a beat with
  `hold`: frames from `agentcut_analyze_audio`, relative to the clip's start.

`.cube` files must be 3D, up to size 65. Log footage needs its conversion LUT (usually from the camera maker)
before any look, so use `lut` for that and a built-in `look` over it.

## Sizes of move that work

| Goal | Fields |
| --- | --- |
| A bit more punch | `contrast` 1.05–1.15, `vibrance` 0.1–0.2 |
| Warmer skin | `temperature` 0.05–0.15 |
| Muted, editorial | `saturation` 0.8–0.9, a soft S curve |
| Filmic finish | `grain` 0.1–0.2, `halation` 0.1–0.25 |
| Teal and orange without orange people | `look: "teal-amber"`, or wheels with `skinProtect` 0.6 |

Keep `exposure` corrections under about one stop: past that, compression noise shows. A grade can't bring back
clipped highlights or add focus.

## Person and background

`agentcut_grade_subject` cuts the person out and grades them apart from the background, on request (it takes a
while: it runs the same model as `agentcut_cutout_person`). Presets: `pop`, `mono-background`, `soft-background`,
`night-background`. Check edges with captures, especially hair against a darker background. After changing the
footage's framing or trim, run it again.
