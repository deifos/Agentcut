# Changelog

Agentcut has two versioned parts:

- **Editor**: the studio page (the version in the root `package.json`, shown next to the logo in the studio).
- **Helper**: the `agentcut` npm package you run with `npx -y agentcut` (`packages/agentcut/package.json`).

They are released together and share version numbers. The editor names the oldest helper it works with
(`MIN_HELPER_VERSION` in `lib/version.ts`) and asks you to update an older one.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org).

## [Unreleased]

### Fixed

- Release decoded audio after computing timeline waveforms, and limit the video thumbnail cache without retaining object URLs.
- Keep visible video thumbnails after cache eviction, and replace old thumbnails when a clip's video source changes.
- Capture timeline scene previews as small still images, one at a time, instead of keeping many complex scenes mounted in Advanced view. Limit the still cache and cancel queued captures when their tiles close.

### Changed

- Move the soft, warm gradient in Simple view to the left chat area, with a gradual fade toward the preview.

## [0.2.16] - 2026-10-29

### Fixed

- Finish cancelled local transcription requests even if the editor does not reply, and remove completed jobs from the active list.
- Exclude generated vision files from lint checks and show an update notice for helpers older than 0.2.16.
- Give the render download button an accessible name.

### Added

- Open the music library without re-rendering the chat and editor. Show an initial page of songs and load more on scroll or request; search the full built-in catalog. Keep the mounted list, search, selected song, and audio player when the sidebar closes, and remove the extra code load on first open. Audio still loads only when Play is pressed, with a clear loading state.
- Show “Hold to record” on speech input buttons, with visible Listening and Processing states. Keep Simple view's action controls and Send on one row, with a wider chat panel on desktop and compact spacing on phones. Use the shared shadcn tooltips across editor controls, music, styles, and library pages, including keyboard access for disabled controls.
- Show a larger, readable preview status panel while an agent edits or checks playback. Keep the preview visible, use the active agent's name, and respect reduced motion without estimating progress.
- Use press-and-hold dictation for the microphone, touch, and keyboard. Releasing stops capture and keeps the words without sending. Keep the mic icon visible while listening, loading, finishing, hovering, focused, or disabled.
- Place Simple view chat on the left and the video preview in the center on desktop, with music on the right. Keep conversation visible above the composer, without a collapse toggle. Dock the persistent music player inside its sidebar and stack the panels on narrow screens without resetting drafts or selections.
- Center a visible speaker on explicit agent request with local MediaPipe face detection and a smoothed, variant-specific crop path across the full displayed clip, with dead-zone motion, bounds and brief detection-loss holds. Preview and exports share the path; reset and Undo restore prior crop/path settings. An explicit static mode remains available. Ambiguous or weak detections return useful next steps without choosing a person. No framing control is added to Simple view.
- Add modular transcription with Local Whisper and user-key AssemblyAI, common word timings/provenance, capability discovery, explicit provider preference, job progress and cancellation. Cloud transcripts request filler words; audio uploads and provider charges are stated in settings.
- Expose Voice-over and Transcription settings in Simple view. Split existing voice-over providers into registered adapters and share helper-side credential storage without changing their synthesis payloads.
- Add Signal, Studyroom, Afterglow, and Fieldnote styles with distinct preview reels and editing guides for speech cleanup, framing, B-roll, sound, and color. Sync the guides to the helper.
- Use the existing shadcn ScrollArea in both style galleries. Add centered and lower-third title layouts, and separate Fieldnote's editorial cards from Snipwork's paper collage.
- Open the studio in a simple view with a centered video preview and a shared request composer.
  Switch to the advanced editor at any time without losing the project, draft, attachments, or selected options.
- Upload footage or record yourself from an empty preview, or describe a new video with text, voice, files, or a product link.
- Prepare edits with quick actions, select a style from a scrollable gallery, and preview songs from the existing music library.
  Style and music selections remain visible and removable in the composer. Choose a song or let the agent choose.
  Press Send to apply the request with the selected agent, model, and thinking level.
- Access the existing drawing tool from the simple composer. File, frame, recording, and voice controls have separate spacing.
  Choose landscape (16:9), portrait (9:16), square (1:1), or portrait (4:5) near the preview; custom project sizes remain available.
