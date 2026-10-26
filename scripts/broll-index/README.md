# B-roll indexer

Builds Agentcut's archival b-roll catalog from public-domain films on archive.org: every shot gets a
description and search tags (a local vision model through Ollama), a SigLIP vector (Transformers.js),
motion and camera numbers (ffmpeg), a thumbnail, and two cuts (`preview.mp4` for editing, `full.mp4`
for export). The output folder has the same layout as the CDN (`broll/v1/`).

Runs on your own machine, no API keys. Needs Node 20+, ffmpeg/ffprobe on PATH and
[Ollama](https://ollama.com) with a vision model (`gemma3:12b` by default, `BROLL_DESCRIBE_MODEL` to change).

```bash
npm install
BROLL_DATA=/path/to/data node index.mjs all             # films from films.json
BROLL_DATA=/path/to/data node index.mjs all SomeFilmId   # or name archive.org ids
BROLL_DATA=/path/to/data node serve.mjs                  # search page on http://127.0.0.1:4848
```

Steps (`node index.mjs <step> [ids]`, each resumes where it stopped): `fetch` (public-domain only),
`shots`, `analyze`, `measure`, `describe`, `embed`, `cut`, then `build` (writes `out/shots.json` and
`out/vectors.f32`) and `report` (timings and sizes).

`BROLL_DATA` holds `films/` (downloads), `work/` (per-film records and frames), `out/` (what gets
published) and `cache/hf/` (the SigLIP model).
