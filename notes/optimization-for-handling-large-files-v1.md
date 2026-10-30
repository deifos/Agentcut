# Optimization for handling large files, v1

Goal: the Agentcut editor handles big files and long footage (4 to 6 hours) reliably, and stays in the browser.

- **Date:** 2026-10-30
- **Code tested:** `9f1b2e6`. Line references were rechecked against `dadc41d`, which only removes a header button.
- **Status:** investigation and plan. No application code has changed.

## How to read this report

Every claim carries one of these labels:

| Label | Meaning |
|---|---|
| **[M]** | Measured by running the real app or a real tool against real files |
| **[C]** | Read directly in the code, at the cited line |
| **[D]** | Calculated from measured numbers. The arithmetic is shown |
| **[O]** | Open. Not tested. Listed in section 9 so nobody mistakes it for a result |

## 1. Summary

**Stay in the browser. Don't rewrite in Rust, and don't build separate Mac or Windows apps.** The browser plus the existing local helper can do this job. What needs replacing is a handful of code paths that load whole files into memory, plus a few hard limits and timeouts.

Today's state on a real 6-hour, 29.7 GB file:

| Area | Result today | Label |
|---|---|---|
| Preview playback, including at 5h30m | Works, 0% dropped frames, about 0.6 GB of memory | [M] |
| Frame capture at any position | Works, about 0.6–1.0 s | [M] |
| Adding the file through Simple view | Refused above 2 GB | [C] |
| Adding the file through Assets | Refused above 4 GB, after 98 s of sending it | [M] |
| Reading the file's info | Wrongly reports `hasAudio: false` | [M] |
| Decoding audio (mix, waveform, loudness, transcription) | Fails at 2 h of stereo, crashes the tab at 3 h | [M] |
| Browser export | Fails after the render once the output passes 4 GiB, about 92 minutes | [M] [D] |
| Local render | Needs free temp space for all assets, and takes about 12 hours | [M] [D] |
| Render progress in the page | Gives up after 1 hour | [C] |
| Transcription | Refuses sources over 2 GB, and stops at 20 minutes | [C] |
| Timeline | "Fit" stops fitting beyond about 15 minutes, and creates 43,000 DOM nodes when zoomed in | [M] |
| A long edit with 2,000 cuts | Preview drops about 80% of frames | [M] |

The fixes, in order of priority:

1. Stream audio instead of decoding whole files.
2. Remove the size caps, and write to disk instead of memory.
3. Stop copying footage to temp, render in resumable chunks, and run renders as background jobs.
4. Send plain-footage sections straight to ffmpeg.
5. Virtualize the timeline, and mount only the clips near the playhead.

The fixes were prototyped where possible. Streaming audio handled the same 6-hour file in 104 s with 0.83 GB of memory **[M]**. Reading media info took 258 ms instead of decoding the file **[M]**. Chunked rendering doubled render speed and produced a frame-exact file **[M]**.

## 2. Corrections to my earlier advice

Testing overturned three things I said before this investigation:

| What I said | What the tests show |
|---|---|
| Raise the render worker count on big machines | **Wrong for this machine.** More workers got slower: 14.9 fps at 2 workers, 8.1 fps at 11 [M]. Separate chunked processes are what scale |
| Build preview proxies early | **Lower priority.** 4K60 dropped 7% against 5.5% with a proxy on the RTX 3060, and 9–12% against 5.5% with GPU decoding disabled [M]. Proxies are still useful for ProRes and possibly weak machines |
| JPEG quality 80 hurts local render quality | **Not on this footage.** SSIM was 0.9892 at quality 80, 0.9902 at 100, and 0.9890 with PNG [M]. Graphics and small text are untested [O] |

## 3. Test setup

- **Machine:** Windows 11, AMD Ryzen 5 3600 (6 cores, 12 threads), 64 GB RAM, RTX 3060, WD_BLACK SN770 SSD. Both drives were about 95% full.
- **Browser:** Chrome 156 in `--headless=new` mode, with WebGPU on the NVIDIA adapter. Disabling hardware video decoding raised memory use from 0.58 to 1.62 GB on the 4K60 file, which shows it was active **[M]**.
- **App:** the real studio page from the Next dev server, against a second helper on another port with its own workspace. The running helper and your projects were not touched, apart from reading files to copy them.
- **Test file:** a real 2:52 camera take, 1080p H.264 at 10.8 Mbps with mono AAC, joined 125 times without re-encoding and cut to exactly 6 hours. That made 29.7 GB, with 648,000 frames at 30 fps and a 23.8 MB index at the end of the file.
- **Other files:** 6-hour stereo AAC, cut to 1, 2, 2.5, 3 and 4 hours. Also 4K60 H.264 at 80 Mbps, 4K HEVC 10-bit at 60 Mbps, and 1080p ProRes 422.
- **Real project:** a copy of `test-2`, with 7 scene files and 2,756 frames.

