# Cinematic Mode: product shots with a real camera

A **Cinematic** message hands you screenshots and/or screen recordings and a **direction** (mood, camera
energy, signature move, palette, type, transitions) rolled at random by the studio. Your job: a short,
premium product film in the spirit of Apple launch shots — screens tilted in 3D, lens blur,
UI pieces lifting off the glass, light sweeping across, a camera that always moves with intent.

Every take must look different (follow the direction you were given, don't fall back to your favourite
moves) and every take must look expensive (the quality gate below is not optional).

## The toolkit (`agentcut/components`)

```tsx
import { useCurrentFrame } from "remotion";
import { asset, type SceneProps } from "agentcut";
import { Backdrop, Device3D, Floor, Glare, Group, Lift, Plane, PlaneVideo, Screen, Stage, progress, useStage } from "agentcut/components";
```

It is a real 3D camera: each plane gets one `matrix3d()`, which the preview and the browser export both
draw (the export through WebGL). **Never** add CSS `perspective`, `preserve-3d` or your own 3D transforms
around it; place things with the toolkit's props.

**Draw order is JSX order, not depth.** Nothing sorts by z: write the Stage's children back to front
(backdrop and loops, floor, far planes, the device, lifts and titles in front). A `Device3D` is one
full-frame layer, so a Plane written after it covers it wherever they overlap, whatever their z.

**World units**: px at 1080 on the short side (`useStage().u` scales to the frame). `x` right, `y` down,
`z` toward the viewer; (0,0,0) is the frame center. `useStage()` → `{ width, height, u, vertical, worldWidth,
worldHeight }`: size screens from `worldWidth` so both variants frame well (`vertical` → smaller screens,
narrower moves).

- `<Stage camera={pose | keys} float motionBlur seed background>` — everything 3D goes inside. `camera` is
  one pose or keyframes `{ at: frame, ...pose, ease }`; keys carry values forward, `ease` is the move
  *into* that key: `linear`, `in`, `out`, `inOut` (default), `expo` (premium glide), `back` (small
  overshoot), `whip` (slow–very fast–slow). Pose:
  - `x, y, z`: the point the camera looks at. `zoom`: 1 = things at z 0 at their size, 2 = twice as close.
  - `tilt` (> 0: the camera rises and looks down, so floors and laptop decks show their top), `turn`
    (> 0: the camera orbits left, the right side recedes), `roll` (> 0 clockwise), all degrees. To lay a
    flat screen back like a laptop on a desk, tilt the **Screen/Group** (`tilt 25–55`) and keep the camera
    tilt small (5–20) with some `turn` and `roll`.
  - `fov`: 15–25 flat telephoto (default 24, product look), 35 natural, 50–70 dramatic close-ups.
  - `focus`: a world point `[x, y, z]` (put it ON the thing that matters) or px toward the camera from
    the target. `aperture`: 0 none, 0.4 subtle, 1 strong, 2 macro. Focus and aperture animate: a rack
    focus is two keys with different `focus` points.
  - `shiftX`, `shiftY`: move the subject off-center (fractions of the frame) to leave room for a title.
  - `float` 0–1: handheld drift (0.3–0.6 on holds keeps them alive). `motionBlur` 0–1: blur on fast moves.
- `<Screen kind src width ...placement>` — a screenshot (`src`), a screen recording (`video`, with
  `videoProps` for `volume`, `loop`, `trimBefore`…) or `children` (live React UI) in a device. `kind`: `browser` (+ `url`), `iphone`, `ipad`,
  `monitor`, `none`. `width` is the SCREEN width. Set `aspect` to the screenshot's width/height when it
  differs from the device (or `imageAspect` + `scroll` 0→1 to scroll a tall page). `finish`: `black` /
  `silver` (hardware), `light` / `dark` (browser). Extras: `shadow` (0.7), `reflection` (0–0.5 on dark
  floors), `rim` (glass edge light), `glare` (0→1 sweep position), `dof={false}` to keep it sharp.
