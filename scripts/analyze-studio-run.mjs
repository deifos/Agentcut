// Read-only analysis of a saved Studio chat and its Claude session log. No agent or media calls.
// Usage: node scripts/analyze-studio-run.mjs <chat.json> <session.jsonl>
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const usageKeys = ["input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens"];
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const usageOf = (event) => Object.fromEntries(usageKeys.map((key) => [key, count(event.message?.usage?.[key])]));

export function summarizeStudioRun(chat, events) {
  const requests = new Map();
  const messages = new Map();
  const tools = new Map();
  const results = new Map();
  let cost;
  for (const event of events) {
    if (event.sessionId && chat.sessionId && event.sessionId !== chat.sessionId) continue;
    if (event.type === "api-request") requests.set(event.id, event);
    if (event.type === "cost-state") cost = event;
    if (event.type === "assistant" && event.message?.id) {
      // Claude writes separate thinking/text/tool blocks with the same message ID and usage.
      // Count each model response once, keeping its last usage record.
      messages.set(event.message.id, event);
      for (const block of event.message.content ?? []) {
        if (block.type === "tool_use") tools.set(block.id, { name: block.name, at: event.timestamp });
      }
    }
    if (event.type === "user" && Array.isArray(event.message?.content)) {
      for (const block of event.message.content) {
        if (block.type !== "tool_result") continue;
        const content = block.content;
        const textChars = typeof content === "string" ? content.length : Array.isArray(content)
          ? content.reduce((sum, part) => sum + (typeof part.text === "string" ? part.text.length : 0), 0) : 0;
        const images = Array.isArray(content) ? content.filter((part) => part.type === "image").length : 0;
        results.set(block.tool_use_id, { at: event.timestamp, error: Boolean(block.is_error), textChars, images });
      }
    }
  }
  const calls = [...messages.values()].map((event) => {
    const usage = usageOf(event);
    return {
      startedAt: requests.get(event.requestRef)?.timestamp ?? null,
      completedAt: event.timestamp,
      model: event.message.model,
      ...usage,
      contextTokens: usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens,
    };
  });
  const usage = Object.fromEntries(usageKeys.map((key) => [key, calls.reduce((sum, call) => sum + call[key], 0)]));
  const inputTokens = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
  const totalTokens = inputTokens + usage.output_tokens;
  const toolCalls = [...tools].map(([id, tool]) => {
    const result = results.get(id);
    return { ...tool, endedAt: result?.at ?? null, error: result?.error ?? null,
      durationMs: result ? Date.parse(result.at) - Date.parse(tool.at) : null,
      textChars: result?.textChars ?? 0, images: result?.images ?? 0 };
  });
  const assistantTurns = chat.messages.filter((message) => message.role === "assistant");
  const savedTotals = assistantTurns.reduce((sum, message) => sum + count(message.usage?.totalTokens), 0);
  return {
    sessionId: chat.sessionId,
    studio: {
      agent: chat.agent, projectTokens: chat.projectTokens,
      assistantTurns: assistantTurns.map(({ at, durationMs, status, usage }) => ({ at, durationMs, status, usage })),
    },
    provider: {
      requestCount: requests.size, uniqueResponseCount: calls.length, models: [...new Set(calls.map((call) => call.model))],
      usage: { ...usage, normalizedInputTokens: inputTokens, newlySuppliedInputTokens: usage.input_tokens + usage.cache_creation_input_tokens, totalTokens },
      firstContextTokens: calls[0]?.contextTokens ?? null, finalContextTokens: calls.at(-1)?.contextTokens ?? null,
      costState: cost ? {
        costUSD: cost.totalCostUSD, apiDurationMs: cost.totalAPIDuration,
        apiDurationWithoutRetriesMs: cost.totalAPIDurationWithoutRetries,
        toolDurationMs: cost.totalToolDuration, durationMs: cost.totalDuration,
        modelUsage: cost.modelUsage, hasUnknownModelCost: cost.hasUnknownModelCost,
      } : null,
    },
    reconciliation: {
      savedAssistantTotal: savedTotals, matchesSavedAssistantUsage: savedTotals === totalTokens,
      projectTotalMinusVisibleAssistantTotal: typeof chat.projectTokens === "number" ? chat.projectTokens - savedTotals : null,
    },
    tools: {
      callCount: tools.size, resultCount: results.size,
      errorCount: toolCalls.filter((tool) => tool.error).length,
      imageResultCount: toolCalls.reduce((sum, tool) => sum + tool.images, 0),
      countsByName: toolCalls.reduce((counts, tool) => { counts[tool.name] = (counts[tool.name] ?? 0) + 1; return counts; }, {}),
      longest: toolCalls.filter((tool) => tool.durationMs !== null).sort((a, b) => b.durationMs - a.durationMs).slice(0, 10),
      largestTextResults: [...toolCalls].sort((a, b) => b.textChars - a.textChars).slice(0, 10),
    },
    calls,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [chatPath, sessionPath] = process.argv.slice(2);
  if (!chatPath || !sessionPath) throw new Error("Usage: node scripts/analyze-studio-run.mjs <chat.json> <session.jsonl>");
  const chat = JSON.parse(readFileSync(chatPath, "utf8"));
  const events = readFileSync(sessionPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  console.log(JSON.stringify(summarizeStudioRun(chat, events), null, 2));
}