- Welcome users without an open project with an animated idea box and a clear New project action, with a static reduced-motion version.
  Empty projects use a compact frosted-glass upload panel over a large animated idea box, polished copper-and-gold creative illustrations, and moving warm light. Background motion stops when video content is present and has a static reduced-motion version.
- Browse music in a non-blocking glass sidebar while writing a request. Play/Pause and a seek bar with elapsed time and duration let you audition songs; Use stages a selection until Send. Keep loading inside the sidebar to prevent the editor flashing when music opens.
  A separate Now playing card stays visible while browsing other songs and slides beside the library on larger screens.
  The seek control shares the timeline zoom slider's styling, and playback and selection controls stay inside padded card and row borders.
  The idea-box lids stay attached to their hinge edges as they open.
- Keep drawing toolbar controls visible before hover in Simple view by using matched popover background and text colors.
- Seek through the Simple view video preview with a compact playback slider and current/total time. The slider uses the timeline zoom design, supports dragging and keyboard control, and is disabled while the agent edits.
- Recognize attached images and recorded or uploaded videos from compact composer thumbnails, with filenames, remove controls, and file-icon fallbacks when a preview is unavailable.
  Video thumbnails explicitly decode a small frame instead of waiting for metadata-only playback. Click a media card to inspect an image or play and seek a video without losing the draft. Selected styles show their real gallery preview beside the name.
- Explain request readiness near Send. Footage with a selected style or music can use a clear prepared request without typed text; missing input is identified before sending.

### Fixed

- Keep delayed uploads and asset refreshes from changing a different project. Preserve timeline edits made while video metadata loads, and reject invalid video durations.
- Wait for empty-preview uploads before sending a request. Keep format changes tied to their original project.
- Keep the empty-project upload controls reachable on short screens, and remove conflicting opening instructions from the line-art style.

## [0.2.15] - 2026-10-29

### Added

- Show saved render times in Latest renders and the Renders tab for new local and browser exports.
  Show local render elapsed time in minutes and seconds. Existing videos without timing records remain unchanged.

- Speak instead of typing anywhere you prompt the agent: the chat, the pencil on the preview, the ask
  bubble on the timeline playhead, file and component asks, Cinematic, Style Spy and video style forms. Click
  the mic, or hold Ctrl+Space (tap it to keep listening, tap again to stop); it goes to the box you're in, else
  the open pencil or ask bubble, else the chat. Words appear while you talk. Speech is recognized in the
  browser with Moonshine (English), so no audio leaves your computer; the model (about 150 MB) downloads on
  first use.

### Fixed

- Keep cinematic scene content mounted when export motion blur starts or stops.
- Keep local render progress compatible with frame-count output, and hide timing records for uppercase MP4 filenames.
- Reload preview bundles after a helper restart instead of keeping stale scene code.

- Bound cinematic motion-blur surfaces during export and skip off-screen plane copies, reducing
  graphics memory use during camera moves without lowering the output resolution.
- Limit local render workers using available memory (two by default) and bound media caches. Show
  frame counts, elapsed time, and warnings when frame progress stops; keep diagnostic progress in
  the helper log. Correctly read progress split across process output chunks.
- On Windows, include available virtual memory when choosing render workers and cache sizes;
  free physical RAM alone can hide an exhausted system memory limit.

- Draw cinematic preview floors as screen-space grids clipped to the video frame, replacing
  transformed SVG mask tiles that triggered black bars across the editor. Preview floors use a
  simplified grid without floor glow or depth blur; exports retain the full-quality floor.
- Reduce graphics load by skipping off-screen plane copies while keeping their content mounted,
  containing timeline thumbnail painting, and clipping stage content before motion blur.

- Stop voice capture when a prompt closes or becomes unavailable, including while microphone permission
  is pending. Recover from speech worker failures, use CPU recognition if GPU setup fails, and prevent
  overlapping model requests when switching prompts. Wait for dictation to finish before sending forms.

## [0.2.14] - 2026-10-28

### Fixed

- Install missing workspace dependencies before building previews, so shared projects and older workspaces can load components such as 3D devices without first exporting a video.

### Changed

- The landing page loads faster: the hero draws its timeline film strips once the page is idle, the styles carousel loads as you scroll to it, the demo clip downloads once instead of twice, and the hero media is smaller and cached.

