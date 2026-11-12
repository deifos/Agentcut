# Launch direction: from brief to checked shots

Use this with `product-launch.md` or `feature-launch.md` for a new film or a major revision.
For a small edit, keep the existing direction and check the changed shots. The user's script,
reference, selected style and format take priority. Keep decisions in the project's `notes.md`.
This guide uses Agentcut tools and frame timing; it does not require another video engine.

## Choose a story that the images can tell

Compare two possible stories using the available evidence, not just two opening titles. For example,
show a finished result and then how it was made, or follow one real input through an action to its
result. Pick the clearest story and record why. Continue without an approval stop unless the user
asked to choose a direction. Do not repeat this exercise for an approved script or storyboard.

Keep the same recognizable file, query, project or other subject through the demonstration when
the source supports it. A viewer should see what changed. Unrelated screens with benefit labels
do not explain a workflow. Do not fabricate a failure in the old workflow to create tension.

## Turn the direction into build decisions

Before building scenes, add a compact direction and shot table to `notes.md`:

- **Look:** actual background and text colors, accent use, font files/families, weights, text sizes,
  margins and product framing for each output format. Use selected style tokens where available.
  Replace vague words such as "premium" with these choices. Keep meaningful product status colors.
- **Motion:** entrance, camera and exit durations in frames, easing or spring settings, and the
  settled reading window. Choose motion by purpose; do not give every element the same entrance.
- **Avoid for this film:** identify likely distractions, such as repeated feature cards, tiny UI
  inside a large empty stage, or decoration that competes with proof. This is specific to the brief;
  do not ban a color, material or effect that the user's style needs.

| Frames [start, end) | What the viewer learns | Source and visible change | Framing and main move | Exact words and settled read frames | Sound cue | Link to next shot |
| --- | --- | --- | --- | --- | --- | --- |

Fill one row per shot. Use real asset paths and source ranges, not placeholder evidence. Keep the
table aligned with the timeline after timing changes. Plan the final readable frame before `end`.
Do not add claims, voice or captions just to fill the table.

For each demonstration, establish where the task happens, bring the relevant action into clear
view, then show its result in context. These can be parts of one shot. A pan across a still image
can explain a layout; it cannot prove an interaction. Keep real footage for the action.

## Prove the visual direction early

Build the opening and the main proof shot first, in story order when possible. Capture their
settled frames in each output format with `agentcut_capture_frames`. Inspect actual words, assets,
framing and contrast before extending that treatment to the rest of the film. A full storyboard
approval step is optional, only when requested; these are working checks in the live project.

The first frame should give the viewer useful visual context unless the brief calls for darkness.
Give the product enough space for the relevant action to read. At small display size, crop closer
or reduce the words before reducing text size. A full app view establishes context; its incidental
labels do not all need to be readable. Essential labels and results do.

## Make motion carry the story

- Give each shot one main movement. Delay or reduce secondary motion so it does not compete.
  Let essential titles and UI settle while the viewer reads. Idle floating is not a demonstration.
- Contrast short transitions with longer action and result holds. As a starting estimate, allow
  about `0.5 + 0.3 * wordCount` seconds for a short line after it settles. Validate with the actual
  layout and audience; dense UI needs more time. Cut words or decoration to meet a fixed duration.
- Connect shots through a visible action, a continuing subject, matching framing or a deliberate
  cut. Name the connection in the shot table. Do not require a transition quota or a new effect at
  every cut. A clear hard cut is useful when a morph would distort the evidence.
- Keep important labels sharp during the reading window. Motion blur belongs to movement, not
  the proof hold. Use the existing component catalog and `cinematic.md` tools where suitable.
  Follow `browser-export.md`; a browser-only effect is not proof that an export works.
- Use source action times, narration timings or analyzed music cues. For a regular beat grid,
  calculate each frame from its beat index and round once; repeated rounded intervals cause drift.

## Review the cuts and the meaning

Keep the main skill's full picture, sound and performance review. Add these checks to it:

1. Inspect frame 0, the settled proof and the final readable frame in each format. Read the shot
   sequence as a new viewer. Without the headline, is the promised change still visible?
2. For each cut at frame `c`, sample `c - 1` and `c`, plus nearby frames across the transition.
   Clamp samples to the video bounds. For a longer move, sample intermediate frames too. Look for
   blank gaps, duplicated subjects, jumps in labels, obscured results and conflicting motion.
3. Inspect essential words and UI at a small display size, about 360 px wide where available.
   If a tool cannot show that size, record this limit; do not claim a small-screen check passed.
4. Record concrete issues as `frame / variant / issue / change / recheck result` in `notes.md`.
   Fix wrong claims, unreadable evidence and broken transitions before decorative details. Recheck
   changed shots using `efficient-review.md`; timing or shared changes require broader checks.

At hand-off, state what was checked and any remaining weak shot or missing evidence. A build pass
only proves the project compiles. Do not describe a film as visually verified without viewing its
captures, or say sound was heard when it was only measured.

