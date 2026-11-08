import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { mingDir, MING_REVISION } from "./ming.js";
import { getVoiceAdapter } from "./registry.js";
import { atomicWrite } from "../projects.js";

export const PREVIEW_TEXT =
  "Hi! This is how I'll sound in your video. Let's make something great.";
const pending = new Map<string, Promise<{ url: string }>>();

/** Local previews never enter a project or call a paid provider. */
export async function previewVoice(
  provider: string,
  voice: string,
  style = "",
) {
  if (provider !== "kokoro" && provider !== "ming")
    throw new Error("Select a local voice.");
  const adapter = getVoiceAdapter(provider);
  if (!adapter.voices?.some((v) => v.id === voice))
    throw new Error("Select a listed voice.");
  style = style.trim();
  if (style.length > 1000)
    throw new Error("Keep the voice description under 1000 characters.");
  const id = createHash("sha256")
    .update(
      JSON.stringify([provider, voice, style, PREVIEW_TEXT, MING_REVISION]),
    )
    .digest("hex");
  const existing = pending.get(id);
  if (existing) return existing;
  const job = (async () => {
    const directory = join(mingDir(), "previews");
    const file = join(directory, `${id}.wav`);
    let data: Buffer;
    try {
      data = await readFile(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const audio = await adapter.synthesize(
        "",
        { text: PREVIEW_TEXT, style },
        adapter.spec.defaultModel,
        voice,
      );
      data = audio.data;
      await mkdir(directory, { recursive: true });
      atomicWrite(file, data);
    }
    return { url: `data:audio/wav;base64,${data.toString("base64")}` };
  })();
  pending.set(id, job);
  try {
    return await job;
  } finally {
    pending.delete(id);
  }
}
