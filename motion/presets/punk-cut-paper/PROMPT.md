# Preset: Punk Cut-Paper (lyric / music video)

The style gallery fills the [brackets] from its form and sends this to the agent. You can also paste it into a
Agentcut chat yourself.

---

Make a music video in the **Punk Cut-Paper preset**. Song: [song]. Photos: [photos].
Title: [title]. The song is about [about]. Lyrics: [lyrics].

Start from the kit in `library/presets/punk-cut-paper/`: copy `scenes/` (Ransom, Motif, Photo, Backdrop, Xerox +
`lib/punk.tsx`) and `assets/paper/` into the project, use the same fonts in project.json (Anton, Archivo Black,
Special Elite, Abril Fatface, Permanent Marker, Rubik Mono One, Courier Prime:700), and use
`build_layers.example.py` as the template for the first timeline. Regenerate `scenes/lib/beats.ts` from the song.

The look:
- **Wall:** cream xerox-paper background. Big torn color strips and newsprint scraps, halftone blots, scribbled X marks
  and stars. The layout re-cuts on the strong beats: every 8 beats in the intro, 4 in verses, 2 in choruses, every beat
  in the loudest parts. One color set per section, from: punk red, hot pink, safety yellow, orange, teal, blue, black.
- **Lyrics:** a ransom note, one line at a time. Each word is a torn paper chip in a random font and color that slaps
  down (stepped overshoot) on the frame the word is sung. Keywords are cut letter by letter in capitals. Words fly off
  torn away at the end of the line. Lines alternate left and right halves in wide; in mobile they sit lower-middle.
- **Pictures:** every line gets a cut-paper illustration of what it says (flat paper shapes with rough-cut edges and
  drop shadows, assembled piece by piece, moving in choppy 12 fps stop-motion). No drawn people or hands, only objects
  and symbols. The kit's Motif scene has 28 ready designs (garden, cake, sun, hearts, crown, …) to reuse.
- **Photos:** the person's photos are torn-edge prints with tape, slapped in on the hook lines and on the lines they
  match. Treatments vary: color, xerox black-and-white, or red/pink/yellow/teal tint. A small cut-paper sticker goes on
  the photo's corner. On gang shouts (HEY!), use eye-level photo strips and giant letter-by-letter slams.
- **Intro and outro:** the title builds one letter per strong beat, then the photo and a starburst badge (number or
  tagline). The same title card returns after the last sung line and holds to the end.
- **Overlay:** film grain, a scratch here and there, dark copier edges, a faint flash on strong beats.
- **Both sizes:** wide 1920×1080 and mobile 1080×1920, checked with captures.

Workflow: transcribe the lyrics and check them against the official text when given (fix misheard words, keep the
sung timing), analyze the beats, show the cue sheet in a few lines, then build section by section. Capture both sizes
as you go. Write the cue sheet in notes.md. Every lyric line, illustration, photo and backdrop is its own clip, so it
can be edited on the timeline. Don't export until asked.
