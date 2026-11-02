// Temporary folders for a test file, removed when its tests finish (so test runs don't fill the temp folder).
import { mkdtempSync, rmSync } from "node:fs";
import { after } from "node:test";

const made = [];
after(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
});

/** Like mkdtempSync(prefix), but removed after this file's tests. */
export function tempDir(prefix) {
  const dir = mkdtempSync(prefix);
  made.push(dir);
  return dir;
}
