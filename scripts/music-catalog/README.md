# Music library

The built-in music library is what the studio's music picker and the agent's music search use. Three parts:

| Part | Where | In git |
| --- | --- | --- |
| The MP3s | R2, served at `https://media.vladpalacio.com/screenslick-music/<Name>.mp3` | no |
| The list (id, name, file, category, length) | `lib/music-tracks.ts` | yes |
| The analysis (tempo, energy 1–5, vocals, moods, genres, instruments, intro, drops, ending, shape) | `lib/music-analysis.json`, made by `analyze.py` | yes |

A song that is listed but not analyzed fails `npm run test:music`, and the agent can't find it by mood or tempo.

## Add a song

```bash
npm run music:add -- path/to/song.mp3 --name "Night Drive Loop" --category electronic
```

This does the whole job:

1. Checks the name and id are free and the category exists. Converts WAV, M4A, FLAC and similar files to
   320 kb/s MP3 (an MP3 is uploaded as it is), then reads the length.
2. Uploads the song to R2 as `screenslick-music/<Name>.mp3` and checks that the public URL serves it. If the
   same file is already there it skips the upload. If a different file has that name, it stops unless you pass
   `--force`.
3. Adds the entry at the end of its category in `lib/music-tracks.ts`.
4. Runs `analyze.py`, which measures and tags only the new song, then recomputes the library-relative fields
   (energy, typical tags) for all songs. It prints the result, for example
   `night-drive-loop: 126 bpm, energy 4/5, instrumental, tech house, futuristic ▃▅▆▇...`.

Then:

```bash
npm run test:music
```

Add a line under **Unreleased** in `CHANGELOG.md` (for example "Music library: added Night Drive Loop
(electronic)"). Commit `lib/music-tracks.ts` and `lib/music-analysis.json`. The song shows up once the site is
deployed. The MP3 is live as soon as it is uploaded, but nothing links to it until then.

**Options:** `--dry-run` checks everything and prints what it would do, without changing anything.
`--id <slug>` sets the id (by default it is made from the name). `--no-analyze` skips step 4, so you run
`analyze.py` yourself later. `--force` replaces a different file already uploaded under that name.

**Name and category.** The name is what people see in the picker, and the file is `<Name>.mp3`. Use a short
title (letters, numbers, spaces, `' & , . ( ) ! -`), different from every listed song. Pick one of the
categories: `energetic`, `chill`, `cinematic`, `electronic`, `ambient`. Search also uses the analysis tags, so
the category only needs to be the closest fit.

**Rights.** Only add songs you may redistribute in videos people publish: your own, Suno songs made on a paid
plan, or tracks whose licence allows it. For Suno, download the MP3 (or WAV) from the song's page; it costs a
download credit.

## Setup (once per machine)

- **ffmpeg and ffprobe** on `PATH`.
- **R2 keys**, the same ones `scripts/broll-index/sync.mjs` uses. Put them in the repo's `.env.local`, which is
  git-ignored:

  ```
  CLOUDFLARE_BUCKET_API=https://<account id>.r2.cloudflarestorage.com
  CLOUDFLARE_ACCESS_KEY_ID=...
  CLOUDFLARE_SECRET_ACCESS_KEY=...
  CLOUDFLARE_BUCKET_NAME=...
  ```

  You can also set them in the shell environment, or keep them in another file and pass `--env <file>` (or set
  `MUSIC_ENV_FILE` / `BROLL_ENV_FILE`). When a key is set in more than one place, `--env` wins, then the shell
  environment, then `.env.local`. The keys need write access to the bucket behind `media.vladpalacio.com`. Create
  them in Cloudflare → R2 → Manage API tokens, with Object Read & Write on that bucket. They are read, never
  printed.
- **The earshot venv** for the analysis (CLAP + librosa + pyloudnorm). The default is
  `E:/projects/earshot/.venv`. Use `EARSHOT_DIR` for another checkout, or `EARSHOT_PY` for a specific python.

The first analysis on a machine measures every song. Songs missing from `scripts/music-catalog/cache/` are
downloaded from the CDN, which takes a while. The results are kept in `scripts/music-catalog/out/raw.json`
(git-ignored), so later additions only measure the new song. Delete `raw.json` to re-measure everything.

## Re-run the analysis by hand

```bash
<earshot venv>/Scripts/python.exe -I scripts/music-catalog/analyze.py [folder with the MP3s]
```

Use this after a `--no-analyze` add, after editing `lib/music-tracks.ts` by hand, or after changing
`analyze.py`. Energy and the "typical tag" thresholds are relative to the whole library, so adding songs can
shift other songs' values slightly. That is expected in the diff.

## Remove or rename a song

Edit or delete its entry in `lib/music-tracks.ts`, then re-run the analysis. You can change `name` and `id`.
Keep `filename` as it is, because projects refer to a song by its file URL. Leave old objects on R2, so
projects that already use a song keep working.
