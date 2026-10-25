import packageJson from "@/package.json";

/** The studio page's version (package.json at the repo root). See CHANGELOG.md. */
export const APP_VERSION: string = packageJson.version;

/** Oldest helper (`npx agentcut`) this page works with: Style Spy and Record need 0.2.0. */
export const MIN_HELPER_VERSION = "0.2.0";

/**
 * Oldest helper Cinematic Mode works with: the workspace needs its skill references (cinematic.md,
 * loops.md), the cinematic toolkit's types and three for local renders.
 */
export const CINEMATIC_HELPER_VERSION = "0.2.5";

export const CHANGELOG_URL =
  "https://github.com/deifos/Agentcut/blob/main/CHANGELOG.md";

/** True when version `a` is older than `b` (plain x.y.z). */
export function isOlderVersion(a: string, b: string) {
  const pa = a.split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  }
  return false;
}
