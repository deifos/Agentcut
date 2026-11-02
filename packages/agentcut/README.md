# agentcut

The local helper for [Agentcut](https://github.com/deifos/Agentcut): it runs your coding agent
(Claude Code or Codex), your video workspace and live preview bundles for the Agentcut studio page.

```bash
npx -y agentcut
```

Then open https://agentcut.synteq.app/studio in Chrome. Run `npx -y agentcut --help` for options.
Needs Node.js 20.10 or newer.

For Style Spy, the helper downloads reference videos itself: it fetches
[yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org) on first use into
`~/.agentcut/tools` (checksums verified, nothing installed system-wide; set `AGENTCUT_TOOLS` to use
another folder).

See the [changelog](https://github.com/deifos/Agentcut/blob/main/CHANGELOG.md) for what's new. If the
studio says **Update helper**, stop it and run `npx -y agentcut@latest`.

## Preview and colour tools in 0.2.17

The helper makes fast-seeking preview copies of local footage with sparse keyframes or a long edge
above 1920 pixels. This work runs in the background, one file at a time. The studio applies ready
copies while paused and also uses them for timeline thumbnails. HDR footage, transparent video and
clips shorter than two seconds keep their originals. Copies use the workspace's `.agentcut/proxies`
cache, limited to 20 GB with oldest entries removed first. Captures and exports use original footage.

The studio also caches recent paused frames and can render small pictures for scenes measured as
slow. During a drag, intermediate seek requests can be skipped. Releasing the pointer waits for
the exact final frame before playback resumes. `agentcut_preview_check` and `agentcut_status`
report seek times per clip as well as playback performance.

Colour grading supports clip and project grades, adjustment tracks, keyframes, colour wheels,
curves, an eight-band mixer, 18 built-in looks, 3D `.cube` LUTs, skin protection and finishing effects.
The studio includes scopes, shot matching, reference-look matching and separate person/background
grading. The helper validates the format and supplies the matching runtime and guides.

Use `agentcut_color_check`, `agentcut_match_shots`, `agentcut_match_look`, `agentcut_grade_subject`
and `agentcut_color_looks` with the connected studio. Read `references/color.md` through
`agentcut_guide` for the workflow. Person cutouts run locally and download a model on first use.

This version also includes saved editing styles, labelled AI-generated b-roll, external MCP file
access and the announcement workflow described below. See the
[main README](https://github.com/deifos/Agentcut#preview-and-timeline) for the editor controls.

MIT

## External MCP agents

Connect a local MCP client to `node <agentcut-package>/dist/index.js`. Start the helper first,
and set `AGENTCUT_PORT` in the MCP server environment if the helper uses a different port.
The helper owns the workspace; the client's current folder does not select it.

Call `agentcut_capabilities`, read `agentcut_guide` with `path: "SKILL.md"`, then call
`agentcut_status`. The MCP exposes the same music, SFX, b-roll, animated components, voice,
transcription, audio review, preview and export tools used by the built-in chat. Skill guides
are also available as `agentcut://guide/...` MCP resources. Guides and the index work without
the helper; provider options report live configuration without exposing keys.

Clients without shared disk access can list/read project and library files, read packaged
toolkit code and styles, write scenes/timelines/notes, and copy preset scenes and binary assets
through `agentcut_list_files`, `agentcut_read_file`, `agentcut_write_file` and `agentcut_copy_file`.
Writes require the current file hash; null creates a new file. Hidden files are excluded,
toolkit and library are read-only, and copying never overwrites a destination.
Captures and contact sheets return native MCP image blocks as well as saved local paths.
For local app code, `agentcut_sources` lists read-only folders already configured with
`--add-dir`. Use their IDs with file scope `source`; MCP cannot add folders or write app code.

The studio page must remain connected for catalogs, asset imports, visual capture, playback,
audio review and export. Voice/music generation and transcription use the user's configured
providers and can incur charges. This access supports the full creative workflow; it does
not guarantee identical creative results across models. The release announcement prototype
below remains a separate limited workflow, not the entry point for every video request.

## Local release announcement prototype

The input is a website URL and user brief. The browser agent inspects the visible website,
plans a story and shots, performs permitted actions, records short page captures, and assembles
editable clips and overlays. Source-code access is not required. No app-specific reconstruction
or local mock UI is part of this generic flow.

Before capture, `plan.story` must name the audience, message, before/after outcome and capture
basis. Each shot must state its purpose, browser-observed evidence and expected visible change.
The plan is saved in the project's `.studio/storyboard.json`. A plan made only of static crops
is refused. These fields record intent; they do not prove a good story. Review actual frames,
readability, visible cause/effect and full playback before calling an announcement complete.
Optional demo footage needs explicit user approval, `approved_demo` capture basis and a persistent
disclosure. The helper does not generate a fake UI when real footage is missing.

Story edits use scene `beats` (`actionIndex`, `headline`, `explanation`) and actual capture cue
times. The project contains editable footage trims, headlines, explanations, opening/closing
cards, brand, disclosure and progress tracks. There are no automatic default zooms. `wait`
actions set reading time. Paced `type` actions and demo reply buttons are restricted to explicitly
approved loopback pages marked as synthetic; live send and credential controls stay blocked.
The isolated Instagram illustration under `tests/fixtures/instagram-story.html` is an approved
example, not a replacement for generic live capture. It makes no network requests or real DMs.

Start the helper with `npx agentcut`. The calling Codex or Claude session must have the Agentcut
MCP server configured (`node <agentcut-package>/dist/index.js`). No separate model service is used.

Call `agentcut_create_release_video` with `name`, `appUrl`, `description`, and
`videoType: "announcement"`. The default `orchestration: "helper"` runs the installed coding agent
through the existing Agentcut agent adapter. To use the current agent instead, pass
`orchestration: "caller"`, inspect the pages with `agentcut_release_browser`, and finish with
`agentcut_release_capture`. Both paths must reach `ready` before the agent claims a draft exists.

The helper supplies pinned Agent Browser 0.41.0 and downloads Chrome and the shared verified
FFmpeg build on first use. Agent Browser declares Node 24 or later for its supported runtime.
There is no Agent Browser global-install step. See its [installation guide](https://agent-browser.dev/installation)
and [recording guide](https://agent-browser.dev/recording). Recording captures browser page pixels,
not the desktop. The helper opens a separate browser profile for each job. Sign in directly there.
Credentials and login screens are not part of the requested capture. Jobs pause when they detect
a password form or a login URL. Other sign-in flows and safe sample data can require the agent to
pause explicitly. The user resumes through MCP or the studio status bar.

Jobs are stored under `.agentcut/release-jobs/`; projects and source videos remain under
`projects/<slug>/`. Status includes a reopenable `editorUrl`, progress and errors. Saved partial
jobs become failed after a helper restart. Resume a failed job to reuse its saved project and
browser profile. The visible demo browser stays open after a failure or completed capture.
Cancellation stops the active job's agent and browser and keeps files. Browser-operation errors
stop the job; check status before resuming. Preparation waits for visible controls and selected tabs.
When the draft is ready, the helper reuses a connected editor tab before it opens a new tab.

`ready` is an editable, validated announcement draft, not a final exported video. Review footage,
text and privacy before sharing, then use the existing editor/export flow. The prototype is wide
1440×900 for page capture and 1920×1080 for the presentation, with editable titles, explanations,
recorded clips, source trims and optional explicit framing. It has no generated audio. How-to and promotional remain named choices but return
an unsupported response. There is no webhook, automatic deployment trigger or publishing step.
Capture uses real Chrome page frames and a helper-owned FFmpeg recorder at 30 fps. It keeps only
the latest frame in memory and handles encoder backpressure without a fixed half-second cutoff.
`showCursor` defaults to true. Cursor motion and click feedback are drawn inside the captured
page, with smooth movement before click and hover actions. This uses the same page recorder,
not Agent Browser's separate cursor encoder. The overlay is removed when recording stops.
Recorder failures remain real job failures; frame rate is not silently reduced.

For local editor work, set `AGENTCUT_EDITOR_ORIGIN=http://localhost:3000` before starting the helper.
Custom origins must also be allowed with `--origin`. A non-default helper port is included in the
editor link as `helperPort`; the bridge host always remains `127.0.0.1`. Reopen links on the same
computer with the same workspace helper running. `AGENTCUT_DEMO_HEADLESS=1` is for unattended
fixture tests; leave it unset for direct sign-in.

Run `npm run test:release` from the repository root for lifecycle checks. For the real browser/MCP
test, build the helper, start the local editor, set `AGENTCUT_RELEASE_E2E=1` and optionally
`AGENTCUT_RELEASE_TEST_PORT=32119`, then run `npm run test:release`. It records only the local
prepared Chat with Website sample. It does not validate a live Chat with Website account. The
test saves its draft and result under `packages/agentcut/.tmp/release-test-<port>/`. Use a separate
port and workspace from a live run. `AGENTCUT_RELEASE_TEST_DIR` can select another test workspace.
