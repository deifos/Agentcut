# Changelog

Agentcut has two versioned parts:

- **Editor**: the studio page (the version in the root `package.json`, shown next to the logo in the studio).
- **Helper**: the `agentcut` npm package you run with `npx -y agentcut` (`packages/agentcut/package.json`).

They are released together and share version numbers. The editor names the oldest helper it works with
(`MIN_HELPER_VERSION` in `lib/version.ts`) and asks you to update an older one.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org).

## [Unreleased]

## [0.2.3] - 2026-10-24

Works with helper 0.2.0; update to 0.2.3 (`npx -y agentcut@latest`) so your agent follows the new Style Spy
steps for empty projects.

### Changed

- **Style Spy** on an empty project asks what your video is about, then builds a new video in the
  reference's style for your topic, with labeled placeholders where your own footage goes and a list of
  what to send. Before, it tried to restyle a video that wasn't there.

## [0.2.2] - 2026-10-24

Works with helper 0.2.0; update to 0.2.2 (`npx -y agentcut@latest`) for X links in Style Spy.

### Added

- **Style Spy** takes X (Twitter) links too: paste an `x.com` or `twitter.com` post with a video.

## [0.2.1] - 2026-10-23

Works with helper 0.2.0; update to 0.2.1 (`npx -y agentcut@latest`) for the render and project fixes.

### Added

- **Pencil**: click the pencil under the preview, draw on the video ("a circle here, a line from it to the
  middle") and say what you want. The agent gets that frame with your drawing on it, strokes numbered in
  the order you drew them, and each stroke's path in video pixels, so it can place things exactly and
  move them along the line you drew. Esc closes it, ⌘Z takes back a stroke. Older helpers still get the
  drawing, in the message text.

### Fixed

- A reply that was running when the helper stopped no longer stays stuck on its last step (e.g.
  "transcribing") forever: it shows as stopped, so you can send the message again.
- The studio no longer jumps to another project while you work. When an agent busy with another
  project needs to see it (capture frames, export…), a bar above the preview asks you to **Open** it
  (or **Not now**) instead of switching for you, and a project an agent creates from another chat is
  offered with a toast. A slow project load can no longer replace the project you switched to.
- Local renders that crashed partway through (often seen as "delayRender() … was called but not
  cleared" on an image or video) now retry with full Chrome, and later renders use full Chrome right away.

## [0.2.0] - 2026-10-22

Needs helper 0.2.0: stop the helper and run `npx -y agentcut@latest`.

### Added

- **Style Spy**: copy the editing style of a video you like. Paste an Instagram, TikTok or YouTube link
  (the download starts on paste) or drop a video file, then click **Copy this style**. The agent copies
  the layouts and when they switch (split screens, full-screen cards), cut rhythm, captions and how they
  animate, motion graphics, transitions, zooms, color and effects, using your own footage and brand,
  and tells you what it couldn't match.
- Helper: reference importer. It downloads public videos itself with yt-dlp and ffmpeg, fetched on first
  use into `~/.agentcut/tools` with checksums verified (nothing installed system-wide; yt-dlp stays up to
  date). Progress shows in Style Spy, failures have plain reasons, and a link that needs a login can be
  retried once with your browser's login (**Retry with my browser login**; used for that video only,
  never saved).
- Helper: each reference gets cut detection, a frame per shot with an overview sheet, and motion strips
  (the hook, every cut, a stretch of captions) so the agent sees how things move, not just single frames.
- Helper: MCP tool `agentcut_import_reference` for links pasted in chat.
- **Record**: record talking-head takes from your camera in the studio. Countdown with beeps, **Stop**,
  **Discard** (throw the take away and start again), review, **Retake** or **Use take**. Takes are
  H.264/AAC MP4 (1080p), land at the end of the Footage track, and are attached to the chat so you tell
  the agent what to do with them.
- The editor version is shown next to the logo, linking to this changelog; the connection badge asks you
  to update an outdated helper.
- Install steps for Node.js on the landing page and the connect screen.

### Fixed

- Helper: local exports that crashed with "Page crashed!" (a V8 bug in the lightweight headless Chrome)
  are retried automatically with the full Chrome for Testing build.
- The first seconds of a camera take no longer freeze: the encoder warms up during the countdown.
- The chat draft and attached files are kept per project instead of following you to another project.

## [0.1.0] - 2026-10-21

First release: an open-source video studio you edit by chatting with Claude Code or Codex. Live Remotion
preview, timeline and inspector, browser and local export, motion component library, templates and video
styles, voice-over and music with your own keys, and the `agentcut` helper with its MCP tools.

[Unreleased]: https://github.com/deifos/Agentcut/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/deifos/Agentcut/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/deifos/Agentcut/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/deifos/Agentcut/releases/tag/v0.1.0
