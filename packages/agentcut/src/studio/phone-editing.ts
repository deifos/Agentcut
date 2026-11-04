import { validatePhoneEditing, PHONE_DEFAULT_PROMPT, type PhoneEditing } from "./phone-protocol.js";
export { DEFAULT_PHONE_EDITING, validatePhoneEditing, type PhoneEditing } from "./phone-protocol.js";

export function phoneEditPrompt(prompt: string, settings?: PhoneEditing): string {
  if (!settings) return prompt.trim() || PHONE_DEFAULT_PROMPT;
  const s = validatePhoneEditing(settings);
  return [
    "Read references/social-video.md in the Agentcut skill before editing.",
    `Editing mode: ${s.mode === "social" ? "Social video" : "Light cleanup"}.`,
    `Visual style: ${s.style}. These are presentation directions, not a named saved style.`,
    `Output setting: ${s.resolution}; high quality. The helper applies this output size after editing. Do not enlarge footage.`,
    "The written request takes priority over editing mode and visual style. A narrow request limits the edit: do not add captions, music, graphics or other changes outside that request. Preserve the original aspect ratio unless requested otherwise.",
    "Complete the final review in the guide and save evidence and unresolved issues with timeline timestamps in notes.md. Never claim a check passed unless you performed it.",
    prompt.trim() ? `User request:\n${prompt.trim()}` : "No special request. Apply the selected mode and style defaults.",
  ].join("\n\n");
}
