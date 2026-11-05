import assert from "node:assert/strict";
import test from "node:test";
import { summarizeStudioRun } from "../scripts/analyze-studio-run.mjs";

test("provider analysis counts split assistant blocks once and separates cache from new input", () => {
  const message = { id: "response", model: "test-model", usage: { input_tokens: 2, cache_creation_input_tokens: 20, cache_read_input_tokens: 100, output_tokens: 8 } };
  const chat = { sessionId: "session", agent: "claude", projectTokens: 140,
    messages: [{ role: "assistant", at: 1, durationMs: 1000, status: "done", usage: { totalTokens: 130 } }] };
  const result = summarizeStudioRun(chat, [
    { sessionId: "session", type: "api-request", id: "request", timestamp: "2026-11-05T20:00:00Z" },
    { sessionId: "session", type: "assistant", requestRef: "request", timestamp: "2026-11-05T20:00:01Z", message: { ...message, content: [{ type: "thinking", thinking: "Do not emit this content" }] } },
    { sessionId: "session", type: "assistant", requestRef: "request", timestamp: "2026-11-05T20:00:02Z", message: { ...message, content: [{ type: "tool_use", id: "tool", name: "capture" }] } },
    { sessionId: "session", type: "user", timestamp: "2026-11-05T20:00:05Z", message: { content: [{ type: "tool_result", tool_use_id: "tool", content: [{ type: "text", text: "Done" }, { type: "image", source: { data: "PRIVATE_IMAGE" } }] }] } },
    { sessionId: "other", type: "assistant", message: { ...message, id: "wrong-session" } },
  ]);
  assert.equal(result.provider.uniqueResponseCount, 1);
  assert.deepEqual(result.provider.usage, { input_tokens: 2, cache_creation_input_tokens: 20, cache_read_input_tokens: 100, output_tokens: 8, normalizedInputTokens: 122, newlySuppliedInputTokens: 22, totalTokens: 130 });
  assert.equal(result.provider.finalContextTokens, 122);
  assert.equal(result.reconciliation.matchesSavedAssistantUsage, true);
  assert.equal(result.reconciliation.projectTotalMinusVisibleAssistantTotal, 10);
  assert.equal(result.tools.imageResultCount, 1);
  assert.equal(result.tools.longest[0].durationMs, 3000);
  assert.equal(result.tools.longest[0].textChars, 4);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_IMAGE|Do not emit this content/);
});

test("analysis reports missing cost and telemetry without inventing a bill or context size", () => {
  const result = summarizeStudioRun({ messages: [] }, []);
  assert.equal(result.provider.costState, null);
  assert.equal(result.provider.finalContextTokens, null);
  assert.equal(result.reconciliation.projectTotalMinusVisibleAssistantTotal, null);
  assert.equal(result.provider.requestCount, 0);
});
