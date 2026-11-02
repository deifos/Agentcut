import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { getConfig } from "./config.js";

const MAX_LOG_BYTES = 5 * 1024 * 1024;
let written = 0;

export function debugLog(message: string) {
  try {
    const { logPath } = getConfig();
    mkdirSync(dirname(logPath), { recursive: true });
    // Keep the log and one older one, a few MB each.
    if (++written % 200 === 0 && statSync(logPath, { throwIfNoEntry: false })?.size! > MAX_LOG_BYTES)
      renameSync(logPath, `${logPath}.1`);
    appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Logging should never break MCP tool calls.
  }
}
