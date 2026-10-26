# B-roll indexer

Builds Agentcut's archival b-roll catalog from public-domain films on archive.org: every shot gets a
description and search tags (a local vision model through Ollama), a SigLIP vector (Transformers.js),
motion and camera numbers (ffmpeg), a thumbnail, and two cuts (`preview.mp4` for editing, `full.mp4`
for export). The output folder has the same layout as the CDN (`agentcut/broll/`).

Runs on your own machine, no API keys. Needs Node 20+, ffmpeg/ffprobe on PATH and
[Ollama](https://ollama.com) with a vision model (`gemma3:4b` by default, `BROLL_DESCRIBE_MODEL` to change).

```bash
npm install
BROLL_DATA=/path/to/data node index.mjs all             # films from films.json
BROLL_DATA=/path/to/data node index.mjs all SomeFilmId   # or name archive.org ids
BROLL_DATA=/path/to/data node serve.mjs                  # search page on http://127.0.0.1:4848
```

Steps (`node index.mjs <step> [ids]`, each resumes where it stopped): `fetch` (public-domain only),
`shots`, `analyze`, `measure`, `describe`, `embed`, `cut`, then `build` (writes `out/shots.json` and
`out/vectors.i8`) and `report` (timings and sizes). `pipeline films-v1.json` runs every step per film,
downloading the next film while the GPU describes the current one, and rebuilds the index after each film.
`select.mjs` picks a varied film list (see `films-v1.json`).

`BROLL_DATA` holds `films/` (downloads), `work/` (per-film records and frames), `out/` (what gets
published) and `cache/hf/` (the SigLIP model).

## Publishing

`sync.mjs` uploads `out/` to R2 under `agentcut/broll/` (new files only, the index last, so the live catalog
never mixes two builds). Point the site's `NEXT_PUBLIC_BROLL_CDN_URL` at that folder's public URL.

```bash
BROLL_DATA=/path/to/data BROLL_ENV_FILE=/path/to/.env node sync.mjs            # once
BROLL_DATA=/path/to/data BROLL_ENV_FILE=/path/to/.env node sync.mjs --loop 30  # every 30 min while indexing
```

The env file needs `CLOUDFLARE_BUCKET_API`, `CLOUDFLARE_ACCESS_KEY_ID`, `CLOUDFLARE_SECRET_ACCESS_KEY` and
`CLOUDFLARE_BUCKET_NAME` (`BROLL_PREFIX` changes the folder). The bucket's CORS rules must allow GET from the
site's origin (the studio and the b-roll page download shots with `fetch`).
