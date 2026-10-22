// The Launch reel demo: a real Agentcut project (the same layers.json and project.json the
// studio edits), played on the website by the studio's own runtime composition. Its files are
// served from public/demo/launch-reel/.
import { createStudioComposition } from "@/packages/agentcut/template/runtime/composition";
import type {
  LoadedModule,
  StudioDoc,
  StudioLayers,
  StudioProject,
} from "@/lib/studio/types";
import layers from "./layers.json";
import project from "./project.json";

export const LAUNCH_REEL_SLUG = "launch-reel";
export const LAUNCH_REEL_ASSETS = "/demo/launch-reel";

export const LAUNCH_REEL_PROJECT = project as StudioProject;
export const LAUNCH_REEL_LAYERS = layers as unknown as StudioLayers;

export const LAUNCH_REEL_DOC: StudioDoc = {
  slug: LAUNCH_REEL_SLUG,
  project: LAUNCH_REEL_PROJECT,
  layers: LAUNCH_REEL_LAYERS,
  layersHash: null,
  projectHash: null,
  issues: [],
  scenes: [],
  dir: null,
};

// No scene files: every scene in the reel is a library component.
export const LAUNCH_REEL_MODULE: LoadedModule = {
  slug: LAUNCH_REEL_SLUG,
  revision: 1,
  module: {
    runtimeVersion: 1,
    StudioComposition: createStudioComposition({}),
    scenes: [],
  },
};
