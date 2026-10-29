import { readFileSync, writeFileSync } from "node:fs";

/** A sidecar is written only after a successful export. Legacy videos have no timing. */
export function readRenderDuration(videoPath: string): number | undefined {
  try {
    const data = JSON.parse(readFileSync(`${videoPath}.render.json`, "utf8"));
    return data.version === 1 && typeof data.durationMs === "number" &&
      Number.isFinite(data.durationMs) && data.durationMs >= 0 ? data.durationMs : undefined;
  } catch {
    return undefined;
  }
}

export function saveRenderDuration(videoPath: string, durationMs: number) {
  writeFileSync(`${videoPath}.render.json`, JSON.stringify({ version: 1, durationMs }), { flag: "wx" });
}