Commands to recreate the main file:

```sh
# list.txt repeats: file 'take.mp4' (126 lines)
ffmpeg -f concat -safe 0 -i list.txt -t 21600 -c copy 6h-1080p-11mbps.mp4
```

The test scripts and raw results are in `E:\agentcut-largefile-lab\scripts` and `results`. They are not in this repo.

## 4. Measurements

### 4.1 What already works

| Test on the 6-hour file | Result | Label |
|---|---|---|
| Preview, 10 s at the start and at 5h30m | 300/300 frames, 0 dropped, 0 stalls | [M] |
| Memory during preview | 0.63 GB largest process | [M] |
| Frame capture at 0, 3h, 5h30m | 0.6–1.0 s | [M] |
| 54,000-word captions clip (2.5 MB `layers.json`) | 0 dropped, capture 0.75 s | [M] |
| Render speed: huge file vs 10-minute file | 14.9 vs 14.3 fps | [M] |
| Render speed: start of file vs 5h30m | 14.9 vs 15.0 fps | [M] |
| Opening the file with mediabunny over HTTP | 258 ms | [M] |
| Reading a `File` in the browser, then seeking to 5h30m | Open 31 ms, seek and decode 167 ms | [M] |

File size and position cost nothing during playback or rendering, because the helper already serves byte ranges (`packages/agentcut/src/studio/http.ts:95-122`) **[C]**.

Format support in Chrome on this machine **[M]**:

| Format | Decode | Preview |
|---|---|---|
| H.264, 4K60, 80 Mbps | Hardware | 6.5–7.2% dropped |
| HEVC 10-bit, 4K | Hardware only | 0–1% dropped |
| VP9, AV1 | Hardware and software reported | Not played |
| ProRes 422 | Not supported | Capture fails with a decoder error (section 5.8) |

### 4.2 Audio decoding

`decodeAudioUrl` fetches the whole file and decodes all of it (`lib/studio/audio/decode.ts:40-43`) **[C]**. These callers all go through it **[C]**: `mix.ts:44`, `peaks.ts:10`, `transcribe.ts:88`, `analyze.ts:51`, `media-info.ts:40,53`, `listen/index.ts:67,107`, `listen/critique.ts:358`, `listen/models.ts:211`.

| Stereo length | `mediaInfo` result | Largest process | Label |
|---|---|---|---|
| 1 h | Works, 8 s | 3.4–4.0 GB | [M] |
| 2 h | `Unable to decode audio data` | 7.0 GB | [M] |
| 2.5 h | `Unable to decode audio data` | 8.3 GB | [M] |
| 3 h | **Page disconnects** | 9.6 GB | [M] |

Other measured browser limits **[M]**:

- `new AudioBuffer` works for 2 h stereo at 48 kHz and fails at 4 h. Lengths between those weren't tried.
- `ArrayBuffer` works at 8 GB and fails at 16 GB.
- Mediabunny's `BufferTarget` fails at 4 GiB.

The streaming prototype, using `AudioBufferSink` and `UrlSource`, read 6-hour stereo AAC and computed 100 peaks per second in **104 s using 0.83 GB**. The peaks use 8.6 MB **[M]**.

### 4.3 Export and mastering

Browser export of a 10-minute plain-footage project **[M]**:

- 18,000 frames in 297 s, or 60.5 fps.
- 465.8 MB output at 6.21 Mbps.
- 4.2 GB memory peak during loudness planning. The project used only 10 minutes of the file, but `mix.ts:44` decodes all 6 hours of its audio.

`masterExport` on longer files **[M]**:

| Input | Result | Largest process |
|---|---|---|
| 1 h, stereo PCM, tiny video | Works in 97 s, −14.16 LUFS | 7.3 GB |
| 2 h, stereo PCM, tiny video | `RangeError: Array buffer allocation failed` | 10.5 GB |
| 1 h, stereo PCM, 11 Mbps video (5.17 GB) | `ArrayBuffer exceeded maximum size of 4294967296 bytes` | 11.0 GB |

The failures come at the mastering stage, **after the whole render has finished** (`lib/studio/export.ts:173-177`) **[C]**.

Other export results:

- A 1-second project using a 3-hour stereo file disconnects the page when exported **[M]**. Its audio is decoded in full during loudness planning.
- 4 GiB at 776,280 bytes per second is 5,533 s, about **92 minutes of output** **[D]**.
- OPFS grew 0.53 GB per 10 minutes, so 6 hours needs about 19 GB. The browser reported about 10 GiB available on this nearly full disk **[M] [D]**.

