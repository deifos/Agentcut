# Sound

You cannot hear. Every claim that a sound fits, lands on time or sits right in the mix needs a number from
the listen tools, written into notes.md (z, p_real, LUFS, onset).

## Layers

- **voice** track: one clip per take/line, `role: "voice"`, volume 1. Get word timings with
  `agentcut_transcribe` (model `small` for important cuts).
- **music** track: `role: "music"`, volume ≈ 0.25–0.4 under voice (check with critique), `fadeIn`/`fadeOut`
  of 10–30 frames, `loop` only for beds that loop cleanly. `agentcut_analyze_audio` gives tempo,
  beat frames, downbeats and per-frame energy; put markers on the drop and final hit.
- **sfx** track(s): one clip per hit. Keep hits sparse and meaningful (cuts, pops, the reveal, the end card),
  vary them, and keep them under the voice (volume 0.1–0.25 typical).

## Choosing a sound effect

The library first: real recordings sound expensive, and it has a sound for nearly every cue.

1. **`agentcut_sfx_catalog`**: 276 effects, nothing to install. **One call with no filters** returns a
   compact index of every sound (id, category, recorded, length, what it sounds like): plan from it, then
   call once more with `ids: [...]` for the full details of your picks (what it's for, `onsetS`, `peakS`
   and a `volume` that evens out its loudness). A query ("soft whoosh", "logo sting") or category (click,
   pop, swoosh, whoosh, impact, riser, sting, notify, shimmer, glitch, typing, foley, divider) that matches
   40 or fewer also returns full details. Don't page through the categories one by one.
   - `recorded: true` (source `agentcut`, 55 sounds): original real recordings. **Prefer these** when one
     fits. Their descriptions were measured by ear-models (earshot), so trust them over the file name:
     several "click-tech" sounds are tonal chimes and plucks, the "scramble" dividers are glassy rattles.
   - `recorded: false` (source `earshot`, 221 sounds): designed in code by earshot, including what the
     recordings don't cover: risers and downlifters, logo stings, sub drops, shimmers, notification
     chimes, glitches, typing runs, camera shutters. Several variants per family: use different ones so
     repeated cues don't sound identical.
   Add picks with `agentcut_add_sfx` (they land in `assets/sfx/`).
2. **The project's own `assets/` and the workspace `library:`** files.
3. **CC0 downloads** (Openverse, below) only when nothing above fits.

Then for the sounds you pick:

1. With several candidates, describe the sound plainly (source + action + character: "a single crisp
   computer mouse click", "a short airy whoosh moving left to right") and `agentcut_listen_rank` them.
   Prefer **z >= 3** ("strong").
2. Place it: clip `from` = the cue frame (press frame, pop-in start, cut) **minus `onsetS` in frames**. For
   whooshes and risers put `peakS` on the cut: taps and clicks lead the cut slightly, whoosh peaks land
   just after it, a riser stops on its loudest moment at the cut. Trim a long sound with the clip's
   duration rather than stretching it. Start from the catalog `volume`, then balance with the critique.
   Add a `note` with the cue and numbers.
3. Vary: never the same effect twice in a row.

Never synthesize sound effects yourself when the library has one: hand-made oscillator beeps read as cheap.

## Finding new files: Openverse (CC0)

Openverse is the WordPress project's open media search (read-only HTTPS API):

```
curl -G https://api.openverse.org/v1/audio/ --data-urlencode "q=whoosh" -d license=cc0 -d length=shortest -d page_size=12
```

- `length`: `shortest` (< 30 s), `short`, `medium`, `long`. Only `license=cc0` (no credit needed).
- Download each result's `url` into a new empty folder under a name you choose, check with ffprobe if available, copy the ones you
  keep into `assets/sfx/`, rank and check them with the listen tools, and record `foreign_landing_url` in
  notes.md.
- Anonymous limits: 20 requests/minute, 200/day. Space requests ≥ 4 s apart (HTTP 429 → wait).

## Check the mix

`agentcut_listen_critique` mixes the project exactly as the export will and reports loudness vs
−14 LUFS, true peak, clipping, silent gaps, voice-over-music balance (voice should sit ≥ 6 LU above music
where both play) and SFX cue timing (onset vs nearest scene start/marker). Fix and run it again. The export
masters the rendered audio to −14 LUFS with a true-peak limiter (≤ −1 dBTP after encoding) and reports
what it did (`mastering`: rendered loudness, gain, limiter reduction). Large limiter reduction (> 3 dB)
means a few sounds are far louder than the rest: turn those clips down instead of relying on the limiter.

## Voice-overs

The user connects their own voice provider under **Voices** in the studio header (ElevenLabs, Google
Gemini, OpenAI or Grok/xAI). You never see, ask for or mention API keys: the helper adds them.

1. `agentcut_voice_options`: which providers are set up, the default, models and voices. For
   ElevenLabs pass `provider: "elevenlabs"` to get the account's voice ids. If nothing is set up, ask the user
   to open **Voices** and add a key, and stop there.
2. Write the script in `notes.md` first (one line per beat). Keep the spoken text clean: no stage directions.
3. `agentcut_generate_voice` with the user's provider/model/voice (or the default). Generate 2 takes
   for anything that matters. Delivery notes:
   - Gemini, OpenAI: `style` ("confident tech launch announcer, upbeat, quick pace, smile on the call to
     action"; pronunciations like "say V2 as 'vee two'"). Gemini voices: Puck (upbeat), Kore (firm),
     Charon (informative), Zephyr (bright), Fenrir (excitable)… OpenAI: marin, cedar (best).
   - ElevenLabs v3/v4: audio tags inside the text (`[excited]`, `[whispers]`, `[pause]`).
   - Grok: inline tags (`[pause]`, `[laugh]`, `<whisper>…</whisper>`) and `speed` 0.7–1.5.
4. Check every take: `agentcut_media_info` (length) and `agentcut_transcribe` (each
   word said right, nothing invented). Keep the best take, put it on the Voice track, time scenes and captions
   to its word timings.
5. If a provider call fails (quota, bad voice id), say what failed in one line and offer another provider or
   voice the user has set up.

## Music

Where a song comes from, in order (never download music from the web: it's slow and fails often):

1. **A file the user gives you** (in `assets/`, or one they point at): use it.
2. **The Agentcut music library** unless the user asks for a new song: 224 licensed tracks, each
   measured (tempo, energy 1–5, intro length, drops, ending, shape) and tagged (moods, genres,
   instruments, vocals). Search `agentcut_music_catalog` in plain words for the video's feel
   ("high energy no vocals", "calm 90 bpm", "cinematic dark", "playful") with `minSeconds` = video
   length; pick 3–6 candidates whose energy and shape fit the edit (a drop near the reveal, an intro
   you can trim, `vocals: false` under a voice-over), `agentcut_add_catalog_music`, then rank them with
   `agentcut_listen_rank` / `_tags` against a plain description of the mood, keep the best, delete
   the other candidates from `assets/music/`, and say which song you used and why.
3. **Lyria (Google)** when the user asks for a new song, or the library isn't available or has nothing
   that fits, and `agentcut_music_options` says it's available (the user's Gemini key). Write the prompt like a brief:

   ```
   Instrumental only, no vocals, no singing, no humming. Total length: 48 seconds.
   A happy, warm and professional music bed for <what the video is>. <mood words>. Key of D major,
   a steady 112 BPM from start to end. Instruments: <4–8 instruments>. Clean modern mix, no lo-fi crackle.
   [0:00 - 0:06] Intro: <what happens, how it feels>
   [0:06 - 0:15] <section>: … a soft rising swell in the last two seconds.
   [0:15 - 0:28] The groove starts: full groove kicks in on the downbeat at 0:15 …
   [0:38 - 0:45] Final chorus: biggest part, then a clean final hit on the downbeat at 0:44.
   [0:45 - 0:48] The last chord rings out softly and fades to silence.
   ```

   Put the section times on the video's beats (the reveal, the drop, the end card), so the music is
   written for the cut. Match the look of the app/brand in the mood words. Never name artists or songs.
   `agentcut_generate_music` with `takes: 2`, then for each take: `agentcut_media_info`,
   `agentcut_analyze_audio` (tempo, beats, where the drop really lands) and
   `agentcut_listen_tags` (no vocals if you asked for none). Keep the best take, line its drop up
   with the reveal (move the clip or nudge the cuts to its beats), and tell the user which take and why.
4. **Composed in code** when neither the library nor Lyria is available (or the user asks for code):
   write a synthesis script in the project's `scripts/` folder and run it.
   - Python with numpy/scipy if `python -c "import numpy, scipy"` works (try `python3` and `py` too);
     otherwise a Node script (`node scripts/make_music.mjs`) that writes a 16-bit 44.1 kHz WAV itself.
   - Plan the song map in the script's header first: BPM (120 → 1 beat = 15 frames at 30 fps), bars, and
     which bars play under which scene, with a build and a gap before the drop on the reveal.
   - Make it sound produced, not like beeps: layered drums (kick with pitch drop, snare = noise + tone,
     hats from filtered noise), a bass line, chords with detuned voices and soft attacks, a melody/hook,
     reverb (convolve with a short decaying-noise impulse) and a gentle limiter; sidechain the chords to
     the kick. Normalize to about −14 LUFS.
   - Write it to `assets/music/<name>.wav`, then check it like a Lyria take. Tell the user it's composed
     in code (royalty-free, no samples).
   Mention once that a Gemini key under Voices gives them Lyria songs instead.

Never put a Suno artist tag or account name anywhere visible.

## Making sound effects

Only when the library and Openverse have nothing that fits (rank z < 1.5), or the user asks for a made
sound: synthesize it in a script (same runtime rules as music) into `assets/sfx/<name>.wav`: whooshes from
band-passed noise with a sweep and fade, pops from a short pitched sine with a fast decay, clicks from a
few ms of filtered noise, risers from noise + rising tone. Rank and measure it like any candidate and say
in notes.md that it's synthesized (`listen_realness` will be low; that's expected for a made sound).
