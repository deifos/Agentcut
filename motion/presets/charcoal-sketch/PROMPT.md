# Preset: Charcoal Sketch (product explainer, one colour hero)

The style gallery fills the [brackets] from its form and sends this to the agent. You can also paste it into a
Agentcut chat yourself.

---

Make a video in the **Charcoal Sketch preset**. Product / topic: [what it is, who it's for]. Story: [pains and how
the product solves each one, or the beats you want]. Colour hero: [the mascot / logo / product images to keep in colour,
e.g. `assets/mascot/*.png`]. Length: [~60 s]. Voice-over: [yes: Gemini Puck / no].
Music: [new 80s synth-pop from Lyria / a file I give you]. End card: [name, tagline, URL].

Start from the kit in `library/presets/charcoal-sketch/`: copy `scenes/Paper.tsx`, `scenes/Grain.tsx`,
`scenes/lib/` (sketch.tsx, painfix.tsx) and `assets/paper/` into the new project, and the hero images into
`assets/mascot/<pose>.png` (the `Mascot` component reads that path). `scenes/examples/` holds the scenes from the
first video (Hook, pain/fix beats, EndCard) to copy and adapt into `scenes/`. Use `scripts/build_layers.example.py` as the
timeline template (one cue sheet → layers.json) and `scripts/duck_music.py` to duck the music under the voice. Fonts in
project.json: Cabin Sketch:400;700, Caveat:500;700, Patrick Hand:400, Outfit:700;800. Background #E9E6DF.

The look, so it matches the first video:
- **World:** everything is soft graphite / charcoal on off-white drawing paper: grey lines only, no colour at all.
  Lines are hand-wobbled with a faint charcoal halo, drawn on stroke by stroke, and re-drawn every 3 frames so they
  "boil" like rotoscoped pencil. Drawn elements animate on twos. Diagonal hatching for shading, soft charcoal smudges
  under objects, charcoal dust swapped on threes over everything, darker paper toward the edges.
- **The only colour:** the hero (mascot / logo / product) in full colour, moving smoothly on ones with springs and a
  hatched pencil shadow under it. That contrast is the whole idea: sketch world, one real thing alive in it.
- **Comic book:** thick sketched panel borders. The hook is a comic page with one panel per phrase, each with a caption
  box in Cabin Sketch. On the music's drop the hero jumps out and the page blows away.
- **Pain → fix beats:** each beat is one big panel. The pain is a messy sketch with a hand-lettered question and a double
  underline, the hero peeking confused from a corner. On a bar line the hero dashes across the frame and erases it
  (eraser smear on the seam); the fix redraws neatly behind it with a lettered statement and a check mark, and the
  hero lands in a happy pose. Product UI is redrawn as clean sketches (calendar grids, panels, buttons, cards), not
  screenshots, with real labels and nothing the product can't do.
- **Type:** Cabin Sketch for titles and captions, Caveat for handwriting, Patrick Hand for small UI labels. Text is
  written on left to right and jitters slightly on threes.
- **End card:** one double-bordered panel, the hero waving with pencil rays, the name lettered huge in Cabin Sketch
  with an underline, the tagline in Caveat, the URL in a sketched box. Rays pulse on the final hit.
- **Sound:** bright mid-80s synth-pop (drum machine, gated snare, synth bass, bouncy analog lead, about 150 BPM, no
  vocals). Scene changes and hero dashes land on bar lines. Real paper SFX: pencil scribble on every draw-on, paper
  swipe on each dash, taps for cards landing, rubber stamp / clicks where the UI does something. Music ducked under the
  voice (voice ≥ 6 LU above the music).
- **Format:** [wide 1920×1080 / also mobile 1080×1920] (the kit's coordinates are drawn for 1920×1080; redesign the
  layouts for mobile, don't crop).

Workflow: write the script first and generate the voice (check every take with a transcription), make the music and
find its bar grid, show me the cue sheet in a few lines, then build beat by beat with captures. Write the cue sheet
and the sound numbers in notes.md. Every scene, voice line and sound is its own clip so I can edit it on the timeline.
Don't export until I ask.