- `<Device3D model src size lifts ...placement>` — **real 3D hardware**, and the default for every phone,
  laptop and desktop shot (three.js, drawn through the same camera, studio-lit with real reflections):
  `model` `iphone` (iPhone 16 Pro Max model), `macbook` (keyboard, trackpad, opening lid: animate
  `lidAngle` 0→110), `display` (Studio Display on its foot), `iphone-color` (a modern iPhone in colour: `finish` `graphite` (default), `lavender`, `mist-blue`,
  `white`, `cosmic-orange`, or the brand's hex; pick a colour that suits the palette, show the back in
  orbits and turn-arounds, and use several colours side by side for "for everyone" shots). `src` is the screenshot
  on its screen (it covers the screen; a taller one shows its top, `scroll` 0→1 moves down it). `size` =
  largest dimension in world px (defaults 760 / 1250 / 1150), `finish` `space-black` (MacBook default) `space-gray` `silver` `starlight`
  `midnight` `black` (MacBook, display), `exposure`, `shadow`. `lifts`: pieces of the screenshot that rise
  off the device's screen, `[{ box: [x, y, w, h] (fractions of the SCREENSHOT), z, scale, radius }]` —
  they follow the screen's angle, even on an opening lid. Devices blur as a whole with the lens. Credit
  the iPhone model in the hand-off: "iPhone 16 Pro Max model by MajdyModels, CC BY 4.0".
  **Better laptop if the workspace has one:** check `library/models/` for a user-supplied GLB (e.g.
  `macbook-pro-14.glb`, a Sketchfab "MacBook Pro 14-inch M5" under a licence that forbids bundling it).
  If it's there, prefer `model="macbook-pro" modelSrc={asset("library:models/macbook-pro-14.glb")}` for
  laptop shots: it's far more detailed than the built-in `macbook`. Its lid doesn't open (`lidAngle` is
  ignored), so use the built-in `macbook` for lid-opening shots. Never copy such a model into a project's
  assets or anywhere it would be shared. If it isn't there and the user wants the most realistic laptop,
  tell them they can download it free (their own Sketchfab "Free Standard" licence, fine for their
  videos) from https://sketchfab.com/3d-models/macbook-pro-14-inch-m5-652a992f4f244122ae251f9cbb81da1e
  (the "glb · Original format" download) and save it as `library/models/macbook-pro-14.glb` in the
  workspace. Use `modelSrc` only with `macbook-pro` (or `iphone` with a copy of the same GLB): the
  built-in `macbook`, `display`, `iphone-color` and `iphone-classic` are drawn in code and can't take a GLB.
- **Never** use the flat `Screen` `iphone` / `ipad` / `monitor` frames when the shot shows the
  device: they look like clip-art next to the 3D models. Flat `Screen` is for browser windows
  (`kind="browser"`), frameless UI (`kind="none"`), giant readable close-ups where the hardware is off
  frame, and tall pages you fly over with `scroll`.
