export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
}

/** Codex includes cache reads in input; Claude reports cache reads/writes separately. */
export function parseTokenUsage(value: unknown, provider: "codex" | "claude"): TokenUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const count = (key: string) => {
    const value = raw[key];
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  };
  const input = count("input_tokens");
  const output = count("output_tokens");
  if (input === undefined || output === undefined) return undefined;
  const cachedInputTokens = count(provider === "claude" ? "cache_read_input_tokens" : "cached_input_tokens") ?? 0;
  const cacheWriteTokens = provider === "claude" ? count("cache_creation_input_tokens") ?? 0 : 0;
  const inputTokens = input + (provider === "claude" ? cachedInputTokens + cacheWriteTokens : 0);
  return { inputTokens, outputTokens: output, cachedInputTokens, cacheWriteTokens, totalTokens: inputTokens + output };
}
