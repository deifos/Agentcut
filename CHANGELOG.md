# Changelog

Agentcut has two versioned parts:

- **Editor**: the studio page (the version in the root `package.json`, shown next to the logo in the studio).
- **Helper**: the `agentcut` npm package you run with `npx -y agentcut` (`packages/agentcut/package.json`).

They are released together and share version numbers. The editor names the oldest helper it works with
(`MIN_HELPER_VERSION` in `lib/version.ts`) and asks you to update an older one.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org).

## [Unreleased]

### Added

- **Archival b-roll, free for any video.** Your agent can search public-domain shots from old films
  (1930s–70s industrial films, newsreels, home movies) by meaning, "lonely city at night" or "crowd
  celebrating", and drop them into your video at full quality: b-roll under a voice-over, or a matching
  shot for every line of a lyric or transcript video. `agentcut_broll_search` and `agentcut_add_broll`.

## [0.2.9] - 2026-10-25

Works with helper 0.2.0; update to 0.2.9 (`npx -y agentcut@latest`) so your agent finds sounds in one call
and adds up to 40 at once.

### Changed

- **Finding sounds takes one call.** The sound effects catalog returns a compact index of the whole
  library, then full details for the sounds your agent picks, instead of making it page through every
  category; it can add up to 40 sounds at once.

## [0.2.8] - 2026-10-25

Works with helper 0.2.0; update to 0.2.8 (`npx -y agentcut@latest`) so your agent can search and use the
sound effects library.

### Added

- **A sound effects library, nothing to install.** 276 effects ship with Agentcut: 55 original recordings
  (clicks, pops, swooshes, whooshes, impacts, dividers) plus 221 designed sounds from the
  [earshot](https://github.com/Leonxlnx/earshot) bank (risers, logo stings, sub drops, shimmers,
  notification chimes, glitches, typing, shutters). Each is described by what it actually sounds like,
  what it's for, its timing and a volume that evens out its loudness, so your agent picks and places the
  right one: `agentcut_sfx_catalog` and `agentcut_add_sfx`.

### Changed

- **Better sound by default.** Your agent uses the recordings first, the designed sounds next and
  downloads last, and no longer synthesizes its own effects when the library has one.

## [0.2.7] - 2026-10-25

Works with helper 0.2.0; update to 0.2.7 (`npx -y agentcut@latest`) so your agent knows how to film macro
focus shots.

### Added

- **Macro focus shots.** Your agent can now film extreme close-ups of a screen with a macro lens: one
  line sharp, everything else melted, drifting slowly. Used sparingly, for the detail worth savouring.

### Fixed

- **Real depth of field in close-ups.** Lens blur now follows the part of a screen that's on camera,
  with a ladder of blur levels, so a wide aperture gives a crisp focus band and strong falloff instead of
  a faint soft-sharp mix; screens that pass the camera in a close-up are drawn up to the lens instead of
  vanishing.
- **The 3D MacBook is truly space black.** At low, front-facing angles the deck mirrored the bright studio
  and read light grey; dark finishes now reflect less, like real dark anodising, and `space-black` is a
  deeper charcoal (`#3d3c40`).

## [0.2.6] - 2026-10-25

Works with helper 0.2.0; update to 0.2.6 (`npx -y agentcut@latest`) so your agent knows the new device
colours and models.

### Added

- **Phones in colour.** A colour iPhone for scenes (`Device3D model="iphone-color"`) in graphite,
  lavender, mist blue, white, cosmic orange or your brand colour, for turn-arounds and colourful lineups.
- **Bring your own device models.** `modelSrc` loads your own GLB from the workspace library, e.g. the
  free, highly detailed "MacBook Pro 14-inch M5" from Sketchfab (`model="macbook-pro"`),
  whose licence doesn't allow it to ship with Agentcut. Your agent tells you where to get it and uses it
  for laptop shots when it's there.

### Changed

- **A better built-in 3D MacBook.** Space black by default (new `space-black` finish), black keycaps with
  bright, crisp legends, speaker grilles, and softer studio lighting for laptops and displays, so the
  aluminium and the keyboard no longer wash out to grey.

### Removed

- **The flat 2D MacBook frame** (`Screen kind="macbook"`). Laptops are 3D now (`Device3D` `macbook` or
  `macbook-pro`); a scene that still asks for the flat frame gets a frameless screen.

## [0.2.5] - 2026-10-25

