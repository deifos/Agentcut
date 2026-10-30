import { STUDIO_SHARED_MODULES } from "@/lib/studio/modules";
import type { StudioModule } from "@/lib/studio/types";

import { STUDIO_BRIDGE_ORIGIN } from "@/lib/studio/origin";

export { STUDIO_BRIDGE_ORIGIN };

export { studioAssetBase, STUDIO_LIBRARY_BASE, studioFileUrl } from "./file-url";

function requireShared(name: string) {
  if (name in STUDIO_SHARED_MODULES) return STUDIO_SHARED_MODULES[name];
  throw new Error(
    `Scenes can't import "${name}" here. Install it in the workspace (npm install ${name}) so it gets bundled, or use one of: ${Object.keys(STUDIO_SHARED_MODULES).join(", ")}.`,
  );
}

/** Evaluate a CommonJS project bundle produced by agentcut. */
export function evaluateStudioBundle(code: string, slug: string, revision: number): StudioModule {
  const cjs: { exports: Record<string, unknown> } = { exports: {} };
  // The bundle is generated on this computer by the user's own studio helper
  // from their workspace files; it runs like any other page script.
  const run = new Function(
    "require",
    "module",
    "exports",
    `${code}\n//# sourceURL=studio://${slug}/bundle-${revision}.js`,
  );
  run(requireShared, cjs, cjs.exports);
  const mod = (cjs.exports.default ?? cjs.exports) as StudioModule;
  if (!mod || typeof mod.StudioComposition !== "function") {
    throw new Error("The project bundle didn't export a Studio composition.");
  }
  return mod;
}

export async function fetchStudioBundle(slug: string, signal?: AbortSignal) {
  const response = await fetch(`${STUDIO_BRIDGE_ORIGIN}/studio/bundle/${slug}.js`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    let message = `Bundle request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  const revision = Number(response.headers.get("x-studio-revision") ?? 0);
  const code = await response.text();
  return { code, revision };
}
