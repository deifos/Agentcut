import type { AssetEntry, ChatMessage } from "./types";

// Recognize only requests with no product identity. Keep specifics for the agent.
const bareLaunch = /^(?:(?:please|can you|could you|i want(?: to)?|i need(?: to)?|let['’]s)\s+)*(?:(?:create|make|build|generate|produce|start)\s+)?(?:me\s+)?(?:(?:a|an|the|my|our|new|short|cinematic|premium|product)\s+)*(?:launch|reveal)(?:\s+(?:a|my|our|new|product|video|film|announcement|please))*(?:\s+for (?:me|my product|our product|this project))?(?:\s+using (?:this|the|existing|available) context)?[.!?\s]*$/i;

export function isBareProductLaunchRequest(text: string) {
  // Length and format alone do not identify a product.
  const request = text.replace(/\b\d+(?:\.\d+)?[ -]?(?:seconds?|secs?|s|minutes?|mins?)\b/gi, "")
    .replace(/\b(?:in|for)\s+(?=[.!?\s]*$)/gi, "")
    .replace(/\s+/g, " ").trim();
  return bareLaunch.test(request);
}

export function hasProjectLaunchMedia(assets: AssetEntry[]) {
  return assets.some((asset) => asset.path.startsWith("assets/") && (asset.kind === "video" || asset.kind === "image"));
}

/** Only user-supplied product context counts; assistant guesses and project titles do not. */
export function hasEstablishedLaunchContext(messages: ChatMessage[]) {
  return messages.some((message) => {
    if (message.role !== "user" || message.status === "queued" || message.status === "error") return false;
    if (message.references?.some((ref) => ref.kind === "video" || ref.kind === "image")) return true;
    const text = message.text?.trim() ?? "";
    if (!text || text.split(/\n+/).every((line) => !line.trim() || isBareProductLaunchRequest(line))) return false;
    return /https?:\/\/\S+|\bwww\.\S+/i.test(text)
      || /\b(?:launch|reveal|introduce)\b/i.test(text)
      || /\b(?:product|app|website|service|company|tool)\s+(?:is|called|named)\s+\S+/i.test(text);
  });
}

export function productLaunchRequest(context: string) {
  return context.trim() ? `${context}\n\nCreate a product launch video using this context.` : "Create a product launch video.";
}
