// Bundle entry helpers. The helper generates one entry per project that calls
// createStudioModule() with the project's scenes.
import { createStudioComposition, type SceneRegistry } from "./composition";

export const RUNTIME_VERSION = 1;
/** Additions the studio checks for before it offers them ("clip-transform": scene clips' `transform`). */
export const RUNTIME_FEATURES = ["clip-transform"];

export interface StudioModule {
  runtimeVersion: number;
  StudioComposition: ReturnType<typeof createStudioComposition>;
  scenes: string[];
  features: string[];
}

export function createStudioModule(scenes: SceneRegistry): StudioModule {
  return {
    runtimeVersion: RUNTIME_VERSION,
    StudioComposition: createStudioComposition(scenes),
    scenes: Object.keys(scenes).sort(),
    features: RUNTIME_FEATURES,
  };
}

export type { SceneRegistry } from "./composition";
export * from "./types";
