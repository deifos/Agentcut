# The Agentcut component library

Ready-made, tested animations: titles, lower thirds, stat counters, an AI prompt box, and more over
time. They follow the export rules, work in wide and mobile, and fit any clip length (enter at the start,
exit at the end). The user edits their props in the inspector, so a component clip is something you and
the user both tune; a scene file is only editable by code.

## Use them first

Before writing an effect yourself, call `agentcut_components` with a few words ("title",
"speaker name", "percentage", "chat"). If one fits, use it; combine several (a Text Reveal over footage,
then a Stat Counter) before writing a scene. Write a scene only for what the library can't do, and say
so in one line ("no library component draws a 3D orbit, so I wrote scenes/Orbit.tsx").

## Put one on the timeline

1. `agentcut_components` with `id` gives the props (types, defaults, limits), examples and a
   ready clip.
2. Add the clip to a scene track (a track named "Motion" for overlays, above the footage):
   `{ "id": "title-1", "from": 0, "duration": 90, "component": "text-reveal", "props": { "lines": ["Make videos", "with *Claude*"] } }`
   Put only the props you change; the rest use their defaults.
3. Check with `agentcut_status` (it flags unknown components and props out of range) and
   `agentcut_capture_frames` (look at the frame).

Rules:
- Match the project. With a project `style` set, leave out the props it controls (listed in
  `.agentcut/components/STYLES.md`): they follow the style. Without one, pass the brand colors
  (`accent`, `color`, `background`) and fonts the project uses.
- `layer: "overlay"` components are transparent: put them on a track above the content they sit on.
- Timing: the clip's `duration` is the component's length. Keep the suggested `durationInFrames` unless
  the edit needs it longer or shorter; line `from` up with beats and cuts like any clip.
- When the user changes a prop by hand, keep it.

## Suggest new ones

When you build an effect that would be useful again (it's not tied to this one video), tell the user in one
line: "This would make a good library component." The library lives in the Agentcut repo
(`motion/components`); its README explains how to add one.
