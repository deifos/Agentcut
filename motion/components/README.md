# Agentcut motion components

Ready-made Remotion animations that people and Claude drop on the Agentcut timeline and tune
through props, without writing a scene. The same code runs in the studio preview, the browser export,
a local render and the public gallery.

## How a component is used

In a project's `layers.json`, a scene-track clip names the component instead of a scene file:

```json
{ "id": "title", "from": 0, "duration": 90, "component": "text-reveal",
  "props": { "lines": ["Make videos", "with *Claude*"], "accent": "#34d399" } }
```

Props left out get their defaults. The inspector shows a form for them; Claude finds components with
`agentcut_components`.

## Add a component

1. Make a folder: `motion/components/<id>/` (kebab-case id).
2. `<Name>.tsx`: a React component that takes `MotionBaseProps` (width, height, fps, durationInFrames,
   variant) plus its props. Rules:
   - Animate only from `useCurrentFrame()` (no timers, no `Math.random()` without a seed), so the
     preview, the export and every re-render match frame for frame.
   - Import only `react`, `remotion`, `../lib` and `../looks`. No CSS 3D (`perspective`, `preserve-3d`),
     `backdrop-filter`, `mix-blend-mode` or inset shadows: the browser export can't draw them.
   - Radial gradients: the browser export only draws centered, unsized ones
     (`radial-gradient(color 0%, transparent 70%)`). For a glow at a point use `glowStyle()`, and fade
     to `alpha(color, 0)` rather than `transparent`. Blur with `blurStyle()` so the blur isn't clipped.
     SVG (filters, masks, patterns) is drawn as an image, so it renders exactly.
   - Fonts: use `FONTS` (Inter, Bricolage, Instrument Serif, Fraunces, Space Grotesk, Syne, Unbounded,
     Anton, Geist Mono). The registry loads them before any frame renders.
   - Size everything from `unit(width, height)` so it works in wide (16:9) and mobile (9:16).
   - Fit any clip length: enter at the start, use `exitOut()` for the end.
   - `layer: "overlay"` components keep a transparent background unless a `background` prop is set.
3. `meta.json`: id, name, category, description, `useWhen` (when Claude should pick it), a good
   `durationInFrames`, tags, `props` (each with type, label, default and limits) and 2–3 `examples`.
4. Let it follow project styles: tag the props that carry the look with a token, e.g.
   `"accent": { "type": "color", "style": "accent", … }`. Tokens: `look`, `font`, `weight`, `text` (text over
   footage), `accent`, `onAccent`, `panel`, `panelText`, `line`, `theme`, `backdrop` (see `styles.ts`). Leave a
   component untagged when its look is the point (arcade, collage, platform mock-ups).
5. Register it: its meta in `catalog.ts` and its component in `COMPONENTS` in `index.ts`.
6. Check it: open the gallery (`/motion/components`) and look at it in wide and mobile, then
   `npm run verify:components` (registration, defaults, examples and style tags).

## Project styles

A style is a whole editing preset. `looks.tsx` draws its graphic language (ink, paper, notebook,
crt, clean: cards, word chips, stickers, backdrops, entrances); the Talking Head components are
layouts built from it, so they restyle completely with the `look` prop. `style-layer.tsx` is what the
studio runtime calls for a project with a style: the camera on footage clips, the texture over the
frame and captions drawn in the look.

`styles.json` holds the styles a project can pick (`"style": "loud"` in project.json, or the Style
list in the studio's Project panel). A tagged prop the clip leaves out takes the style's value;
caption and text clips take the style's fonts and colors. Add a style there; `verify:components`
checks that its font lands on every component that takes one.

The helper gets a copy of this folder for local renders and for Claude to read
(`npm run sync:skill` in packages/agentcut copies the skill and the components).
