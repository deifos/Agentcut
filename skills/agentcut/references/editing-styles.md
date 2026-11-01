# Reusable editing styles

An editing style is a named prompt that describes **how to edit different footage**. It is separate from
the built-in talking-head looks and the scene/asset kits in `library/presets/`.

## Save current style

The plus action beside Styles in chat, or Save current style in the gallery, sends a save request with a name.
Saving must not change the source video.

1. Inspect the named source project's `project.json`, `layers.json`, relevant scene code, captions, video cuts,
   effects and audio settings. Read available conversation/history from this editing session. Do not claim access
   to unavailable history. MCP file tools do not expose private chat state.
2. Extract supported rules. Consider speech cleanup (duplicate/repeated takes, filler words and pauses), B-roll
   selection and placement, zoom emphasis, transitions, caption appearance, pacing, graphics and sound balance.
   These are inspection topics, **not defaults**. Include only choices shown by the project or confirmed in history.
   A cut timeline alone does not prove that filler words or duplicate takes were removed. Distinguish observed
   settings from confirmed intent. Do not infer a fixed transition interval, such as five seconds, from an example.
3. Write a standalone reusable prompt. Include a short purpose, evidence-backed rules, inputs needed for another
   video, review steps and limits/unknowns. Preserve exact settings where useful (caption fonts/colors/position,
   audio levels, a built-in style ID); turn source timestamps into content-based placement rules only where supported.
   If the evidence is too weak to identify an editing style, explain what is missing instead of inventing rules.
4. Require fresh content: inspect the new footage and transcript, choose relevant new B-roll, and create text,
   animations and sound to fit it. Do not copy the source's scenes, footage, B-roll, transcript, names, personal facts
   or fixed timeline positions. The saved prompt must work without access to the original project.
5. Call `agentcut_save_editing_style` with `name` (1–80 characters), `description` (1–500) and `prompt` (1–64,000).
   The helper validates input, creates a unique folder (adds a number on a name collision), writes PROMPT.md then
   style.json, and reads both back. The source timeline is unchanged. Never say a style is saved if this fails.
   If the tool is unavailable but workspace disk access is available, create a new unique folder yourself; do not
   overwrite an existing folder. Write the prompt first and the metadata last. With neither method, report the limit.
6. Read back both files, check for source-specific content and unsupported claims, and report the saved path plus
   the main rules and any unknowns. The gallery discovers complete pairs under **Styles → Saved editing styles**.
   Sending the request is not completion; the chat must report success or the actual failure.

```
library/editing-styles/<id>/
  PROMPT.md       standalone editing instructions, evidence notes and limits
  style.json      { "version": 1, "name": "My interview edits", "description": "A short summary." }
```

IDs use lowercase ASCII letters, digits and hyphens, start with a letter or digit and have at most 64 characters.
No copied scenes/assets, form fields, render or preview are needed. MCP reads use `scope: "library"` and
`path: "editing-styles/<id>/PROMPT.md"` (or `style.json`).

## Apply to another video

1. Read the named style's PROMPT.md. Inspect the **current target project**, its footage, transcript and audio.
   The source project is not needed. The gallery's Apply to this video action edits the current project.
2. Use the saved rules with the new content. Obtain missing required footage or information before editing.
   State rules that cannot apply. A style is not permission to invent a script or duplicate source content.
3. Make the actual timeline edits. A `project.json` style ID alone does not remove speech, choose B-roll or add
   shot-level effects. Keep captions, source offsets, graphics and audio aligned when cutting or changing pacing.
   Read `references/style-editing.md`, `format.md` and `sound.md` as needed for implementation and review.
4. Review frames, playback, captions and sound with the normal editing loop. Report changes and limits.

Existing video presets remain supported. Read `references/presets.md` for explicit scene/asset kit requests.
Do not convert or reinterpret existing `library/presets/` entries as editing-rule prompts.
