import type { ChatHistory } from "./types";

export interface PendingReply { messageId: string; question: string }

/** A conservative fallback for completed ordinary prose, not script or quoted questions. */
export function questionFromReply(text: string): string | null {
  const raw = text.trim();
  // Supported structured completion payloads take precedence over prose inference.
  const json = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```$/, "");
  try {
    const value = JSON.parse(json);
    if (["needs_input", "waiting_for_reply", "input_required"].includes(value?.status) && typeof value.question === "string") return value.question.trim().slice(0, 800) || null;
  } catch { /* Ordinary text is the usual case. */ }
  if (/```$/.test(raw)) return null;
  const prose = raw.replace(/```[\s\S]*?```/g, "").trim();
  const blocked = /(?:^|\n)(?:#{1,6}\s+)?(?:\*\*)?(?:still blocked|waiting for your (?:reply|input)|input required)(?:\s*:\s*\*\*|\*\*\s*:|\*\*|:)\s*([^]*?)(?=\n#{1,6}\s|$)/i.exec(prose);
  if (blocked && /\b(?:need|provide|choose|reply|please|you|recording|access|either)\b/i.test(blocked[1])) {
    const block = blocked[1].trim();
    const intro = block.split("\n")[0].replace(/\*\*/g, "").trim();
    const choices = [...block.matchAll(/^\d+[.)]\s+(?:\*\*([^*]+)\*\*|([^\n]+))/gm)]
      .slice(0, 3).map((match, index) => `${index + 1}. ${(match[1] ?? match[2]).replace(/`/g, "").slice(0, 200)}`);
    return [intro, ...choices].filter(Boolean).join("\n").slice(0, 800) || null;
  }
  const paragraph = prose.split(/\n\s*\n/).at(-1)?.trim() ?? "";
  if (!paragraph || /^(?:>|["'“‘]|[-*]\s|\d+[.)]\s)/.test(paragraph)) return null;
  const clean = paragraph.replace(/\*\*/g, "").trim();
  const explicit = /^(?:question for you|waiting for your reply|input needed|your choice)\s*:\s*([\s\S]+)$/i.exec(clean);
  if (explicit) return explicit[1].trim().slice(0, 800) || null;
  const headings = [...prose.matchAll(/^#{1,6}\s+(.+)$/gm)];
  const lastHeading = headings.at(-1)?.[1] ?? "";
  if (/\b(?:script|narration|voiceover|voice-over|dialogue|example|sample)\b/i.test(lastHeading)) return null;
  if (/^(?:script|narration|voiceover|voice-over|example|sample)\s*:/i.test(clean)) return null;
  const match = /(?:^|[.!]\s+)((?:would|do|did|can|could|should|which|what|where|when|how|is|are|will|may)\b[^?\n]{2,600}\?)\s*$/i.exec(clean);
  if (!match || /^what if\b/i.test(match[1])) return null;
  // A question must address a choice/input, rather than a rhetorical title or lesson question.
  return /\b(?:you|your|i|we|it|prefer|choose|which|what|where|when)\b/i.test(match[1]) ? match[1] : null;
}

export function pendingReply(chat: ChatHistory): PendingReply | null {
  if (chat.running) return null;
  const last = chat.messages.at(-1);
  if (!last || last.role !== "assistant" || last.status !== "done") return null;
  // Preserve an explicit request when a connected provider supplies it in saved message metadata.
  const explicit = (last as typeof last & { pendingInput?: { question?: unknown } }).pendingInput;
  if (typeof explicit?.question === "string" && explicit.question.trim()) return { messageId: last.id, question: explicit.question.trim().slice(0, 800) };
  const text = last.text ?? (last.parts ?? []).filter((part) => part.type === "text").map((part) => part.type === "text" ? part.text : "").join("");
  const question = questionFromReply(text);
  return question ? { messageId: last.id, question } : null;
}
