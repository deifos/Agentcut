import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callEditor, persistAgentFrameResult } from "../bridge.js";

// Agentcut tools. File work (create/state) is answered by the
// agentcut helper; pixels and audio by the studio page in the browser.

const project = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
  .optional()
  .describe("Project slug. Defaults to the project open in the studio page.");
const variant = z.string().optional().describe('Variant to render, e.g. "wide" or "mobile". Defaults to the one on screen.');
const projectPath = z
  .string()
  .min(1)
  .describe('A project file ("assets/voice.wav") or a library file ("library:sfx/whoosh.wav").');

const MINUTE = 60_000;

function text(value: unknown) {
  return {
    content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  };
}

function pageMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /No Agentcut page|disconnected|isn't an Agentcut tool|not running|ECONNREFUSED|fetch failed/i.test(message);
}

async function page(method: string, params: unknown, timeoutMs: number) {
  try {
    return persistAgentFrameResult(await callEditor(method, params, { timeoutMs }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // An Agentcut tab opened before an update doesn't know the newer page tools.
    if (message.includes(`"${method}" isn't an Agentcut tool`)) {
      throw new Error(
        `The open Agentcut tab is older than this helper and doesn't have ${method}. Ask the user to reload the Agentcut tab, then try again.`,
      );
    }
    if (pageMissing(error)) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nThe studio page must be open: ask the user to open Agentcut in their browser and keep \`npx -y agentcut\` running.`,
      );
    }
    throw error;
  }
}

function defineTool<T extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  shape: T,
  run: (args: z.objectOutputType<T, z.ZodTypeAny>) => Promise<unknown>,
) {
  const handler = async (args: unknown) => {
    const parsed = z.object(shape).strict().parse(args ?? {});
    return text(await run(parsed as z.objectOutputType<T, z.ZodTypeAny>));
  };
  // The SDK's generic callback type doesn't infer through this helper.
  server.registerTool(name, { description, inputSchema: shape as z.ZodRawShape }, handler as never);
}

