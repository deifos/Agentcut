# Craft: direction, layout and motion

What makes Agentcut videos work. The user's script, reference, chosen style and format come first.

## Direction: one idea, written down before you build

A video without a direction comes out as generic cards on a gradient. Before the first scene, write
a look sheet in `notes.md` (five to ten lines) and build from it. For a small edit to an existing
video, keep its direction.

- **The idea in one sentence**: what the viewer should feel and remember, and the one visual device
  that carries it (a recurring shape, a material, a camera habit, a type treatment, a colour event).
  Draft two different ideas and keep the one the footage and brand can actually show.
- **A motif that returns**: introduce it in the first two seconds, vary it through the middle, pay it
  off on the end card. Example: the logo's corner radius becomes the mask for every transition.
- **Contrast is the spice**: plan where the video changes scale (wide → extreme close), density (one
  word → a full screen), tone (dark → light → accent), speed (hold → burst) and sound (bed → silence
  → hit). At least one deliberate change every 3–5 s; never the same layout three shots running.
- **One surprise**: a single moment that breaks the pattern you set (a full-bleed colour flood, type
  that fills the frame, a hard cut to silence). One, placed on the reveal or the drop.
- **The look in real values**: background, text and accent colours as hex from the brand
  (`loops.md` › Brand palette first), font families and weights, the type scale and margins below,
  entrance and exit timings in frames. A project `style` supplies these: use its tokens and say so.
- **Name what you will avoid** for this video: repeated feature cards, tiny UI on an empty stage,
  the same spring on every element, decoration that competes with the proof.

Check the direction early: build the opening and the strongest shot first, capture both formats,
and only then extend the treatment to the rest.

## Layout system: every frame sits on the same grid

Define these once in a constants object the scenes share (or take them from the project style), so
every scene lines up with the next.

- **Margins**: 5–6% of the short side on every edge (≈ 60 px at 1080). Nothing the viewer must read
  sits outside them. Mobile also keeps clear of the top 10% and bottom 18% (platform UI).
- **Grid**: 12 columns in wide, 6 in mobile, with one gutter value. Blocks start and end on column
  lines; text aligns to the same left edge or the same centre line from shot to shot.
- **Type scale**: four sizes at most, in a fixed ratio (≈ 1.5): display, title, body, label. At 1080
  short side: display 150–220, title 90–130, body 40–56, label 28–34 px. Two families at most; weight
  and size make the hierarchy, not extra colours. Line length under about 28 characters for titles.
- **One focal point per frame**: the largest, brightest or only moving thing is what the shot is about.
  Give it 40–60% of the frame; everything else is smaller, dimmer and still. Leave empty space on
  purpose: a third of the frame clear reads as confident, not unfinished.
- **Spacing in steps**: one base unit (≈ 12 px at 1080) and its multiples for every gap and padding;
  the same radius, stroke width and shadow on every card.
- **Both formats are designed**: wide composes left-to-right (text beside the subject), mobile stacks
  (subject above, text below, larger type). Recompose with `variants.mobile`; never just scale down.
- **Check it**: a contact sheet should show the same margins and baselines in every tile. If a title
  jumps position between two similar shots, fix the grid, not the shot.

## Structure

- **One idea per beat**, 2–6 s each. A 60 s launch spot has ~10 beats: pain → reveal → 3–6 feature beats →
  proof/flow → end card (logo, URL, "now live").
- **The voice drives the cuts.** Every scene starts a few frames (≈ 8 f at 30 fps) before the word it
  illustrates; on-screen elements pop on their keyword's start frame. Keep a word-index cue table in
  notes.md (`reveal = word "meet" − 8f`). With no voice, the music's beats and sections drive it.
- **Music has a shape**: quiet intro under the hook, a drop on the reveal, a final chord on the end card.
  Put markers on the drop and the final hit; cut and flash on them.

## Motion

- Entrances: springs. `pop` (scale 0.6→1 + rise + fade over ~5 f), `rise` (fade + 30 px rise), `land` for
  heavy titles. Stagger lists by 3–6 frames.
- Exits: short eased fades with a slight scale-down / rise and blur (≈ 7 frames), overlapping the next
  scene's entrance.
- After the drop, a **beat pulse** (0..1 decaying over ~8 f on each beat) drives subtle scale/brightness of
  backgrounds and accents — never the text you need to read.
- Flashes: brief white overlay (opacity ≤ 0.35, ~10 f) on the drop and the final hit only.
- Camera moves over rebuilt UI: ease in/out between framings, hold long enough to read (≥ 1.2 s per line of
  text the viewer must read).

## Visuals

- **Use real product evidence** for demonstrations: recorded actions and their visible results.
  Screenshots can explain static views; crop within their available resolution and check sharpness.
  Rebuilt UI is an illustration, not proof of an interaction. Follow the active workflow's disclosure
  and approval rules. Do not replace real footage with a mock interface to make a camera move easier.
- Brand palette in one constant object; one gradient for accents; dark backgrounds with radial glows
  (`RadialGlow`) for depth.
- Icons as inline SVG strokes (24×24 viewBox, round caps), not emoji.
- Abstract props only: no drawn hands, bodies or figure-like shapes.
- Lyric videos: one phrase per layout, accent words highlighted, kicker words smaller; the look follows the
  genre (night-station LED, xerox art-punk, pastel line diagrams, tattoo flash…).

## Captions

Word-by-word for talking-head and voice-driven pieces: 2–4 words per line, the active word highlighted,
lines break at pauses. Check fast passages by capture; transcripts can merge or drop words.

## Before calling it done

- Contact sheet of each variant: no clipped text, no empty frames between scenes, consistent margins.
- `agentcut_listen_critique`: loudness near −14 LUFS after export normalization, voice clearly above
  music, every SFX on its cue.
- notes.md updated: cue sheet, sound choices with their numbers, anything the user should know.