### 4.4 Render speed

Local renderer, plain footage, samples of 90–150 s **[M]**:

| Setup | Total fps |
|---|---|
| 1 process, 1 worker | 11.6 |
| 1 process, **2 workers (today's default)** | **14.9** |
| 1 process, 4 workers | 13.9 |
| 1 process, 6 workers | 11.8 |
| 1 process, 8 workers | 10.4 |
| 1 process, 11 workers | 8.1 |
| 3 processes, 2 workers each | 25.2 |
| **4 processes, 1 worker each** | **30.2** |
| 6 processes, 1 worker each | 32.1 |
| 8 processes, 1 worker each | 32.5 |

Real motion graphics project, samples of 75 s **[M]**:

| Setup | Total fps |
|---|---|
| 1 process, 1 worker | 11.7 |
| 1 process, 2 workers | 14.4 |
| 1 process, 4 workers | 14.7 |
| 1 process, 8 workers | 10.7 |
| 4 processes, 1 worker each | 32.2 |

Why extra workers in one process slow down is not established **[O]**. The numbers apply to a 6-core CPU, so the best count must be measured on other machines (task 3.3).

A full 10-minute project rendered in four chunks **[M]**:

- 604 s total, or 29.8 fps.
- Exactly 18,000 frames with 0 decode errors.
- `combineChunks` joined them in 2.2 s.
- SSIM against the source was 0.9886.

Browser export against local on the real project **[M]**:

- Local: 281 s in your own earlier render.
- Browser: **not finished after 1,500 s**.

The browser is about 4× faster on plain footage and at least 5× slower on this motion graphics project. This was headless Chrome, so it needs one retest in a normal window before being treated as final **[O]**.

### 4.5 Direct ffmpeg

On the 6-hour file **[M]**:

| Operation | Time |
|---|---|
| SHA-256 of the whole file | 55 s |
| Extract all audio as 16 kHz mono | 39 s |
| Copy all audio to `.m4a` | 28 s |
| Seek to 5h30m and decode 1 frame | 0.3 s |
| Copy 60 s from 5h30m without re-encoding | 0.4 s |
| 360 thumbnails from keyframes | 168 s |
| 540p proxy, 1 hour | 371 s, 283 MB |

Encoder comparison, 1080p, 120 s, against the source **[M]**:

| Encoder | Speed | Bitrate | SSIM |
|---|---|---|---|
| x264 `medium`, CRF 18 | 43 fps | 8.4 Mbps | 0.9909 |
| x264 `veryfast`, CRF 18 | 109 fps | 7.0 Mbps | 0.9895 |
| NVENC `p5`, CQ 19 | 277 fps | 12.3 Mbps | 0.9925 |
| NVENC `p7` HQ, CQ 17 | 171 fps | 15.6 Mbps | 0.9935 |
| Browser export, `high` | 60 fps | 6.2 Mbps | 0.9895 |
| Local render today | 15 fps | 10.4 Mbps | 0.9885 |

The NVENC figures show that a GPU encoder can match x264 on this footage if it's given more bitrate. This is one clip, so it's evidence for this footage only.

Mixing paths also worked. A Remotion chunk, an ffmpeg x264 chunk and a second Remotion chunk joined without re-encoding gave exactly 13,500 frames and 0 decode errors **[M]**. Average color was within 0.5 of 255 across the source, the Remotion chunk, the ffmpeg chunk and the browser export **[M]**. The container's color tags differ between paths, and I didn't inspect the seams by eye **[O]**.

### 4.6 Time for a 6-hour plain-footage render

All of these are 648,000 frames divided by measured speed **[D]**:

| Path | Speed | 6 hours | 4 hours |
|---|---|---|---|
| Local render today | 14.9 fps | 12.1 h | 8.1 h |
| Browser export, if its limits were removed | 60.5 fps | 3.0 h | 2.0 h |
| Four local chunks | 29.8 fps | 6.0 h | 4.0 h |
| Direct ffmpeg, x264 `medium` | 43 fps | 4.2 h | 2.8 h |
| Direct ffmpeg, NVENC `p7` | 171 fps | 63 min | 42 min |

### 4.7 Timeline

Viewport was 1,566 px wide, 6-hour project **[M]**:

| State | Scroll width | Timeline DOM nodes | Filmstrip tile width | Worst long task |
|---|---|---|---|---|
| Fit, 1 clip | 32,617 px | 793 | 2,314 px | |
| Zoomed to max, 1 clip | 2,592,217 px | 43,273 | 185,143 px | 724 ms |
| Fit, 2,000 clips | 32,617 px | 10,774 | 14 px | |
| Zoomed to max, 2,000 clips | 2,592,217 px | 81,254 | 92 px | 1,990 ms |

Preview against clip count, one video track on the same footage **[M]**:

| Clips | Dropped frames | Capture time |
|---|---|---|
| 1 | 0% | 0.7 s |
| 100 | 15–19% | 1.1 s |
| 500 | 62–63% | 2.5 s |
| 1,000 | 76–77% | 3.8 s |
| 2,000 | 78–81% | 7.4 s |
| **2,000, mounting only clips near the playhead** | **10–14%** | 6.6 s |

The last row used a temporary patch in the test workspace. It confirms the cause for playback, but captures need separate work.

### 4.8 Transcription

Browser Whisper `base` on WebGPU took 202 s for 600 s of audio, with 1.85 GB peak and 118 KB of result JSON **[M]**. Scaled up **[D]**:

- The 20-minute limit is reached at about 59 minutes of audio.
- 6 hours would need about 2 hours.
- A 6-hour transcript would be about 4.2 MB of JSON returned to the agent.

## 5. Findings

Each finding has a matching task in section 7.

### 5.1 Size caps block long footage before anything starts

| Cap | Where | Equals at 11 Mbps [D] | Label |
|---|---|---|---|
| 2 GiB, Simple view and chat upload | `components/studio/ChatReferences.tsx:33,71` | 26 min | [C] |
| 2 GiB, transcription source | `packages/agentcut/src/studio/transcription/service.ts:113` | 26 min | [C] |
| 4 GiB, Assets upload | `packages/agentcut/src/studio/http.ts:36,204` | 52 min | [M] |

The 29.7 GB upload returned 413 only after 98 s, because the browser finished sending the body before it read the response **[M]**. Below the cap, uploads stream to disk at 232 MB/s without using much memory: 3.9 GiB took 18 s with a 0.32 GB peak **[M]**.

Every upload also makes a second copy of the footage on disk **[C]**.

These caps are deliberate and stay as they are, because they suit their features **[C]**:

- Share links, 1 GB (`share.ts:26`).
- Style Spy references, 200 MB and 10 minutes (`references.ts:33-34`).

### 5.2 Media info gives a wrong answer without saying so

`media-info.ts:51-56` decodes the file just to learn whether it has audio, and swallows any error. On the 6-hour file it returned `hasAudio: false` for a file that has audio, after 10.8 s and a 4.3 GB peak **[M]**. An agent reading that would treat the footage as silent. Upload and Add to Timeline both run this path (`StudioApp.tsx:472,987`, `StudioInspector.tsx:1866`) **[C]**.

### 5.3 Audio work crashes the tab on long files

See section 4.2. Decoding is all-or-nothing, and loudness planning decodes every audio source in full, even when the project uses only a few seconds of it (`mix.ts:44`) **[C]**.

The local render path is also exposed. `ExportDialog.tsx:164` calls `planLoudness` with no local error handling, while the browser path wraps it (`export.ts:141-145`) **[C]**. A decode failure therefore stops "Render on this computer" whenever loudness normalization is on **[C]**.

### 5.4 Export holds everything in memory

- `readAudio` builds full-length arrays (`master.ts:74-93`), and the limiter allocates several more (`master.ts:109-142`) **[C]**.
- The mastered file goes to a `BufferTarget` (`master.ts:248`), which fails at 4 GiB **[M]**.
- `measureExportedAudio` reads the whole file back (`export.ts:91`) **[C]**.
- Fetch upload streaming isn't available to replace this. A streaming `fetch` body to the helper fails with `Failed to fetch` **[M]**. Chrome requires HTTP/2 for this and the helper speaks HTTP/1.1. Writes must go in chunks.

### 5.5 Local render copies all footage to temp

Remotion's bundler copies the public folder into a temp bundle on every render (`@remotion/bundler/dist/bundle.js:283`, `copy-dir.js`) **[C]**. `render.ts:153-156` mirrors all assets and the whole library into that folder **[C]**.

On the 29.7 GB file with 17 GB free on C:, the render failed with `ENOSPC` before drawing a frame **[M]**.

Reading through the helper removes the copy entirely. With `assetBase` set to the helper's URL and an empty public folder, the same render worked at the same speed **[M]**. This needs the render page's origin allowed by the helper **[M]**. The real project also rendered this way, though its frames weren't compared against the current path **[O]**.

### 5.6 Long jobs hit timeouts even when the work is healthy

| Limit | Where | Label |
|---|---|---|
| Page gives up on a local render at 60 min | `ExportDialog.tsx:170` | [C] |
| Agent export tool, 60 min | `tools.ts:285` | [C] |
| Bridge `/call` maximum, 2 h | `bridge.ts:726` | [C] |
| Transcription job, 20 min | `service.ts:141`, `host.ts:89` | [C] |
| Agent audio analysis, 5 min | `tools.ts:213` | [C] |
| Agent media info, 2 min | `tools.ts:178` | [C] |

A local render also has no way to resume, so a failure late in the run loses all of it **[C]**. The page's timeout rejects the request but doesn't cancel the helper's work, so the UI would report a failure while the render continues **[C]**.

### 5.7 The timeline isn't built for long projects

- `fitPpf` has a floor of 0.05 pixels per frame (`StudioTimeline.tsx:565-568`) **[C]**. That means "Fit" stops fitting at (1,566 − 200) ÷ 0.05 = 27,320 frames, about 15 minutes **[D]**.
- Ticks and clips are all rendered, with no virtualization (`StudioTimeline.tsx:809-810,944`) **[C]**.
- The ruler's largest step is 2 minutes (`:517`) **[C]**.
- Filmstrips cap at 14 tiles per clip (`timeline-thumbs.tsx:49`), so a long clip shows a blurred, stretched image **[M]**.
- Waveform canvases cap at 8,000 px and are stretched past that (`StudioTimeline.tsx:247`) **[C]**.
- Every clip gets a `Sequence` on every frame (`packages/agentcut/template/runtime/composition.tsx:803`) **[C]**. This caused the preview drops in section 4.7 **[M]**.

### 5.8 Formats

ProRes can't be captured or exported through the current renderer. The error asks for `registerProresDecoder()` from `@mediabunny/prores`, which isn't installed **[M]**. The playback check reported 0 dropped frames on it, but I didn't confirm a picture appears **[O]**.

`.mkv` is missing from the helper's type table (`http.ts:8-34`) and from `media-info.ts:4` **[C]**.

### 5.9 Recording

Takes build up in memory in a `BufferTarget` (`recorder.ts:93`) and are only uploaded when kept (`Recorder.tsx:243`) **[C]**. A tab crash loses the take **[C]**. At the recorder's real output of about 11 Mbps, the 4 GiB limit comes at about 52 minutes **[D]**. I didn't record a take that long **[O]**.

### 5.10 Agent tools return too much for long media

- `analyzeAudioUrl` returns three arrays with one value per frame (`analyze.ts:79-81`) **[C]**. At 6 hours that's 1.9 million numbers, about 11 MB of JSON **[D]**.
- A 6-hour transcript is about 4.2 MB **[D]**.
- Face following stops above 1,201 samples at 2 per second, which is 10 minutes (`framing.ts:160`) **[C]**.
- Whisper audio is copied to the worker instead of being transferred (`transcribe.ts:77`) **[C]**.

## 6. Decisions

### 6.1 Browser or platform apps

**Decision: keep the browser plus the local helper. Don't build Mac or Windows apps now.**

| Need | Browser plus helper | Evidence |
|---|---|---|
| Read huge files | Yes, by HTTP range or `File` | 258 ms open, 167 ms seek [M] |
| Play long footage | Yes | 0% dropped at 5h30m [M] |
| Hardware decode and encode | Yes, through WebCodecs | H.264 and HEVC [M] |
| Long audio processing | Yes, by streaming | 6 h in 104 s, 0.83 GB [M] |
| Write huge files | Yes, in chunks through the helper | Needs building. Streaming `fetch` is unavailable [M] |
| Native tools | Already there through the helper | ffmpeg with NVENC, QSV and AMF encoders listed [M] |
| Long renders outside the tab | Yes, in the helper | Local render path [C] |

A native shell could help with ProRes (section 5.8), but it wouldn't fix any other finding in section 5. Those are application design problems. A shell would also add per-platform builds, code signing and auto-updates, none of which exist in today's `npx agentcut` flow.

Revisit this only if one of these happens:

1. Testing on macOS fails the acceptance matrix in section 8, and the cause is in the browser.
2. ProRes or camera RAW must play in real time, and a transcoded intermediate isn't acceptable.
3. Long browser-side work can't survive a hidden tab, and it can't be moved to the helper.

If that happens, wrap the same web app and helper in one thin shell (Tauri or Electron). Don't write separate per-platform apps.

**Not tested:** macOS and Linux **[O]**. This decision rests on Windows evidence, so task 0.2 tests macOS early.

### 6.2 Rust and WebAssembly

**Decision: neither, for now.**

- **Slow rendering:** Chrome draws the frames, and neither language changes that. Plain footage should skip Chrome entirely (task 3.4).
- **Crashes:** these come from whole-file buffers, and streaming fixes them in TypeScript, as the prototype showed.
- **Codecs:** already native through WebCodecs and ffmpeg.
- **WebAssembly memory:** the standard 32-bit form is limited to 4 GB, so it doesn't help with big buffers.

Reconsider only if profiling names a specific hot spot after this plan ships. Mastering is the likely candidate, at 97 s per hour in JavaScript **[M]**, which is about 10 minutes for 6 hours **[D]**. That's acceptable for now.

### 6.3 Where long renders run

**Decision: long exports run in the helper. The browser export stays for shorter videos.**

- The helper keeps running if the tab closes, doesn't have OPFS limits, and handles graphics much better in the one comparison so far (section 4.4).
- Browser export is excellent for plain footage, but on long projects its limits end the job only after hours of work.
- The switch-over length is set from task 3.6.

### 6.4 Quality rule

Exports always use full-quality sources. Proxies, if added, are preview-only. Any encoder used by default must match or beat today's local render SSIM on the acceptance clips, including footage with graphics and text.

## 7. Execution plan

Do the phases in order. Tasks within a phase can mostly run in parallel. Sizes are relative: S is small, M is medium, L is large.

### Phase 0: Set up the tests

| # | Task | Size |
|---|---|---|
| 0.1 | Add a script that generates the section 8 test files in a chosen folder, and a test driver that runs the app against them. Base it on `E:\agentcut-largefile-lab\scripts` | M |
| 0.2 | Run the section 4.1 tests on macOS, in a normal Chrome window. Record any differences here | S |
| 0.3 | Retest browser export of the real project in a normal window, to confirm or reject section 4.4 | S |

### Phase 1: Stop the crashes and wrong answers

Ship this first. It removes the failures that lose users' work.

| # | Task | Files | Size |
|---|---|---|---|
| 1.1 | **Fail early.** Before exporting, block or warn if the output would pass 3.5 GiB, stereo audio passes 1 hour, or OPFS space is short. Offer "Render on this computer" instead | `export.ts`, `ExportDialog.tsx` | S |
| 1.2 | **Media info without decoding.** Read duration, size, codec and audio tracks with a mediabunny `Input` | `media-info.ts` | S |
| 1.3 | **New streaming audio module.** `probeMedia(url)` and `streamAudio(url, { from, to })`, using `UrlSource` and `AudioBufferSink` | new `lib/studio/audio/stream.ts` | M |
| 1.4 | **Streaming waveforms,** saved to disk per file, keyed by size and modified time, so they survive reloads | `peaks.ts`, helper route | M |
| 1.5 | **Mix only the used range.** Decode each clip's used range, not its whole file. Measure loudness in rolling blocks | `mix.ts`, `loudness.ts`, `export.ts` | L |
| 1.6 | **Handle `planLoudness` errors on the local path,** with a clear message | `ExportDialog.tsx:164` | S |
| 1.7 | **Limit other audio tools.** Add `from` and `to`, and reduce the output of analysis on long files. Return an error instead of crashing | `analyze.ts`, `listen/*`, `tools.ts` | M |

Acceptance:

- A 1-second project using a 6-hour stereo file exports normally.
- `mediaInfo` on the 6-hour file returns correct audio information in under 2 s.
- A 6-hour waveform appears without the tab going over 1.5 GB.
- Loudness on existing short test projects stays within 0.1 LU of today's result.

### Phase 2: Big files in and out

| # | Task | Files | Size |
|---|---|---|---|
| 2.1 | **Remove the 2 GiB and 4 GiB upload caps.** Check free disk space before sending, so nothing is sent just to be refused | `ChatReferences.tsx:33,71`, `http.ts:36,204`, new helper route | S |
| 2.2 | **Upload progress and cancel** for large files | upload callers | S |
| 2.3 | **Use footage in place, with no copy.** The helper shows a native file dialog, since the browser doesn't reveal paths. It records the path in the project. The files route serves it, restricted to files the user picked | helper, `schema.ts`, `types.ts`, runtime `types.ts` | L |
| 2.4 | **Chunked write route** to the helper, with an offset per chunk, for exports and recordings | `http.ts` | M |
| 2.5 | **Stream recordings to the helper** as they're captured, using `StreamTarget` and 2.4. Make takes recoverable after a crash | `recorder.ts`, `Recorder.tsx` | M |
| 2.6 | **Add `.mkv`** where the browser can decode it, and show a clear message where it can't | `http.ts`, `media-info.ts` | S |

Acceptance:

- A 29.7 GB file uploads through both Simple view and Assets.
- A 29.7 GB file can be used in place with no second copy.
- A 2-hour test recording completes, and a tab crash at 1 hour keeps the footage.

### Phase 3: Long renders

| # | Task | Files | Size |
|---|---|---|---|
| 3.1 | **Read assets through the helper** instead of copying them. Allow the render's origin with a fixed or per-job port. Compare frames with today's output on real projects | `render.ts:153-169`, `bridge.ts`, `host.ts` | M |
| 3.2 | **Run renders as background jobs.** Return a job ID straight away, send progress as events, and reconnect after a page reload. Use one job system for the page and agents | `render.ts`, `host.ts`, `ExportDialog.tsx`, `tools.ts`, `bridge.ts` | L |
| 3.3 | **Chunked rendering with resume.** See the details below | `render.ts`, `render-policy.ts` | L |
| 3.4 | **Plain-footage fast path.** Sections with only a full-frame video clip go straight to ffmpeg, then join with the rest. See the details below | `render.ts`, new `render-plan.ts` | L |
| 3.5 | **Reuse unchanged chunks** after an edit. Key each chunk on project data, scene code and frame range | `render.ts` | M |
| 3.6 | **Set the browser and helper switch-over,** and default to the right one. Use results from 0.3 and 1.1 | `ExportDialog.tsx`, skill docs | S |

**Details for 3.3, measured to work:**

- Bundle once, then run separate `remotion render` processes.
- Use `--codec=h264-ts`, `--for-seamless-aac-concatenation`, `--separate-audio-to=…`, `--frames=a-b` and `--concurrency=1`, then call `combineChunks` from `@remotion/renderer`.
- **Chunks must be `h264-ts`.** With `.mp4` chunks, `combineChunks` silently produced a file with only the first chunk's video: 300 of 1,200 frames, with no error **[M]**. Always check the final frame count.
- Start with 4 processes and adjust by benchmark, within `renderPolicy`'s memory budget. Each process took about 10 s to reach its first frame **[M]**, so chunks of about 5 minutes keep that overhead near 3% **[D]**.
- Keep a manifest of finished chunks, so a restart continues where it stopped.
- Listen across joins before shipping. Duration and decoding are verified, but audible seams aren't **[O]**.

**Details for 3.4:**

- Eligible sections have one full-frame video clip, with no scenes, text, captions, grade, framing or animation over them.
- Use `-c:v libx264 -crf 18 -preset medium` in MPEG-TS, which measured 43 fps. A mixed join gave exact frames with no decode errors **[M]**.
- Offer the GPU encoder where available, with the settings in section 4.5. Make x264 the default until the SSIM rule in section 6.4 passes on the acceptance clips.
- Compare footage next to graphics sections by eye, since color tags differ between paths **[O]**.

Acceptance:

- A 6-hour plain-footage project renders start to finish, and the output has exactly 648,000 frames with 0 decode errors.
- Killing the helper at 50% and restarting loses at most one chunk per process.
- Closing the tab doesn't stop a render, and reopening shows its progress.
- Editing one 5-minute section re-renders only the chunks it touches.
- A project with no plain-footage sections renders at least 1.8× today's speed.
- SSIM isn't below today's on the acceptance clips.

### Phase 4: Long timelines

| # | Task | Files | Size |
|---|---|---|---|
| 4.1 | **Mount only clips near the playhead.** Extend to captures, so they stop costing 6.6 s at 2,000 clips. Remember the runtime template is shipped by the helper | `packages/agentcut/template/runtime/composition.tsx:803` | M |
| 4.2 | **Make Fit fit.** Remove the 0.05 floor and add ruler steps of 5, 10 and 30 minutes and 1 hour | `StudioTimeline.tsx:517,565-568` | S |
| 4.3 | **Virtualize ticks, clips and markers** to the visible range plus a margin | `StudioTimeline.tsx` | M |
| 4.4 | **Filmstrips by visible range.** Draw tiles only where they're visible, at a time step that matches the zoom. Save thumbnails to disk | `timeline-thumbs.tsx`, `video-frames.ts` | M |
| 4.5 | **Waveforms by visible range,** using a precomputed set of resolutions | `StudioTimeline.tsx:213-294`, `peaks.ts` | M |

Acceptance:

- At 6 hours, Fit has no horizontal scrollbar.
- Under 2,000 timeline DOM nodes at any zoom, with 2,000 clips.
- Under 5% dropped frames at 2,000 clips, and under 1.5 s per capture.
- No long task over 100 ms when zooming.
- Filmstrips look sharp at maximum zoom.

### Phase 5: Transcription and agent tools

| # | Task | Files | Size |
|---|---|---|---|
| 5.1 | **Remove the 2 GiB source cap.** Replace the full hash with size, modified time and samples of the file | `service.ts:113,145-167` | S |
| 5.2 | **Replace the 20-minute wall-clock limit** with a no-progress limit, and report progress | `service.ts:141`, `host.ts:89`, `tools.ts:202` | S |
| 5.3 | **Stream audio into Whisper chunk by chunk,** and save partial results so a restart resumes | `transcribe.ts`, `app/transcription-worker.ts` | L |
| 5.4 | **Store long transcripts in a file.** Tools return a path, a summary and search by time | `service.ts`, `tools.ts`, skill docs | M |
| 5.5 | **Raise the framing limit.** Lower the sample rate on long clips, while keeping the 2,400-keyframe schema limit | `framing.ts:153-165`, `framing-tool.ts` | M |
| 5.6 | **Update skill docs** for long footage: use ranges, avoid full-file analysis, and how long jobs report progress. Run `npm run sync:skill` | `skills/agentcut/*` | S |

Acceptance:

- A 6-hour local transcription completes, in about 2 hours on this machine **[D]**, and survives a page reload.
- A 6-hour cloud transcription completes.
- No agent tool returns over 1 MB for 6-hour media.

### Phase 6: Only if tests call for it

| # | Task | When |
|---|---|---|
| 6.1 | **Preview proxies.** 540p, 15-frame GOP, about 37 minutes and 1.7 GB for 6 hours **[D]**. Use for preview only, with exports always on the original | Only if weak-machine tests show the preview can't keep up |
| 6.2 | **ProRes support.** Evaluate `@mediabunny/prores` against a helper-made intermediate. Check speed and licensing | When ProRes is needed |
| 6.3 | **Graphics over footage without Chrome decoding.** Render overlays with transparency, and composite in ffmpeg. Effects that need the footage's pixels stay in Chrome | Only after Phase 3, if graphics-heavy long videos are still too slow |
| 6.4 | **Streaming mastering for browser export,** to remove its length limit | Only if long browser export is still wanted after 3.6 |

### Release notes

- Changes in `packages/agentcut`, `skills/` or `motion/components` need a helper release, and users must restart with `npx -y agentcut@latest`.
- The page must work with older helpers. Gate new behavior on `info.features`, as the drawing feature does.
- Keep `lib/studio/types.ts`, `packages/agentcut/template/runtime/types.ts` and `packages/agentcut/src/studio/schema.ts` in sync.
- Add each user-facing change to `CHANGELOG.md` under Unreleased.

## 8. Acceptance matrix

Run this after each phase.

| File | Tests |
|---|---|
| 6 h, 1080p, 11 Mbps H.264, 2 s GOP, about 30 GB | Everything |
| 4 h, same footage | Export, render, transcription |
| 6 h stereo audio with a 10-second project | Export doesn't decode the rest |
| 4K60, 80 Mbps H.264 | Preview, capture, render |
| 4K HEVC 10-bit | Preview, capture, render |
| Long GOP, such as a 10 s keyframe interval | Seek, preview, capture |
| Variable frame rate phone or screen recording | Sync across 6 hours |
| Over 100 GB | Open, seek, render |
| Cuts: 100, 500, 2,000 clips | Preview, capture, timeline, render |
| 54,000-word captions | Preview, capture, save |
| Real motion graphics project | Render, compared by frame with today's output |

Run the core rows on Windows and macOS, and in both a normal Chrome window and a hidden tab.

## 9. What I did not verify

These are open, and none should be treated as settled:

1. **macOS and Linux.** Everything was on Windows with one GPU.
2. **Weak machines.** Integrated GPUs, 8 to 16 GB of RAM, and hard drives. GPU-off tests only approximate this, and the CPU was still a 12-thread desktop part.
3. **Normal Chrome windows.** All tests were in new headless mode. Painting may differ.
4. **Hidden tabs.** Throttling was turned off in the tests.
5. **Files over 30 GB.** Results at this size suggest size doesn't matter, because reads are byte ranges, but 100 GB+ wasn't run.
6. **A full 6-hour render.** Times are calculated from 10-minute runs. Long-run memory growth or temp disk use at full length is unknown.
7. **Long GOP and variable frame rate.** The test footage has regular timestamps, and the recorder's default keyframe interval is 2 s (`media-source.js:447` in mediabunny). Camera footage can be much worse for seeking.
8. **Footage variety.** The long file is one 3-minute take on a loop. Quality numbers come from one talking-head clip. Graphics and small text weren't compared.
9. **Audio seams** in chunked renders, by listening.
10. **Why more workers in one process are slower.** The measurement is solid, but the cause is unknown.
11. **Windows symlinks for 2.3.** They worked on this machine, which may have developer settings on, so don't rely on them by default.
12. **The cause of the slow real-project browser export.** It may partly be headless mode, and 0.3 covers that.
13. **Cloud transcription of long files.** Only the code path was read.
14. **ProRes preview picture.** Only the playback count and capture error were checked.
15. **Recording over 52 minutes.** The failure point is calculated, not reproduced.