export function registerStudioTools(server: McpServer) {
  defineTool(
    server,
    "agentcut_status",
    "Agentcut status: workspace folder, which project the user has open, playhead and selection, the project's tracks, build errors (esbuild) and project.json/layers.json validation issues, and how smoothly the preview plays (page.previewPerformance: lastCheck and the user's playback, with the clips that drop frames). Call it first, and after every edit to scenes or layers.json to confirm the build and files are valid.",
    { project },
    async ({ project: slug }) => {
      const workspace = (await callEditor("studio.local.workspace", {}, { timeoutMs: 15_000 })) as Record<string, unknown>;
      let pageStatus: Record<string, unknown> | null = null;
      try {
        pageStatus = (await callEditor("studio_page_status", {}, { timeoutMs: 10_000 })) as Record<string, unknown>;
      } catch (error) {
        pageStatus = { connected: false, note: error instanceof Error ? error.message : String(error) };
      }
      const active = slug ?? (typeof pageStatus?.activeProject === "string" ? pageStatus.activeProject : null) ?? process.env.AGENTCUT_PROJECT ?? null;
      const state = active ? await callEditor("studio.local.project_state", { slug: active }, { timeoutMs: 2 * MINUTE }) : null;
      return { workspace, page: pageStatus, project: state };
    },
  );

  defineTool(
    server,
    "agentcut_create_project",
    "Create a new Studio project (project.json, empty layers.json, scenes/, assets/, renders/, notes.md) and open it in the user's studio page. Default variants: wide 1920x1080 and mobile 1080x1920 at 30 fps.",
    {
      name: z.string().min(1),
      slug: project,
      fps: z.number().int().min(1).max(120).optional(),
      durationInFrames: z.number().int().min(1).optional(),
      variants: z.record(z.object({ width: z.number().int(), height: z.number().int() })).optional(),
      defaultVariant: z.string().optional(),
      background: z.string().optional(),
      fonts: z.array(z.string()).optional().describe('Google Fonts specs like "Inter:400;800".'),
    },
    async (args) => callEditor("studio.local.create_project", args, { timeoutMs: 30_000 }),
  );

  defineTool(
    server,
    "agentcut_open_project",
    "Switch the user's studio page to another project.",
    { project: z.string().min(1) },
    async (args) => page("studio_open_project", args, 2 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_capture_frames",
    "Render frames of the project with the same in-browser renderer the export uses, saved as PNG files you can open with Read. Use it after each beat: mid-entrance, settled hold, exit. Anything the browser export can't draw (unsupported CSS) shows up here. Max 24 frames per call.",
    {
      frames: z.array(z.number().int().min(0)).min(1).max(24),
      variant,
      scale: z.number().min(0.1).max(2).optional().describe("Output scale, default 1 (0.5 for 4K variants); 2 for a sharp crop to reuse as an image."),
      region: z
        .object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() })
        .optional()
        .describe("Only this part of the frame, in composition pixels (e.g. one card to draw as an <Img>)."),
      project,
    },
    async (args) => page("studio_capture_frames", args, 5 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_contact_sheet",
    "One PNG grid of many frames with frame/time labels: a stills sheet to review pacing and layout before export. Pass frames, or from/to/every (frames). Up to 48 frames.",
    {
      frames: z.array(z.number().int().min(0)).max(48).optional(),
      from: z.number().int().min(0).optional(),
      to: z.number().int().min(0).optional(),
      every: z.number().int().min(1).optional(),
      columns: z.number().int().min(1).max(10).optional(),
      variant,
      project,
    },
    async (args) => page("studio_contact_sheet", args, 10 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_preview_check",
    "Check that the live preview plays smoothly: plays from/to (frames, default the whole video, max 60 s per call) muted in the user's preview at real speed and returns, per visual clip, frames played and dropped (the preview skips frames it can't draw in time), loading stalls and the most DOM elements the clip drew, with a verdict (smooth, choppy, heavy) and slowClips likeliest cause first. Takes as long as the range plays; one check at a time. Stops if the user pauses or seeks. Run it after building or changing a heavy scene (walls, grids, many elements, image sequences, big blurs) and before you say you're done; fix choppy or heavy clips with the skill's Preview performance rules, which never lower render quality. Preview only: exports render every frame at full quality. agentcut_status also reports the user's own playback.",
    {
      from: z.number().int().min(0).optional(),
      to: z.number().int().min(0).optional(),
      variant,
      project,
    },
    async (args) => page("studio_preview_check", args, 5 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_import_reference",
    "Style Spy: bring a reference video into the project for style analysis. With `url` (a public Instagram, TikTok, YouTube or X link) the helper downloads it; with `path` (a video already in assets/references/<id>/, e.g. an upload) it only prepares it. Either way it saves video.mp4, reference.json (cuts, shots), a frame per shot with an overview sheet, and motion strips (hook, every cut, captions) under assets/references/<id>/ and shows the video in Style Spy. Returns the paths. If a link needs a login, the user retries from Style Spy with their browser login: never ask for passwords or cookies.",
    {
      url: z.string().url().optional(),
      path: z.string().regex(/^assets\/references\/[a-zA-Z0-9_-]+\/[^/]+$/).optional(),
      project,
    },
    async ({ project: slug, url, path }) => {
      if (!url === !path) throw new Error("Pass either url or path.");
      return callEditor("studio.local.import_reference", { slug, url, path }, { timeoutMs: 10 * MINUTE });
    },
  );

  defineTool(
    server,
    "agentcut_media_info",
    "Duration (seconds and frames at the project fps), size, sample rate and channels of project media files. Use it to set clip durations exactly. For screen recordings with a <video>.cursor.json (ScreenSlick Companion), also returns a cursor summary: click count, the busiest stretches (where to zoom), idle stretches (cut candidates) and typing (speed-up candidates).",
    { paths: z.array(projectPath).min(1).max(40), project },
    async (args) => page("studio_media_info", args, 2 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_transcribe",
    "Word timings for a voice or song file with Whisper running in the user's browser. Returns words with start/end seconds and frames. model: tiny | base (default) | small (slower, better).",
    {
      path: projectPath,
      language: z.string().optional().describe('Whisper language code, default "en".'),
      model: z.enum(["tiny", "base", "small"]).optional(),
      project,
    },
    async (args) => page("studio_transcribe", args, 20 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_analyze_audio",
    "Analyze a music/voice file: tempo, beat/downbeat/strong-beat frames, onset frames, per-frame energy (full, low, high, 0..1) and loudness. Use it to cut scenes on beats and drive beat-reactive visuals.",
    { path: projectPath, project },
    async (args) => page("studio_analyze_audio", args, 5 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_listen_measure",
    "Measure audio like a mastering meter: integrated loudness (LUFS), momentary/short-term max, loudness range, sample and true peak, onset offset (silence before the sound starts). Pass paths, or mix=true to measure the project's whole audio mix.",
    {
      paths: z.array(projectPath).max(40).optional(),
      mix: z.boolean().optional(),
      variant,
      project,
    },
    async (args) => page("studio_listen_measure", args, 5 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_listen_rank",
    "Rank sound files against a plain description of the sound (source + action + character, e.g. \"a single crisp computer mouse click\") using CLAP audio-text embeddings in the browser. Returns similarity and z-score per file (z >= 3 is a strong match). You cannot hear: use this before claiming a sound fits.",
    {
      query: z.string().min(3),
      paths: z.array(projectPath).min(1).max(80),
      top: z.number().int().min(1).max(40).optional(),
      project,
    },
    async (args) => page("studio_listen_rank", args, 15 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_listen_tags",
    "What a sound is, as AudioSet labels with probabilities (AST model in the browser), per file.",
    {
      paths: z.array(projectPath).min(1).max(40),
      top: z.number().int().min(1).max(20).optional(),
      project,
    },
    async (args) => page("studio_listen_tags", args, 15 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_listen_realness",
    "Estimate whether each file is a real recording or code-synthesized (p_real 0..1 with the evidence). Prefer p_real >= 0.5 for sound effects.",
    { paths: z.array(projectPath).min(1).max(40), project },
    async (args) => page("studio_listen_realness", args, 15 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_listen_critique",
    "Mix the project's audio exactly as the export will and review it: loudness vs the −14 LUFS target, true peak, clipping, silent gaps, voice vs music balance, and whether each SFX lands on its cue (scene starts, markers). Returns timestamped findings to fix before export.",
    {
      variant,
      fast: z.boolean().optional().describe("Skip the realness pass (seconds instead of a minute)."),
      project,
    },
    async (args) => page("studio_listen_critique", args, 15 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_export",
    "Export MP4s (H.264/AAC) in the user's browser, loudness-normalized to −14 LUFS, into the project's renders/ folder with a cover PNG. Only export when the user asks for it. Defaults to every variant.",
    {
      variants: z.array(z.string()).optional(),
      coverFrame: z.number().int().min(0).optional(),
      normalizeLoudness: z.boolean().optional(),
      videoCodec: z.enum(["h264", "vp9", "av1"]).optional().describe("Default h264. vp9/av1 only if the browser has no H.264 encoder."),
      project,
    },
    async (args) => page("studio_export", args, 60 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_focus",
    "Show the user something: move the studio playhead to a frame and/or select a clip (by id), optionally switching variant.",
    {
      frame: z.number().int().min(0).optional(),
      clipId: z.string().optional(),
      variant,
      project,
    },
    async (args) => page("studio_focus", args, MINUTE),
  );

  defineTool(
    server,
    "agentcut_voice_options",
    "Voice-over providers the user has set up (ElevenLabs, Gemini, OpenAI, Grok/xAI), their default, models and voices. Pass provider: \"elevenlabs\" to list that account's voices (ids). Call before generating a voice-over. API keys are handled by the helper: never ask for them.",
    { provider: z.enum(["elevenlabs", "gemini", "openai", "xai"]).optional() },
    async (args) => callEditor("studio.local.voice_options", args, { timeoutMs: MINUTE }),
  );

  defineTool(
    server,
    "agentcut_generate_voice",
    "Generate a voice-over with the user's own provider key and save it to assets/voice/ in the project (never overwrites). Uses the user's default provider unless they named another. Returns each take's path and length. Then check the words with agentcut_transcribe before using a take.",
    {
      project,
      text: z.string().min(1).describe("Exactly the words to speak. No stage directions (use style)."),
      provider: z.enum(["elevenlabs", "gemini", "openai", "xai"]).optional(),
      model: z.string().optional().describe('e.g. "gemini-3.8-flash-tts", "eleven_v3", "gpt-4o-mini-tts".'),
      voice: z.string().optional().describe('Voice name/id, e.g. "Puck" (Gemini), "marin" (OpenAI), "eve" (Grok), an ElevenLabs voice id.'),
      style: z.string().optional().describe("Delivery notes (tone, pace, pronunciation). Gemini and OpenAI only."),
      language: z.string().optional().describe('Language code, e.g. "en", "es".'),
      speed: z.number().optional(),
      name: z.string().optional().describe('File name, e.g. "launch-vo" → assets/voice/launch-vo.wav.'),
      takes: z.number().int().min(1).max(4).optional().describe("Takes to generate in parallel (default 1)."),
    },
    async ({ project: slug, ...input }) => callEditor("studio.local.generate_voice", { ...input, slug }, { timeoutMs: 5 * MINUTE }),
  );

  defineTool(
    server,
    "agentcut_components",
    "The Agentcut motion component library: ready-made, export-safe animations (titles, lower thirds, stats, AI prompt boxes, …) you put on a scene track as { component, props } instead of writing a scene. Check it before building an effect yourself. Without id: search by words or category. With id: the full props (types, defaults, limits), examples and a ready clip for layers.json.",
    {
      query: z.string().optional().describe('Words to match, e.g. "title", "speaker name", "percentage".'),
      category: z.enum(["Text & Titles", "Overlays", "Charts & Stats", "AI & Product", "Backgrounds", "Transitions"]).optional(),
      id: z.string().optional().describe('A component id, e.g. "text-reveal".'),
    },
    async (args) => page("studio_components", args, MINUTE),
  );

  defineTool(
    server,
    "agentcut_music_catalog",
    "Search the Agentcut music library: the 200+ licensed songs hosted for the editor (energetic, chill, cinematic, electronic, ambient). Use it when the user asks for a library song or a library track. Filter by words in the name/category, category and length; with no filters it lists everything. Then add candidates with agentcut_add_catalog_music.",
    {
      query: z.string().optional().describe('Words to match in the track name or category, e.g. "glow launch".'),
      category: z.enum(["energetic", "chill", "cinematic", "electronic", "ambient"]).optional(),
      minSeconds: z.number().optional().describe("Shortest track length you can use (the video length)."),
      maxSeconds: z.number().optional(),
    },
    async (args) => page("studio_music_catalog", args, MINUTE),
  );

  defineTool(
    server,
    "agentcut_add_catalog_music",
    "Copy Library songs (ids from agentcut_music_catalog) into the project's assets/music/ so they play, analyze and export like any asset. Up to 8 at a time; skips ones already there. To choose by ear: add 3–6 candidates, rank them with agentcut_listen_rank / _tags against the vibe, keep the best, delete the rest.",
    {
      project,
      ids: z.array(z.string()).min(1).max(8),
    },
    async (args) => page("studio_add_catalog_music", args, 5 * MINUTE),
  );

  defineTool(
    server,
    "agentcut_music_options",
    "Whether Lyria music generation is available (the user's Gemini key, saved under Voices) and which models. Call before making a new song.",
    {},
    async (args) => callEditor("studio.local.music_options", args, { timeoutMs: MINUTE }),
  );

  defineTool(
    server,
    "agentcut_generate_music",
    "Generate an original music bed with Google Lyria (the user's Gemini key; the helper adds it) and save it to assets/music/ (never overwrites). Write the prompt like a brief: \"Instrumental only, no vocals.\", total length, key and steady BPM, instruments, mix, then [m:ss - m:ss] sections that follow the video's beats (intro, build, drop on the reveal, final hit, ring-out). No artist or song names. Takes 1–3 minutes per take.",
    {
      project,
      prompt: z.string().min(1).describe("The music brief (see the tool description)."),
      name: z.string().optional().describe('File name, e.g. "launch-bed" → assets/music/launch-bed.wav.'),
      takes: z.number().int().min(1).max(3).optional().describe("Takes in parallel (default 1; 2 for anything that matters)."),
      model: z.enum(["lyria-3.5", "lyria-3-clip-preview"]).optional().describe("lyria-3.5 (default): length from the prompt. Clip: always 30 s."),
    },
    async ({ project: slug, ...input }) => callEditor("studio.local.generate_music", { ...input, slug }, { timeoutMs: 10 * MINUTE }),
  );
}
