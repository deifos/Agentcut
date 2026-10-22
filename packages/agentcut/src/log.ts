import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getConfig } from "./config.js";

export function debugLog(message: string) {
  try {
    const { logPath } = getConfig();
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Logging should never break MCP tool calls.
  }
}
