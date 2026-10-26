// One motion graphic per sound effect, keyed by sound id. Each group file covers some categories.
import type { SfxEntry } from "@/lib/sfx-library";
import { drawSfx } from "@/components/sfx/sfx-animations";
import type { Frame, Scene } from "./kit";
import { clickScenes } from "./clicks";
import { popTypingFoleyScenes } from "./pops-typing-foley";
import { swooshWhooshScenes } from "./swooshes-whooshes";
import { impactRiserScenes } from "./impacts-risers";
import { tonalGlitchScenes } from "./tonal-glitch";

export const SCENES: Record<string, Scene> = {
  ...clickScenes,
  ...popTypingFoleyScenes,
  ...swooshWhooshScenes,
  ...impactRiserScenes,
  ...tonalGlitchScenes,
};

export type SceneInput = Omit<Frame, "s" | "cx" | "cy" | "lw">;

/** Draw a sound's scene (or its category's generic graphic if it has none). */
export function drawScene(entry: SfxEntry, input: SceneInput) {
  const { ctx, w, h } = input;
  const s = Math.min(w, h);
  ctx.clearRect(0, 0, w, h);
  const scene = SCENES[entry.id];
  if (!scene) {
    drawSfx(entry.category, input);
    return;
  }
  ctx.save();
  scene({ ...input, s, cx: w / 2, cy: h / 2, lw: Math.max(1.5, s * 0.012) });
  ctx.restore();
}