- `<Lift src box kind width z scale ...>` — a region of a FLAT Screen rising out of it (for 3D devices use
  `Device3D`'s `lifts`): put it in the same `<Group>` as its `<Screen>` with the same `kind`, `width`, `aspect`. `box` = `[x, y, w, h]` in
  fractions of the screen picture. Animate `z` 0 → 40–140 and `scale` 1 → 1.03–1.15; it casts a real
  shadow on the screen. With the camera looking down (tilt > 0) a lift also travels up the frame.
- `<Group ...placement>` moves/turns screens and their lifts together. `<Plane width height ...>` is the
  raw surface: cards, text, logos, a second screenshot, anything in depth (`radius`, `background`,
  `shadow`, `shadowDepth`, `reflection`, `rim`, `dof`, `blur` for extra softness in world px).
- A Plane with lens blur or a reflection draws its content more than once (blurred and mirrored copies
  under the sharp one). Videos inside a Plane or as Screen `children` must be `<PlaneVideo>` (same props as
  `@remotion/media`'s `<Video>`): only the sharp copy plays sound. Your own heavy content can check
  `usePlaneLayer().copy` and draw less in the copies.
- **Backgrounds are motion loops first** (`references/loops.md`): `<LoopCanvas loop … />` as the
  Stage's first child, or on a big Plane far behind (`z -600…-1200`) so it parallaxes with the camera.
  Rotate loops and tones across shots; add a transparent shape loop as an accent. `<Backdrop>` is for
  quiet shots where the background should disappear.
- `<GenerateReveal …>` as a flat Screen's children: the UI builds itself on the 3D screen like an agent is
  generating it (see `references/loops.md` › Generated by an agent). A strong hook or reveal shot.
- `<Backdrop look>`: `studio` (dark, accent glow), `light` (Apple white), `aurora`, `spotlight`, `mesh`,
  `solid`; `color`, `accent`, `accent2`, `glowX/Y` (animate slowly), `intensity`. First child of the Stage.
- `<Floor y size spacing color opacity glow near>`: a receding grid floor (reads best with tilt 15–35). It is
  drawn in tiles, so the part that passes the lens drops out on its own.
- `<Glare progress angle width strength>` inside any Plane; `progress(frame, from, to, ease)` → 0…1.
- Placement (Screen, Plane, Group, Lift offsets): `x y z tilt turn roll scale`.

## Workflow

1. **Look at every file.** Open each screenshot (Read) and `agentcut_media_info` for size; for a
   recording, capture or sample frames. Find 3–6 **hero regions** per screen (the number that matters,
   the button, the chart, the card with the promise) and measure their `box` fractions from the image.
   Write them in notes.md. Read the product's words: they become the titles.
2. **Shot list in notes.md** (show it to the user in 2–3 lines): 4–7 shots, 1.5–4 s each, for the
   requested length. Each line: subject, camera move, signature effect, focus target, text, frames. Arc:
   **reveal** (the whole product in a bold angle) → **details** (lifts, rack focus, push-ins on hero
   regions, one per shot) → **payoff** (hero angle again, wider or rotated, then the name / CTA).
3. **Build one shot per scene file** (`scenes/Cine01Reveal.tsx` …), one clip each on a "Cinematic" track;
   words, colors and key timings in `props` so the user can tune them. Titles: a library text component
   on a track above, or HTML text on a `Plane` in the stage (text in depth, with blur, is a premium look).
4. **Music**: `agentcut_music_options` for the direction's mood, beats with `agentcut_analyze_audio`;
   land cuts and lift peaks on beats, whips on a downbeat. One whoosh per whip, a soft tick per lift.
5. **Quality gate** (below), then hand off.

## Shot vocabulary (adapt the numbers, combine, invent)

| Move | Recipe |
|---|---|
| Tilt reveal | `<Group tilt={34}>` around the Screen; camera from `zoom 0.75 tilt 14 turn -26 roll 10` to `zoom 1.05 tilt 10 turn -16 roll 8`, `expo`, 70–110 f |
| Hero push | same angle, zoom +15–25 % over the shot, `inOut`, `float 0.4` |
| Rack focus | camera still or drifting; `focus` from region A to B over 20–30 f, `aperture 0.9–1.3` |
| Lift-out | `Device3D` `lifts` (or `Lift` on a flat Screen) z 0→80–140, scale →1.08, `back` or `expo`, focus moves to the lift |
| Push to detail | zoom 1→2.2–3 on a hero region (`x, y` = its world center), aperture up as you go in |
| Fly-over | low `tilt 55–65`, camera `y` travels down the page, `fov 35`, long screenshot with `scroll` |
| Orbit | `Device3D` iPhone: camera `turn` −35 → +25, `tilt` 5–12, `fov 28–32`, a dark backdrop with a glow behind |
| Laptop opens | `Device3D macbook` with `lidAngle` 0→110 over 40–60 f (`expo`), camera `tilt 15–25` pushing in |
| Whip pan | hold, then `x` jumps to the next subject in 12–16 f with `whip`, `motionBlur 1`; cut or keep going |
| Drop-in | device (Screen or Device3D) starts `y −900 tilt 25`, lands with `back`; camera tiny shake via `float` |
| Exploded view | 3–5 Lifts at increasing z (40, 90, 140…) with small `turn`; camera turns 15° to show depth |
| Spotlight | `Backdrop spotlight` glow follows the hero (`glowX/Y`), aperture high, others fall into blur |
| Split screens | two Screens (desktop + phone) at different z; focus pulls from one to the other |
| Glass sweep | `glare` 0→1 over 40–60 f on a hold; `rim 0.6` |
| Dolly zoom | zoom up while fov goes down (or the reverse): the background perspective warps, subject holds |
| Title in depth | a Plane with the headline at z 150–300 in front of the screen, focus on it, screen soft behind |

## Brand colours and variety

Find the brand colours first (logo, UI, website) and build the palette from them
(`references/loops.md` › Brand palette). Every take must differ in loop choice, tone rotation, shapes
and type, not only in camera moves: write the rotation in the shot list, and check notes.md for what
the last take used.

## Taste rules

- **The hero is always sharp.** Put `focus` on it; blur is for what's around it. Never blur text the
  viewer must read during a hold.
- One idea per shot, one signature effect per shot. Motion never stops: every hold drifts (`float`, slow
  zoom), and moves start/stop with eased keys.
- Angles between 8° and 45°; mostly telephoto (fov 18–30). Extreme angles only on whips and reveals.
- Depth everywhere: something nearer than the screen (a lift, a title, a second device) and something
  behind it (backdrop glow, floor). Flat-looking frames fail the gate.
- Never show the screen's edge cutting through the frame at an awkward 2–3 %: either full in frame with
  air, or confidently cropped (≥ 15 % off frame).
- Text: 2–6 words per title, big, with contrast against the backdrop; on screen ≥ 1.2 s.
- Both variants: re-frame per variant with `useStage().vertical` (smaller widths, narrower x travel,
  more vertical moves on mobile), never just let the wide shot crop.
- Contrast pairs that read premium: light UI on `studio`/`spotlight`; dark UI on `light` or `mesh`.

## Quality gate (before you say it's done)

For every shot: `agentcut_capture_frames` at the entrance, the middle and the exit, in wide AND mobile.
Open them and check:
1. The hero region is sharp and readable; the blur falls off naturally (no hard seams).
2. Nothing important is clipped; edges are either clean or boldly cropped.
3. There is depth (foreground + background), and the frame isn't empty or flat.
4. Titles are readable and don't collide with UI.
5. The move has a clear start and end (compare entrance vs exit).
Then `agentcut_contact_sheet` over the whole video (pacing, variety: no two consecutive shots with the
same angle and move) and `agentcut_preview_check` (each Plane with lens blur draws several copies; if a
shot is choppy, lower `aperture` on secondary planes or set `dof={false}` on them, never on the hero in
the export path). Fix what fails and re-capture. Write what you checked in notes.md.

## Takes

"Another take" asks for a new film from the same media with a new direction. Before changing anything,
copy project.json, layers.json and scenes/ to a new timestamped folder under `.studio/cinematic-takes/`
(never overwrite one). Then replace the Cinematic track and its scenes: new shot list, new moves, new
backdrop and type. Reusing the previous take's structure with new colors is a failure.
