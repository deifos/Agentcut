# tiktok-style: high-retention vertical talking-head edit

## Purpose
Turn a flat, single-camera talking-head recording into a high-retention TikTok / Reels / Shorts video. Keep the speaker's
real face and original voice and add energy through cutting, framing, captions, graphics and sound. The first 3 seconds
must give the viewer a reason to keep watching.

## Inputs needed for a new video
- The talking-head footage (any aspect; the output is 9:16).
- A transcript with word timings (run `agentcut_transcribe` on the footage).
- The hook line for the opening text. Prefer a line the user gives you. Otherwise write one from a claim the speaker
  actually makes, and never invent results, numbers or claims.
- The one number or goal the video is about, if it has one (for the stat/progress graphic). Ask the user if a value
  such as the goal or currency is not stated in the footage.
- An object, gesture or detail in the shot that can carry the opening punch-in (optional).

## Rules

### Format
- Make the vertical 1080×1920 variant the main one (`defaultVariant: "mobile"`). Keep the wide variant workable, but
  design and review in 9:16 first.
- Keep the original footage file and its audio untouched. Every edit is a timeline cut or a crop on the clip.
- Turn off any project-style camera on the footage pieces (`camera: "none"`) so only your framing drives the moves.

### Hook (first ~3 s)
- Hard open: no fade-in, no title card, no logo. Frame 0 is already moving.
- Open on a fast zoom punch into a relevant detail in the shot (an object the speaker holds, a prop, a screen). Use
  a picture-only cutaway (a muted copy of the footage on a track above, with an animated crop) while the speaker's
  first kept line plays underneath from the main footage. Punch from about 0.8 to 0.5 of the source height in ~4
  frames, add a few frames of decaying shake, then push in slowly. Choose the detail from the new footage; skip the
  cutaway if nothing visual fits and punch in on the face instead.
- Bold kinetic hook text over the opening for about 3.2 s (~96 frames at 30 fps), in the upper part of the vertical
  frame (starting around 17% from the top):
  - Line 1 slams in from very large (scale ~2.4 → 1) with a slight tilt and a short white flash (opacity ~0.7 → 0
    over ~5 frames).
  - Line 2 follows ~0.4 s later and pops up from below.
  - The single punch word lands ~0.8 s in as a yellow sticker (dark text on the accent colour, thick black border,
    hard drop shadow, slight rotation) that scales down from ~2.2× with a decaying shake.
  - Exit with a short fade-and-rise in the last ~7 frames.
- Hard-cut from the cutaway to the face (tight framing) on the first word of the next strong line. Put a whoosh on
  that cut.
- Open on the strongest, most specific claim in the footage (a result, a number, a surprise). Cut a slow greeting or
  intro ("hello everybody, welcome to…") from the start. Reorder only when the meaning stays accurate.

### Speech cleanup
- Remove the slow intro, clear stumbles (a word restarted or a stray letter after a word), doubled words ("I… I"),
  and pauses between thoughts. Cut ~2–4 frames before the next word starts and never inside a word.
- Keep the speaker's lines in their original order after the hook.
- Check suspected stumbles in the transcript by listening before cutting. Filler-word removal was not part of the
  source edit, so cut fillers only where the transcript and audio clearly show them.

### Jump cuts and zoom emphasis
- Cut every 1.5–2 s (≈42–62 frames at 30 fps, aiming for ~52). Put each cut on a word start (cut 1 frame before the
  word). If no word starts in that window, cut at ~54 frames. Don't leave a final piece shorter than ~30 frames.
- Each cut changes the framing, using three crop levels on the face (as fractions of source height, crop aspect
  matched to the output):
  - wide 1.0
  - mid 0.86
  - tight 0.72
  Normal lines alternate wide ↔ mid. Key lines (the main number/result, admissions, the big plan) get tight. Never
  repeat the same level on two pieces in a row.
- Inside every piece, push in slowly by ~5% of crop height from start to end (`variants.<v>.framing.path`).
- Keep the face around 40% from the top of the vertical frame. When a graphic sits at the top, lower the face to
  ~52% for those pieces so the graphic never covers it.
- Shake + mini zoom punch on single key words (the number, the punchline, a strong verb): crop zooms ~7% tighter and
  jitters ±~1.8% of the crop for ~12 frames (keyframes every 2 frames, decaying), then returns to the push-in. Use it
  on a handful of words per video, not on every line.
- Transitions are hard cuts only. There are no dissolves, wipes or slides between footage pieces.

### Captions
- Auto-captions for all speech, timed to the words and re-mapped through every cut. Use a custom scene clip that takes
  `words` (text, from, to, em) in props so the words stay editable.
- Show at most 3 words at a time. Break groups at punctuation, at pauses longer than 8 frames, and so that two
  emphasis words don't share a group. Hold the last group ~10 frames, or until the next group starts.
- Look: Inter 900, uppercase, letter-spacing −1 px, white with a thick black outline (stacked text-shadows) and a
  soft drop shadow. Size 86 px in vertical (66 px wide), centred, 8% side margins. Vertical centre at ~66% of frame
  height in 9:16 (80% in wide), in the safe area below the face and above the platform UI.
