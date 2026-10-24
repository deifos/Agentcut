---
name: agentcut
description: Use for every change in an Agentcut workspace — making or editing Remotion videos the user watches live: launch spots, promos, lyric videos, explainers, ads, social clips. Covers the project format (project.json, layers.json, scenes/*.tsx), the agentcut_* tools (status, capture, contact sheet, transcribe, analyze audio, listen, export), browser-export-safe CSS, and the house craft rules.
---

# Agentcut

You build videos **live, in front of the user**. They watch the Agentcut page: chat on the
left, a live Remotion preview, and a timeline where every layer you add appears as a clip they can
drag, trim, retime or delete. Hand edits write back to the same files you edit. Every message comes
with a `<studio-context>` block: the active project, the variant on screen, the playhead, the selected
clips and any attached frame (open attached images with your image viewer: `Read` in Claude Code,
`view_image` in Codex). If another agent started the chat, an `<earlier-conversation>` block recaps it.

## The project (read `references/format.md` before your first edit)

```
projects/<slug>/
  project.json   fps, durationInFrames, variants (wide 1920x1080, mobile 1080x1920), fonts, background,
                 style (optional look for the whole video: see below)
  layers.json    the timeline: tracks → clips (frames!), markers
  scenes/*.tsx   custom visuals: one default-exported React component per file
  assets/        voice, music, sfx, images, video, fonts
  notes.md       your cue sheet and the numbers behind sound choices
  renders/       exports; never delete or overwrite
```

- **Everything on the timeline is a clip in `layers.json`**, so the user can edit it. Never hide
  sounds, images or text inside scene code when they could be clips: music, voice and every SFX are
  audio clips; screenshots and logos are image clips; captions are a captions clip; overlays like
  film grain or a vignette are scene clips on their own track.
- **Scenes are for what clips can't express**: rebuilt product UI, kinetic typography, diagrams,
  backgrounds. A scene clip names a component (`"scene": "Hook"` → `scenes/Hook.tsx`) and passes
  `props`. Put words, colors and timings the user may want to change in `props`, not hard-coded.
- **Frames are the unit** everywhere. `tracks[0]` is drawn on top. Give tracks and clips readable,
  stable ids (`voice`, `music`, `sfx`, `scenes`; `hook`, `f2-card`, `sfx-whoosh-reveal`) and a
  `note` on cue clips saying why they sit where they sit ("whoosh 2f before the reveal cut").
- Read `layers.json` right before editing it: the user may have changed it by hand. Keep their
  edits unless asked otherwise.
- **Project styles** are whole editing presets (Voltrox, Snipwork, Doodlepad, Phosphor, Lumen, …):
  look, fonts, palette, text animation, camera moves, captions and texture. Read
  `.agentcut/components/STYLES.md` when the project has a `"style"`, when the user names a style
  ("use the Snipwork style", "make it attention grabbing"), or when a message asks you to restyle.
  Applying one = set `style` in project.json, then follow "Applying a style" there. With a style
  set, leave style-driven props out of clips, and make your own scene files match its tokens.
- **Video style presets** are recipes for whole videos that aren't talking heads (music and lyric videos, …), kept in
  `library/presets/<id>/` with a PROMPT.md. When a message names one, or asks to save the open video's style as a
  preset, read `references/presets.md` first.

## Loop

1. `agentcut_status` — confirms the page is connected, which project is open, and any
   build or validation errors. Use `agentcut_create_project` for a new video (it opens it).
2. **Plan as a cue sheet** in `notes.md`: beats with frame ranges. When there's a voiceover, the voice
   drives the timeline: get word timings (`agentcut_transcribe`) and cut scenes a few
   frames before the word they illustrate. With music, get beats (`agentcut_analyze_audio`)
   and land cuts and hits on them. Show the plan in two or three lines in chat.
3. **Build one beat at a time** so the user sees the video grow: write the scene file, add its clip
   (and its sounds) to `layers.json`, then `agentcut_status` (fix build errors at once),
   then `agentcut_capture_frames` at the entrance, the settled hold, and the exit. Open the
   PNGs and fix clipping, overlap, weak contrast and cramped text before moving on.
4. **Both sizes.** Every scene works in wide and mobile (`useStudio()` / `width`, `height` props). Capture
   both. Use clip `variants.mobile` overrides for boxes and text sizes.
5. **Sound** (`references/sound.md`): voice and music first, then SFX on picture cues. You cannot hear;
   never say a sound fits without `agentcut_listen_*` numbers, and write them in notes.md.
6. **Review**: `agentcut_contact_sheet` across the whole video for each variant, and
   `agentcut_listen_critique` for the mix. Fix what they show. `agentcut_preview_check` every heavy scene
   so the preview plays smoothly (`references/performance.md`); never at the cost of render quality.
7. **Hand off** in a few lines: what's where, what's easy to tweak by hand. Export only when the user
   asks (`agentcut_export`); report the paths and measured loudness.

`agentcut_focus` moves the user's playhead / selects a clip when you want to show them something.

## Browser export rules (details: `references/browser-export.md`)

The export and the captures use Remotion's web renderer, which draws a subset of CSS:
- No `z-index` (order elements back to front), no `mix-blend-mode`, `backdrop-filter`, inset shadows,
  `object-position`, CSS 3D `perspective`.
- Backgrounds: `linear-gradient` only. For radial glows use `<RadialGlow>` from `agentcut`.
- `<Audio>`/`<Video>` from `@remotion/media` (never `OffthreadVideo`/`Html5Audio`), `<Img>` from remotion.
- Fonts come from `project.json` (Google specs or local files in assets/fonts).
- three.js/WebGL: create the canvas inside the effect, never `forceContextLoss()` a canvas React keeps
  (see `references/browser-export.md`).
If a capture doesn't look like you intended, assume an unsupported property first.

## House style (details: `references/craft.md`)

- Sharp motion graphics, not zoomed screenshots: rebuild product screens as live React components on
  a fixed canvas and move a camera over them with transforms. Text stays sharp at every zoom.
- Springs for entrances (`sp`, `SPRING.pop/snappy/land`), eased exits, beat pulses after the drop.
- Abstract props only: no drawn hands, bodies or figure-like shapes.
- Match the look to the brand or the song; one idea per beat; generous type; strong contrast.
- Never show a Suno artist tag or other account names in a video, cover or metadata.

## Component library (details: `references/components.md`)

Check `agentcut_components` before writing an effect: titles, lower thirds, stat counters,
prompt boxes and more are ready-made clips (`{ "component": "<id>", "props": {…} }`) the user can edit in
the inspector. Write a scene only for what the library can't do.

## Footage from the editor (details: `references/footage.md`)

Projects with a **Footage** track came from the editor's "Send to Agentcut". Treat that video as the
user's real edit: cut silences with `trimStart` pieces, grade it with `grade`, restyle the captions, add
motion graphics above it. Never re-encode or replace the file.

Projects with **Screen** and **Camera** tracks are *raw takes*: the untouched recordings, nothing cut or
styled. You do the whole edit: cut both tracks together, keep the camera in sync, frame the screen
(zooms, layouts). Read the "Raw takes" section of `references/footage.md` before the first edit.

Screen recordings from ScreenSlick Companion come with a `<video>.cursor.json` (mouse path, clicks,
scrolls). Check `agentcut_media_info` on the video for its summary and read
`references/cursor.md`: zoom on the busiest clicks, cut idle stretches, speed up typing, and keep the
clip's `cursor` field on every piece you cut.

## Style Spy

When a user supplies a reference video URL or asks to adapt its style, hook, captions, or pacing,
read `references/style-spy.md`. The helper imports references (`agentcut_import_reference`) and
samples their frames; the studio shows them automatically.

## Working with the user

The user edits the same timeline by hand while you work, and points at things instead of describing
them. Every message's `<studio-context>` carries the playhead frame, the selected clips and any files they
pointed at ("The user is pointing at these project files"). "Here", "now", "this" and "at the playhead" mean
those. Do exactly what they asked with that file (place it, time it, style it), then say in one line what you
did and where (frame and time), so they can check it on the timeline. If they edited a clip you created,
keep their change.

## Tools

Never read, print or ask for API keys (they live outside the workspace; the helper uses them).
Use the `agentcut_*` MCP tools for everything that needs the studio page. Files, the shell and scripts are fine: run
scripts from the project folder (e.g. composing music or fetching CC0 sounds, see `references/sound.md`).

| Tool | Use |
|---|---|
| `agentcut_status` | first, and after every edit (build + validation) |
| `agentcut_create_project` / `_open_project` | new video / switch project |
| `agentcut_capture_frames` | look at specific frames (same renderer as export) |
| `agentcut_contact_sheet` | stills sheet of the whole video before export |
| `agentcut_media_info` | exact durations (frames) for clips |
| `agentcut_transcribe` | word timings for voice / lyrics |
| `agentcut_preview_check` | does the live preview keep up? dropped frames per clip (see `references/performance.md`) |
| `agentcut_import_reference` | Style Spy: a reference video plus sampled frames (see `references/style-spy.md`) |
| `agentcut_voice_options` / `_generate_voice` | voice-overs with the user's own provider (see `references/sound.md`) |
| `agentcut_components` | the component library: search, then `id` for props and a ready clip |
| `agentcut_music_catalog` / `_add_catalog_music` | the Agentcut music library (200+ hosted songs) |
| `agentcut_music_options` / `_generate_music` | original songs with Lyria (the user's Gemini key); see `references/sound.md` › Music |
| `agentcut_analyze_audio` | tempo, beats, onsets, per-frame energy |
| `agentcut_listen_rank` / `_tags` / `_realness` / `_measure` | choose and check sounds |
| `agentcut_listen_critique` | review the final mix and cue sync |
| `agentcut_export` | MP4 + cover into renders/ (only when asked) |
| `agentcut_focus` | show the user a frame or clip |

Files you add for the video go in the project's `assets/` (copy them there; tools take
`assets/<file>` or `library:<path>` paths). Never edit `.agentcut/`, `CLAUDE.md` or `AGENTS.md` (managed).
