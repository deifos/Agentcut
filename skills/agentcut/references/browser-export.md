# Browser export: what the renderer can draw

Captures (`agentcut_capture_frames`, `_contact_sheet`) and the export use Remotion's web renderer
(`@remotion/web-renderer`, encoding with Mediabunny). It walks the DOM and draws each element onto a canvas,
so it supports a **subset** of CSS. The live preview (Remotion Player) is a normal browser page and shows
everything — so a scene can look right in the preview and wrong in the export. Always judge by captures.

## Replace these

| Don't use | Use instead |
|---|---|
| `z-index` | order elements back to front in the DOM (later = on top) |
| `background: radial-gradient(…)` / `conic-gradient` | `<RadialGlow x y radius color opacity />` from `agentcut`, or an inline `<svg>` with `<radialGradient>` |
| `background-image: url()` | `<Img>` or an image clip |
| `mix-blend-mode`, `background-blend-mode` | pre-blended colors, opacity, or an SVG with the effect baked in |
| `backdrop-filter` (glass blur) | a semi-opaque fill + a blurred copy of the background behind it |
| `box-shadow: inset …`, shadow spread | an inner element with a gradient/border, or an outer shadow without spread |
| `object-position` | position the `<Img>` inside an `overflow: hidden` box with transforms |
| `perspective`, `transform-style: preserve-3d` | the cinematic `Stage` / `Plane` from `agentcut/components` (one `matrix3d()` per element, drawn through WebGL; see `cinematic.md`), or 2D transforms faking depth |
| `mask-image` with radial/SVG masks | linear-gradient masks, or `clip-path` shapes (`inset`, `circle`, `polygon`) |
| `clip-path: url(#svgClip)` | `clip-path: polygon(…)` / `circle(…)` |
| `OffthreadVideo`, `Html5Video`, `Html5Audio` | `<Video>` / `<Audio>` from `@remotion/media` (or video/audio clips) |
| `writing-mode`, wavy `text-decoration` | rotated boxes, SVG paths |
| fonts from CSS `@import` / `<link>` in scenes | `project.json` → `fonts` |

Supported and safe: flexbox/grid layout, `transform` (2D), `opacity`, `filter` (blur, brightness…; not in
Safari), `linear-gradient` backgrounds, `border-radius`, borders, outer `box-shadow`, `text-shadow`,
`clip-path` shapes, inline SVG (gradients, paths, filters inside the SVG), `<Img>`, canvas.

Text inside SVG `<text>` or `foreignObject` doesn't get project fonts: prefer HTML text.

## Checklist after writing a scene

1. `agentcut_status` → no build errors.
2. Capture its entrance, hold and exit in both variants.
3. Compare with what you meant. Missing glow, wrong stacking, hard edges where a blend was → one of the
   properties above.
4. If an effect can't be done within these rules and the user wants it, say so: the "Render on this
   computer" export (classic Remotion renderer) draws full CSS, but the captures won't show it.

Shader transitions (`@remotion/transitions` zoom-blur, film-burn, …) use WebGL: they render in the browser
but slowly; check a capture of a transition frame before relying on one.

## WebGL / three.js scenes

- Create the `<canvas>` **inside** the effect (`document.createElement("canvas")`, append it to a container
  `<div ref>`), and remove it in the cleanup. Never call `renderer.forceContextLoss()` on a canvas React
  keeps: the dev server mounts every component twice, and the second mount gets a dead context
  ("Cannot read properties of null (reading 'precision')").
- `preserveDrawingBuffer: true` so captures and the export can read the pixels; render synchronously for the
  current frame (`useCurrentFrame()`), never in `requestAnimationFrame`.
- One renderer per scene, sized to the composition (`useVideoConfig()`), `setPixelRatio(1)`. Dispose
  geometries, materials, textures and the renderer in the cleanup. Browsers allow ~16 live WebGL contexts.
- Keep the live preview smooth. The Player draws 30 frames a second on the page's main thread; when a
  frame takes longer, it skips frames, and the user sees stutters and jumps. Use `usePreviewQuality()` from
  `agentcut`: `renderer.setPixelRatio(q.pixelRatio)`, `shadow.mapSize.set(q.shadowMapSize, …)`,
  and redraw big canvas textures (`needsUpdate`) only every `q.textureEvery` frames. Captures and the export
  always get full quality.
- Call `renderer.compile(scene, camera)` at the end of setup so shaders compile while the scene is
  premounted (clips mount 1 s early in the preview), not on its first visible frame.
- Capture a frame of every 3D scene in both variants before moving on.