## [0.2.13] - 2026-10-27

Update the helper with `npx -y agentcut@latest` to use model and thinking-level selection.

### Added

- Choose the agent model and thinking level in chat. Choices are saved per agent and retained for queued messages.
- Search library music by tempo, energy, vocals, mood, genre, and instrument. Results include intro, drop, and ending information.

### Fixed

- Read Codex defaults from the root TOML settings, without using inactive profile settings.
- Keep matching music aliases in category and name searches, and return all explicitly requested track ids.
- Preserve flex, grid, and padding layout inside cinematic planes when they are not clipped by the camera.
- Load the music library without a custom music CDN setting.
- Close Style Spy after selecting **Copy this style**.
- Free disk space during b-roll indexing and recover from repeated model responses.
- Scrubbing a cinematic shot with lens blur (a racking focus, a macro sweep that passes the lens) no longer
  makes the whole studio flash: the preview keeps a plane's blurred copies mounted and only updates them,
  instead of rebuilding them and their content on every focus change. Exports draw exactly as before.

## [0.2.12] - 2026-10-27

Update the helper with `npx -y agentcut@latest` to create and import share links.

### Fixed

- Keep share import progress visible when the helper connects. Concurrent imports use separate
  temporary folders, and duplicate project names stay within the studio's folder-name limit.
- Reject alternate chunk names that could bypass the share Worker's storage limit, and fix its type check.

### Added

- Hosted sharing at `share.vladpalacio.com`, with encrypted files in the media bucket's `shares/`
  folder and a three-day expiry rule that does not affect sound effects or other media.
- **Share a project with a link.** Click **Share** and send the link: whoever opens it gets the whole
  project (scenes, timeline, notes and assets) in their own Agentcut with one click, even if they start
  the helper only after opening the link. Files are encrypted on your computer and the key is part of
  the link, so the server never sees them. Links expire after 3 days; projects up to 1 GB without their
  renders. Renders and the chat aren't shared. Needs the new helper on both ends.

## [0.2.11] - 2026-10-26

Works with helper 0.2.0; update to 0.2.11 (`npx -y agentcut@latest`) so your agent can search and add
archival b-roll. Same release as 0.2.10, whose helper couldn't be published to npm.

### Fixed

- **The b-roll page finds its catalog.** The site build now receives the catalog's address.

## [0.2.10] - 2026-10-26

Works with helper 0.2.0; update to 0.2.10 (`npx -y agentcut@latest`) so your agent can search and add
archival b-roll.

### Added

- **Archival b-roll, free for any video.** Your agent can search public-domain shots from old films
  (1900s–70s industrial films, newsreels, NASA and government films, home movies) by meaning, "lonely
  city at night" or "crowd celebrating", and drop them into your video at full quality: b-roll under a
  voice-over, or a matching shot for every line of a lyric or transcript video. `agentcut_broll_search`
  and `agentcut_add_broll`. Search runs in your browser; the catalog keeps growing.
- **A free b-roll page.** Search the same catalog at `/b-roll`, hover to play, download any shot.

### Changed

- **Music never comes from web downloads.** Your agent uses your file, the Agentcut library, Lyria with
  your Gemini key, or music it composes, instead of slow and unreliable CC0 downloads.

### Fixed

- **Pictures the agent looks at show in the chat again.** Images it read from its own scratch folders or
  from outside the project showed as broken; the chat now keeps a copy of each one, as it does for frames.

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

[Unreleased]: https://github.com/deifos/Agentcut/compare/v0.2.16...HEAD
[0.2.16]: https://github.com/deifos/Agentcut/compare/v0.2.15...v0.2.16
[0.2.15]: https://github.com/deifos/Agentcut/compare/v0.2.14...v0.2.15
[0.2.14]: https://github.com/deifos/Agentcut/compare/v0.2.13...v0.2.14
[0.2.13]: https://github.com/deifos/Agentcut/compare/v0.2.12...v0.2.13
[0.2.12]: https://github.com/deifos/Agentcut/compare/v0.2.11...v0.2.12
[0.2.11]: https://github.com/deifos/Agentcut/compare/v0.2.10...v0.2.11
[0.2.10]: https://github.com/deifos/Agentcut/compare/v0.2.9...v0.2.10
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