Works with helper 0.2.0; Cinematic Mode needs helper 0.2.5 (`npx -y agentcut@latest`), which brings your
agent the cinematic and loops guides, the toolkit's types and three.js for local renders.

### Added

- **Cinematic Mode.** A new tab next to Style Spy turns screenshots and screen recordings into a premium
  product film: a real 3D camera (tilt, orbit, push-ins, whip pans with motion blur), lens blur that follows
  the depth of each screen, UI pieces lifting off the glass with real shadows, light sweeps, reflections and
  floors. Every take rolls a new direction (mood, camera, signature move, backdrop, type, cuts) and your
  agent directs a different film around it; on **Another take** your agent backs up the previous cut
  first. The agent checks every shot in wide and mobile before it hands off.
- **Real 3D devices** for scenes: an iPhone 16 Pro Max model (by MajdyModels, CC BY 4.0), a MacBook with a
  lid that opens and a Studio Display, lit like a product studio and drawn through the same camera
  (`Device3D` in `agentcut/components`), plus flat browser, MacBook, iPhone, iPad and monitor frames.
- **Motion loops, with their own page.** 44 original seamless loops in your brand colours: animated
  backgrounds, shapes, symmetry (kaleidoscope, mandala, spirograph, mirror tiles, sunburst), shape morphing
  (circle → square → triangle → star, liquid metaballs), little games (Snake, Pong, falling blocks, Game of
  Life gliders), physics (Newton's cradle, gears, dominoes, liquid fill) and generative pieces. Each has dark,
  brand-colour and paper tones, a layout seed and motion blur in exports (also on transparent loops).
  Browse them live at `/loops` (recolour every loop with your brand colours; one page per loop with
  copy-ready usage), use them as
  `motion-loop` clips or in scenes (`LoopCanvas`), and your agent can write new ones and save them to the
  workspace library. The agent now builds every video's palette from your brand colours and rotates loops,
  tones and shapes so no two videos look alike.
- **"Generated by an agent" effects.** `Dot Trace Title`: a headline traced in dots that resolves into the
  type. `GenerateReveal` for scenes: a screenshot builds itself with dotted wireframes, a dotted fill of its
  own pixels and an agent log, then the real UI resolves block by block (also on a 3D screen).
- **Drop or paste files into the chat.** Images, videos, audio and fonts dropped from your computer onto the
  chat box, or pasted (a screenshot from the clipboard), are added to the project's assets and attached to
  your next message, so the agent knows exactly what you mean.
- **The cinematic toolkit** in `agentcut/components` (`Stage`, `Plane`, `Screen`, `Lift`, `Group`,
  `Backdrop`, `Floor`, `Glare`, `PlaneVideo`): 3D drawn the same way in the preview and the browser export,
  with soft lens-blur edges in both. Screen recordings in a Plane play their sound once, and stay playing
  through focus changes.

### Fixed

- Motion component fonts no longer hold an export forever when a render is discarded or a font fails to
  load.

## [0.2.4] - 2026-10-24

Works with helper 0.2.0; update to 0.2.4 (`npx -y agentcut@latest`) so your agent can check preview smoothness
(`agentcut_preview_check`), follow the new preview performance rules, and see what each clip draws.

### Added

- **Smoother previews, measured.** The studio records how smoothly the preview plays, per clip: dropped
  frames, loading stalls and freezes. A clip that can't keep up shows "Preview drops frames in …" under the
  video. Your agent sees the same numbers in `agentcut_status` and can run `agentcut_preview_check` to play a
  range muted and measure it (your playhead, play state and sound come back afterwards), then make heavy
  scenes lighter with new skill rules that keep every rendered frame identical. Exports always render every
  frame at full quality; this only concerns the live preview.
- `agentcut_capture_frames` takes `region` and `scale` up to 2, for a sharp crop of one part of a frame.

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

[Unreleased]: https://github.com/deifos/Agentcut/compare/v0.2.9...HEAD
[0.2.9]: https://github.com/deifos/Agentcut/compare/v0.2.8...v0.2.9
[0.2.8]: https://github.com/deifos/Agentcut/compare/v0.2.7...v0.2.8
[0.2.7]: https://github.com/deifos/Agentcut/compare/v0.2.6...v0.2.7
[0.2.6]: https://github.com/deifos/Agentcut/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/deifos/Agentcut/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/deifos/Agentcut/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/deifos/Agentcut/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/deifos/Agentcut/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/deifos/Agentcut/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/deifos/Agentcut/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/deifos/Agentcut/releases/tag/v0.1.0
