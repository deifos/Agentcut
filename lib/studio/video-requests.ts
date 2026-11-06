import type { ChatMessage } from "./types";
import { hasEstablishedLaunchContext, isBareProductLaunchRequest, productLaunchRequest } from "./product-launch";

export const VIDEO_TYPES = {
  "product-launch": {
    label: "Product Launch",
    request: "Create a product launch video.",
    question: "What are you launching? Add a product URL or a short description.",
    placeholder: "Product URL or short description…",
  },
  "feature-launch": {
    label: "Feature Launch",
    request: "Create a feature launch video.",
    question: "Which feature are you announcing, and what can people now do? Add a short description, URL, or recording.",
    placeholder: "Feature, new benefit, and optional URL or recording…",
  },
  "how-to": {
    label: "How-to",
    request: "Create a how-to video.",
    question: "What should viewers learn to do? Add a URL, recording, or a short description of the task.",
    placeholder: "Task to teach, app URL, or recording…",
  },
} as const;
export type VideoType = keyof typeof VIDEO_TYPES;
export type VideoIntake = { type: VideoType; request: string };
export type NewVideoRequest = { type: VideoType; requestId: string };

export function isBareHowToRequest(text: string) {
  const request = text.replace(/\b\d+(?:\.\d+)?[ -]?(?:seconds?|secs?|s|minutes?|mins?)\b/gi, "")
    .replace(/\b(?:in|for)\s+(?=[.!?\s]*$)/gi, "")
    .replace(/\s+/g, " ").trim();
  return /^(?:(?:please|can you|could you|i want(?: to)?|i need(?: to)?|let['’]s)\s+)*(?:(?:create|make|build|generate|produce|start)\s+)?(?:me\s+)?(?:(?:a|an|the|my|our|new|short|software|step-by-step)\s+)*(?:how[- ]to(?:\s+(?:video|tutorial|guide))?|tutorial(?:\s+video)?|walkthrough(?:\s+video)?)(?:\s+(?:please|for me|using this context))*[.!?\s]*$/i.test(request);
}

export function isBareFeatureLaunchRequest(text: string) {
  // Map only generic feature descriptions. Keep names and benefits in the brief.
  const normalized = text
    .replace(/\bfeature[- ](?:launch|reveal|announcement)\b/gi, "product launch")
    .replace(/\b(?:announce|introduce|launch|reveal)\s+(?:(?:a|the|my|our|this|new)\s+)*(?:feature|capability)\b/gi, "product launch")
    .replace(/\b(?:launch|reveal|announcement)(\s+video)?\s+for\s+(?:(?:a|the|my|our|this|new)\s+)*(?:feature|capability)\b/gi, "launch$1 for my product");
  return normalized !== text && isBareProductLaunchRequest(normalized);
}

function mentionsFeatureLaunch(text: string) {
  return /\bfeature[- ](?:launch|reveal|announcement)\b|\b(?:launch|reveal|introduce|announce)\b[^.!?\n]{0,60}\b(?:feature|capability)\b/i.test(text);
}

export function bareVideoType(text: string): VideoType | null {
  return isBareFeatureLaunchRequest(text) ? "feature-launch" : isBareProductLaunchRequest(text) ? "product-launch" : isBareHowToRequest(text) ? "how-to" : null;
}

/** Creation requests get an isolated canvas video; explicit edit instructions stay on the edit. */
export function creationVideoType(text: string): VideoType | null {
  const value = text.trim();
  if (/^(?:please\s+)?(?:edit|change|update|revise|fix|replace|remove|add|trim|shorten|restyle|continue)\b/i.test(value)) return null;
  const bare = bareVideoType(value);
  if (bare) return bare;
  if (/^how to\s+\S+/i.test(value)
    || /^(?:a\s+)?(?:tutorial|walkthrough|how[- ]to)(?:\s+video)?\s*(?::|on\b|about\b|for\b)/i.test(value)
    || /\b(?:create|make|build|generate|produce|i want|i need)\b[^.!?\n]{0,60}\b(?:how[- ]to|tutorial|walkthrough)\b/i.test(value)) return "how-to";
  if (mentionsFeatureLaunch(value) && /^(?:(?:please|can you|could you)\s+)*(?:create|make|build|generate|produce|start|i want|i need|introduce|announce|launch|reveal)\b/i.test(value)) return "feature-launch";
  if (/\b(?:create|make|build|generate|produce|i want|i need)\b[^.!?\n]{0,60}\b(?:launch|reveal)\b/i.test(value)) return "product-launch";
  return null;
}

export function ambiguousVideoType(text: string): VideoType | null {
  if (!/\b(?:turn|convert|transform|adapt|make)\s+(?:this|it|the (?:current|selected) video)\b/i.test(text)) return null;
  if (mentionsFeatureLaunch(text)) return "feature-launch";
  return /\b(?:tutorial|walkthrough|how[- ]to)\b/i.test(text) ? "how-to"
    : /\b(?:launch|reveal)\b/i.test(text) ? "product-launch" : null;
}

export function hasEstablishedVideoContext(type: VideoType, messages: ChatMessage[]) {
  if (type === "product-launch") return hasEstablishedLaunchContext(messages);
  if (type === "feature-launch") return messages.some(message => {
    if (message.role !== "user" || message.status === "queued" || message.status === "error") return false;
    const text = message.text?.trim() ?? "";
    if (!text || text.split(/\n+/).every(line => !line.trim() || bareVideoType(line))) return false;
    return creationVideoType(text) === "feature-launch" || /\b(?:feature|capability)\s+(?:is|called|named|lets|allows|enables|adds)\s+\S+/i.test(text);
  });
  return messages.some((message) => {
    if (message.role !== "user" || message.status === "queued" || message.status === "error") return false;
    const text = message.text?.trim() ?? "";
    if (!text || text.split(/\n+/).every((line) => !line.trim() || bareVideoType(line))) return false;
    if (["product-launch", "feature-launch"].includes(creationVideoType(text) ?? "")) return false;
    // A launch's old attachments, product identity or generic demonstration is not a tutorial task.
    return /\bhow to\s+\S+|\bteach\s+\S+|\b(?:tutorial|walkthrough)\s+(?:for|on|about)\s+\S+/i.test(text);
  });
}

export function videoRequest(type: VideoType, context: string) {
  if (type === "product-launch") return productLaunchRequest(context);
  if (type === "feature-launch") return context.trim() ? `${context}\n\nCreate a feature launch video using this context.` : VIDEO_TYPES[type].request;
  return context.trim() ? `${context}\n\nCreate a how-to video using this context.` : VIDEO_TYPES[type].request;
}
