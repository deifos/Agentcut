# Project format (v1)

All times are **integer frames** at `project.fps`. Clip `from` is the timeline frame where the clip
starts; `duration` is its length in frames. Inside a clip (scene code, caption words, fades) frames are
**relative to the clip start**.

## project.json

```json
{
  "version": 1,
  "name": "Rolino launch",
  "fps": 30,
  "durationInFrames": 1800,
  "background": "#060a16",
  "variants": {
    "wide": { "width": 1920, "height": 1080 },
    "mobile": { "width": 1080, "height": 1920 }
  },
  "defaultVariant": "wide",
  "fonts": [
    "Inter:400;600;800",
    { "family": "Brand Onest", "src": "assets/fonts/onest-700.woff2", "weight": "700" }
  ]
}
```

- `durationInFrames` is the export length; keep it equal to the end of the last clip.
- Fonts: Google Fonts specs (`"Family:400;700"`) or local files (preferred for brand fonts: renders
  then never depend on Google Fonts). Reference them by `family` in styles.

## layers.json

```json
{
  "version": 1,
  "tracks": [
    { "id": "captions", "name": "Captions", "kind": "captions", "clips": [] },
    { "id": "text", "name": "Titles", "kind": "text", "clips": [] },
    { "id": "grain", "name": "Film grain", "kind": "scene", "clips": [] },
    { "id": "scenes", "name": "Scenes", "kind": "scene", "clips": [] },
    { "id": "voice", "name": "Voice", "kind": "audio", "clips": [] },
    { "id": "music", "name": "Music", "kind": "audio", "clips": [] },
    { "id": "sfx", "name": "SFX", "kind": "audio", "clips": [] }
  ],
  "markers": [
    { "id": "m-drop", "frame": 204, "label": "Drop", "kind": "beat" },
    { "id": "m-reveal", "frame": 198, "label": "Reveal", "kind": "section" }
  ]
}
```

`tracks[0]` is drawn **on top**; later tracks are drawn underneath. Clips on a track are sorted by
`from`. Clips may overlap only on `scene` and `audio` tracks (use more tracks otherwise).

Track fields: `id` (kebab-case, unique), `name`, `kind`, `clips`, optional `hidden` (visual), `muted`
(audio/video), `locked` (user lock — don't move locked clips), `volume` (audio track gain).

Markers (`section` = scene starts, `cue` = moments sounds/animations hit, `beat` = music beats you rely
on) show on the timeline ruler. Keep section markers in sync with scene clips.

### Clip fields (all kinds)

| field | |
|---|---|
| `id` | unique in the project, stable, readable |
| `name` | timeline label (optional) |
| `from`, `duration` | frames |
| `enter`, `exit` | `{ "preset": "fade" \| "slide-up" \| "slide-down" \| "slide-left" \| "slide-right" \| "pop" \| "scale" \| "blur" \| "none", "frames": 12 }` (visual clips) |
| `opacity` | 0..1 (visual clips) |
| `note` | why the clip is there (cue reason) |
| `variants` | per-variant overrides, e.g. `{ "mobile": { "box": {…}, "style": {…} } }` |

`box` = `{ "x", "y", "width", "height" }` as fractions of the frame (0..1), top-left origin.

### Kinds

**scene** — `{ "scene": "Hook", "props": { … } }` renders `scenes/Hook.tsx`; or
`{ "component": "text-reveal", "props": { … } }` renders a library component (one of the two per clip;
see `references/components.md`).

**audio** — `{ "src": "assets/voice.wav", "volume": 1, "trimStart": 0, "fadeIn": 0, "fadeOut": 0, "loop": false, "playbackRate": 1, "role": "voice" | "music" | "sfx" | "ambience" }`.
`trimStart` skips frames of the file. Set `duration` from `agentcut_media_info` (frames). An SFX
clip's `from` is the cue frame minus the file's onset (see sound.md).

**video** — `{ "src", "trimStart", "volume", "muted", "fit": "cover" | "contain", "box", "playbackRate", "grade" }`.
`grade` — `{ "brightness": 1, "contrast": 1, "saturation": 1, "warmth": 0, "hue": 0 }` (neutral values;
brightness/contrast/saturation 0–3, warmth −1…1, hue −180…180 degrees). Leave out what you don't change.
Footage from the editor: see `references/footage.md`.

**image** — `{ "src", "fit", "box", "radius" }`.

**text** — `{ "text", "box", "style": { "fontFamily", "fontSize" (px at the variant size), "fontWeight", "color", "align", "lineHeight", "letterSpacing", "textTransform", "shadow" } }`. For styled kinetic type use a scene instead.

**captions** — `{ "words": [{ "text", "from", "to" }], "style": { "preset": "pop" | "karaoke" | "plain", "fontFamily", "fontSize", "fontWeight", "color", "highlight", "position": "bottom" | "center" | "top", "maxWordsPerLine" } }`.
Word `from`/`to` are frames **relative to the clip start**. Build them from `agentcut_transcribe`
(`fromFrame - clip.from`). For custom caption looks, write a scene that takes `words` in props.

`src` forms: `assets/<file>`, `library:<path>` (workspace library shared by projects), `https://…` (must
allow CORS).

## Scenes

```tsx
// scenes/Hook.tsx
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { RadialGlow, SPRING, ease, sp, mix, useStudio, type SceneProps } from "agentcut";

type Props = SceneProps & { title: string; accent: string };

export default function Hook({ title, accent, width, height, clip }: Props) {
  const f = useCurrentFrame();            // 0 at the clip start
  const vertical = height > width;
  const s = sp(f, 6, SPRING.pop);         // spring starting at local frame 6
  const out = ease(f, clip.duration - 8, clip.duration);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg,#0b0b14,#050507)", opacity: 1 - out }}>
      <RadialGlow x={0.5} y={0.45} radius={0.5} color={accent} opacity={0.25} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "Inter", fontWeight: 900, fontSize: vertical ? 140 : 120,
                      transform: `translateY(${mix(60, 0, s)}px)`, color: "#fff" }}>{title}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
```

Scene props: everything in the clip's `props`, plus `clip` (`id`, `from`, `duration`), `variant`,
`width`, `height`, `fps`.

`agentcut` exports: `useStudio()` (project, variant, width, height, fps), `useIsVertical()`, `usePreviewQuality()`
(cheaper drawing in the live preview, full quality in captures/export),
`asset(path)` (URL for `assets/…` / `library:…`), `clamp`, `mix`, `ease(f, from, to, easing?)`,
`sp(f, start, config?, duration?)`, `SPRING` (smooth, snappy, bouncy, pop, land), `sec(seconds)`,
`<RadialGlow>`, `<FrameBox>`, and the format types.

Shared helpers for several scenes go in `scenes/lib/*.ts(x)` (files in subfolders aren't scenes).
Available packages: `react`, `remotion`, `@remotion/media`, `@remotion/transitions` (+ presentations),
`@remotion/shapes`, `@remotion/paths`, `@remotion/noise`. Anything else: `npm install` it in the
workspace root and it gets bundled.
