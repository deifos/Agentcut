# Archival b-roll

Agentcut has a catalog of public-domain shots cut from archive.org films (Prelinger industrial and
educational films, newsreels, home movies): 1930s–1970s, colour and black-and-white, silent, free to use
in any video, commercial included (brand logos seen in a shot are still trademarks). Use it for b-roll
under a voice-over, for backgrounds behind lyrics or captions, and for "archival" looks (retro tech ads,
documentary, nostalgic lyric videos).

## Find shots

`agentcut_broll_search` searches by meaning: describe what the shot shows or what it should make the
viewer feel. Literal ("a clock on a wall", "assembly line", "crowd waving hats") and figurative ("waiting",
"progress", "lonely city at night") both work; try two or three phrasings for an important beat and pick
from the union. Filters: `color`, `backgroundOk` (calm, simple frames for text on top), `noPeople`, `calm`
(little movement), `minSeconds`.

Results describe each shot (from a vision model), its tags and mood, camera and motion, length and size.
Descriptions can be wrong: open the `thumb` of anything you're unsure of, and capture frames once placed.
Skip `textOnScreen` shots under captions (two texts fight) unless the sign is the point.

## Match footage to words (lyric and transcript videos)

1. `agentcut_transcribe` the voice or song; split it into lines or phrases.
2. For each line pick the image it calls for: the literal noun ("clock", "rain", "highway") or the feeling
   when there's no noun ("I'm still here" → a lone figure, an empty street). Search, choose, and never use
   the same shot twice; vary shot size (wide → close) between neighbours.
3. Cut a few frames before the key word (voice) or on the beat (music, `agentcut_analyze_audio`). Shots
   run 1.5–14 s; use `trimStart` to start on the best moment and `playbackRate` 0.5–0.8 to hold a short shot
   longer (archival footage takes slow motion well).
4. Lyrics or captions on top: prefer `backgroundOk` shots, keep text in the calm part of the frame, and
   dim busy shots with a dark scene layer above the footage.

## Place and finish

- `agentcut_add_broll` copies picks into `assets/broll/` at full quality (the same file exports). Put them
  on a video track: `"muted": true` (they're silent), `"fit": "cover"`.
- Most shots are 4:3 and SD (640×480). `cover` fills 16:9 and 9:16 by cropping: capture both variants and
  check the subject stays in frame. They look softer than modern footage, so treat that as the style:
  one consistent `grade` for every shot (e.g. mixing colour and black-and-white: `saturation: 0`,
  `contrast: 1.15`), film grain or a vignette as a scene on its own track, sharp modern type on top.
- Write a credits list in `notes.md` from the `credit` lines `agentcut_add_broll` returns (film, year,
  archive.org link). Public domain needs no credit, but the user may want to give one.
