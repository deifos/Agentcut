/** Editing styles are instructions, separate from scene/asset video presets. */
export interface EditingStyle {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

export const EDITING_STYLE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function editingStyleIds(library: { path: string }[]) {
  const paths = new Set(library.map((entry) => entry.path));
  return [...paths]
    .flatMap((path) => {
      const match = /^library:editing-styles\/([^/]+)\/style\.json$/.exec(path);
      return match &&
        EDITING_STYLE_ID.test(match[1]) &&
        paths.has(`library:editing-styles/${match[1]}/PROMPT.md`)
        ? [match[1]]
        : [];
    })
    .sort();
}

export function parseEditingStyle(
  id: string,
  meta: unknown,
  prompt: string,
): EditingStyle {
  const value = meta as Record<string, unknown> | null;
  if (
    !EDITING_STYLE_ID.test(id) ||
    !value ||
    value.version !== 1 ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 80 ||
    typeof value.description !== "string" ||
    !value.description.trim() ||
    value.description.length > 500 ||
    !prompt.trim() ||
    prompt.trim().length > 64_000
  ) {
    throw new Error(`Editing style "${id}" has invalid or incomplete files.`);
  }
  return {
    id,
    name: value.name.trim(),
    description: value.description.trim(),
    prompt: prompt.trim(),
  };
}

export function saveEditingStyleRequest(name: string, slug: string) {
  return [
    `Save the current editing style as a reusable editing prompt named ${JSON.stringify(name.trim())}. Source project: ${JSON.stringify(slug)}. Do not edit the video.`,
    "Read references/editing-styles.md if available. Inspect project.json, layers.json, scene code, captions, audio settings, and available editing conversation/history. Use only rules supported by this evidence. Do not invent past actions or treat examples as defaults. If the evidence is insufficient, explain what is missing instead of saving a guessed style.",
    "Describe HOW to edit different footage: speech cleanup (duplicate/repeated takes and filler words), B-roll selection/placement, zoom emphasis, transitions, captions, pacing, graphics/animation and sound balance ONLY where supported. Distinguish observed settings from confirmed intent. Include timing intervals only if the project or history supports them; do not assume a five-second interval.",
    "Make a standalone prompt with reusable rules, evidence notes and any limits or unknowns. Keep new content relevant to the new footage: choose fresh B-roll, text, animations and sound as needed. Do not copy source scenes, media, transcript, personal details, original B-roll or timeline timestamps. Do not require the source project for reuse.",
    "Save with agentcut_save_editing_style using name, a short description and the full prompt. If that tool is unavailable but workspace disk access is available, create a NEW unique folder in library/editing-styles/<id>/ (never overwrite): write PROMPT.md first, then style.json with {version:1,name,description}. No scenes, assets or rendered preview are needed. If neither save method is available, report the limitation; do not claim it was saved.",
    "Read back both saved files before reporting success. Give the saved path and a short summary of rules and unknowns. Tell me to open Styles → Saved editing styles to use it on another video.",
  ].join("\n\n");
}

export function applyEditingStyleRequest(style: EditingStyle, slug: string) {
  if (!EDITING_STYLE_ID.test(style.id))
    throw new Error("Invalid editing style ID.");
  return [
    `Apply the saved editing style ${JSON.stringify(style.name)} to the current project ${JSON.stringify(slug)} using its current footage.`,
    `Read library/editing-styles/${style.id}/PROMPT.md and references/editing-styles.md if available. Through MCP, read_file uses scope=library and path=editing-styles/${style.id}/PROMPT.md.`,
    "Inspect this project's footage, transcript, timeline and audio first. Follow the saved editing rules, adapting decisions to the new content. Select fresh, relevant B-roll and create new text and animations. Do not copy the original video's media, scenes, spoken words or fixed timeline positions. Keep captions and audio aligned when making cuts. Do not use a video preset or replace the project with the source video's timeline.",
    "If required footage or information is missing, ask for it before editing. Explain any rule that cannot apply. Review the edited video, captions and sound, then report the changes.",
  ].join("\n\n");
}
