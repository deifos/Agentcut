import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 32118;
export const WS_PATH = "/agentcut";
export const PACKAGE_VERSION = readPackageVersion();

// Persisted capture/export frames live under the package root by default (next
// to the log), NOT process.cwd(), which is unpredictable when an MCP client
// launches us. Overridable for sandboxed installs where the package dir is
// read-only.
export const AGENT_FRAMES_DIR =
  process.env.AGENTCUT_FRAMES_DIR ??
  join(packageRoot, ".tmp", "agent-frames");

// Source videos downloaded for agents can be large, so they default to the
// system temp folder rather than the package directory.
export const AGENT_ASSETS_DIR =
  process.env.AGENTCUT_ASSETS_DIR ??
  join(tmpdir(), "agentcut-assets");

function readPackageVersion() {
  try {
    const packageJson = JSON.parse(
      readFileSync(join(packageRoot, "package.json"), "utf8"),
    ) as { version?: unknown };
    return typeof packageJson.version === "string"
      ? packageJson.version
      : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function getConfig() {
  const port = Number(process.env.AGENTCUT_PORT ?? DEFAULT_PORT);
  const host = process.env.AGENTCUT_HOST ?? DEFAULT_HOST;
  const logPath =
    process.env.AGENTCUT_LOG ??
    join(packageRoot, ".tmp", "agentcut-mcp.log");

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(
      `Invalid AGENTCUT_PORT "${String(
        process.env.AGENTCUT_PORT,
      )}".`,
    );
  }

  if (host !== DEFAULT_HOST) {
    throw new Error(
      "AGENTCUT_HOST must be 127.0.0.1. The Agentcut bridge is intentionally localhost-only.",
    );
  }

  return {
    host,
    port,
    logPath,
    bridgeBaseUrl: `http://${host}:${port}`,
    websocketUrl: `ws://${host}:${port}${WS_PATH}`,
  };
}