- Each word pops in on its start frame: from scale ~0.7, rising ~18 px, snappy spring.
- Emphasis words (the number, key nouns/verbs, negations, the payoff): accent yellow, 1.28× size, larger pop (scale ~1.7
  → 1, tilt −8° → −2°). Pick them from the new transcript, roughly one every 1–3 s of speech.

### Graphics and animation
- One accent colour across hook sticker, caption emphasis and graphics: yellow #FFE14D. Everything else is white,
  black outlines and dark translucent cards. Leave the footage's own colours as shot.
- Type: Anton for hook text and big numbers, Inter (800/900) for labels and captions.
- If the video has a key number or goal, add an animated stat graphic when the speaker says it:
  - A dark card (gradient rgba(18,18,28,0.92) → rgba(8,8,14,0.9), 2 px light border, ~30 px radius, deep shadow) pops
    in at the top of the frame just before the number is spoken.
  - It counts the number up while a progress bar (yellow gradient fill with glow) fills to the stated percentage,
    ending on the last word of the number.
  - It pulses once at the end of the fill.
  - When the speaker finishes that thought, it shrinks into a slim persistent top bar (label · value · %) that stays
    to the end of the video.
  Take values from the footage or the user, never guess them, and keep them as editable props.
- Springs for entrances, eased exits. Graphics never cover the face for long, and text stays inside safe areas.

### Sound
- Voice: the original footage audio at full level. Never replace or re-voice it.
- Music: an upbeat lo-fi / hip-hop instrumental with no vocals from the music library, chosen by ranking 3–6 candidates
  against "upbeat lo-fi hip hop beat with warm keys and punchy drums, instrumental". It starts at frame 0 at full level
  (no fade-in), volume ~0.14 under the voice, and fades out over the last ~30 frames.
- SFX: sparse, all from the library, one per visual cue, never the same sound twice in a row, volume ~0.5–0.6 (a
  whoosh up to ~0.9):
  - short punchy impact on the hard open
  - low thunk when the hook's punch word lands
  - airy whoosh with its peak on the cut to the face
  - bubble pop when the stat card appears
  - bright chime when the bar finishes filling
  - soft swoosh when the card docks
  - pop or swoosh on a couple of shake words
  - small chime on the sign-off line
  Place each at cue frame minus the sound's onset (whoosh peaks on the cut).

### Pacing
- Something changes at least every 1.5–2 s: a cut with a new framing level, a caption group, an emphasis pop or a
  graphic beat.
- Expect the edit to run noticeably shorter than the raw take, because the intro and dead air come out.

## Review steps
1. `agentcut_status` after every timeline/scene change; fix build errors at once.
2. Capture 9:16 frames at:
   - the hook (frame ~2, mid-slam, punch-word landing, last cutaway frame, first face frame, hook exit)
   - the stat card's entrance, fill end and dock
   - several caption groups, including emphasis words
   Check outline legibility, safe areas, that the face isn't covered, and that tight crops keep the whole face.
3. Contact sheet across the whole edit in 9:16.
4. Listen across cut boundaries for clipped words; `agentcut_listen_critique` for loudness (−14 LUFS target), voice ≥ 6 LU
   above music, and SFX timing. Adjust music volume from the critique, not the 0.14 starting value alone.
5. Write what changed and what was checked in the project's notes.md.

## Evidence notes (where these rules come from)
- **Confirmed intent (the user's written brief):**
  - hard-cut opening with bold kinetic hook text over a zoom punch on an object in the shot
  - jump cuts every 1.5–2 s
  - auto-captions with emphasis pops
  - a progress-bar graphic filling to a stated percentage
  - subtle zoom/shake on key lines
  - an upbeat lo-fi beat under the voice
  - keep the original face and audio
  - hooks that make the first 3 seconds force a watch
  - TikTok as the destination
- **Observed in the source edit, chosen by the editor (not separately confirmed by the user):**
  - 9:16 as main variant
  - the three crop levels and 5% push-in
  - shake/zoom-punch values
  - the hook layout and timings
  - yellow #FFE14D accent
  - Anton + Inter
  - caption size, position, 3-word groups and pop springs
  - stat-card design and docking behaviour
  - removal of the greeting intro, a stumble and a doubled word
  - music level 0.14 with a 30-frame fade-out
  - the SFX set and ~0.5–0.6 volumes
- The source edit's frames and mix were **not visually or audibly reviewed** before this style was saved: a frame
  capture hung, so no captures, contact sheet or `listen_critique` results exist. Treat sizes, positions and levels
  as starting values and verify them on the new video.

## Limits and unknowns
- No B-roll was used, so B-roll selection and placement rules are unknown. Don't add B-roll unless the user asks;
  if they do, choose fresh shots relevant to the new content.
- No user feedback on the result was given, so it is unknown whether the user approved the hook styling, colours,
  caption look or mix.
- Filler-word handling was not tested (the source transcript showed almost none).
- Wide-variant layout was set up but not designed or checked. Re-check it if a 16:9 version is needed.
- Don't reuse the source's text, numbers, currency, goal, names or timeline positions. Write fresh hook text, emphasis
  choices, graphic values and sound placement from the new footage and transcript.
