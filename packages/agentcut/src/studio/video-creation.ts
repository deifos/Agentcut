import { existsSync, mkdirSync, readFileSync, lstatSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { createCut } from "./canvas.js";
import { assertSlug, atomicWrite, projectDir, readProjectState, safeJoin, StudioError } from "./projects.js";
import type { WorkspacePaths } from "./workspace.js";

const input = z.object({ type: z.enum(["product-launch", "how-to"]), requestId: z.string().uuid() });
type Saved = { slug: string; sent?: boolean; text: string; previousUserCount: number };
type Send = (slug: string, text: string, context: Record<string, unknown>) => Promise<unknown>;

/** One creation per UI submission, followed by the normal ChatEngine.send on the bound target. */
export class VideoCreation {
  private active = new Map<string, Promise<{ slug: string; result?: unknown; alreadySent?: boolean }>>();
  constructor(private paths: WorkspacePaths) {}

  send(source: string, text: string, context: Record<string, unknown>, request: unknown, send: Send) {
    const parsed = input.parse(request);
    const slug = assertSlug(source);
    if (!text.trim()) throw new StudioError("Add the video brief before creating a video.");
    const key = slug + "/" + parsed.requestId;
    const running = this.active.get(key);
    if (running) return running;
    const work = this.run(slug, text, context, parsed, send).finally(() => this.active.delete(key));
    this.active.set(key, work);
    return work;
  }

  private async run(source: string, text: string, context: Record<string, unknown>, request: z.infer<typeof input>, send: Send) {
    const dir = projectDir(this.paths, source);
    const ledger = safeJoin(dir, `.studio/video-requests/${request.requestId}.json`);
    let saved: Saved | null = existsSync(ledger) ? JSON.parse(readFileSync(ledger, "utf8")) as Saved : null;
    if (!saved) {
      const state = readProjectState(this.paths, source);
      if (!state.project || !state.layers) throw new StudioError("Fix the current project before creating a video.");
      mkdirSync(dirname(ledger), { recursive: true });
      const populated = state.layers.tracks.some((track) => track.clips.length > 0) || state.scenes.length > 0;
      const target = populated ? (await createCut(this.paths, { project: source,
        name: request.type === "how-to" ? "How-to" : "Product Launch", kind: "clip", reuseAssets: true })).slug : source;
      const sourceChatFile = safeJoin(dir, ".studio/chat.json");
      const history = existsSync(sourceChatFile) ? JSON.parse(readFileSync(sourceChatFile, "utf8")) as { messages?: { role: string }[] } : null;
      saved = { slug: target, text, previousUserCount: target === source ? history?.messages?.filter((message) => message.role === "user").length ?? 0 : 0 };
      atomicWrite(ledger, JSON.stringify(saved));
    }
    const target = assertSlug(saved.slug);
    // A new, dedicated target with a saved user message was already dispatched even if a reply
    // was lost before this ledger could be marked. Never send that creation a second time.
    const targetChat = safeJoin(projectDir(this.paths, target), ".studio/chat.json");
    const prior = existsSync(targetChat) ? JSON.parse(readFileSync(targetChat, "utf8")) as { messages?: { role: string; text?: string }[] } : null;
    if (saved.sent || prior?.messages?.filter((message) => message.role === "user").slice(saved.previousUserCount).some((message) => message.text === saved!.text)) {
      return { slug: target, alreadySent: true };
    }
    const attachments = Array.isArray(context.attachments) ? context.attachments.filter((path): path is string => typeof path === "string") : [];
    if (target !== source) {
      const references = Array.isArray(context.references) ? context.references as { path?: unknown }[] : [];
      for (const ref of references) {
        if (typeof ref.path !== "string" || !ref.path.startsWith("assets/") || ref.path.includes("..")) continue;
        const from = safeJoin(dir, ref.path), to = safeJoin(projectDir(this.paths, target), ref.path);
        if (!existsSync(to)) {
          if (!lstatSync(from).isFile() || lstatSync(from).isSymbolicLink()) throw new StudioError("Referenced asset must be a regular file.");
          await mkdir(dirname(to), { recursive: true });
          await copyFile(from, to);
        }
      }
      for (const path of attachments) {
        if (!/^\.studio\/attachments\/[\w.\-/]+$/.test(path) || path.includes("..")) throw new StudioError("Invalid frame attachment path.");
        const from = safeJoin(dir, path), to = safeJoin(projectDir(this.paths, target), path);
        if (!lstatSync(from).isFile() || lstatSync(from).isSymbolicLink()) throw new StudioError("Frame attachment must be a regular file.");
        await mkdir(dirname(to), { recursive: true });
        await copyFile(from, to);
      }
    }
    const sourceChatFile = safeJoin(dir, ".studio/chat.json");
    const sourceChat = target !== source && existsSync(sourceChatFile) ? JSON.parse(readFileSync(sourceChatFile, "utf8")) as { messages?: { role: string; text?: string; status?: string }[] } : null;
    const brief = sourceChat?.messages?.filter((message) => message.role === "user" && message.status !== "queued")
      .slice(-6).map((message) => message.text?.slice(0, 3000) ?? "").join("\n\n").slice(-12_000);
    const boundContext = target === source ? context : { ...context, selectedClipIds: [], playheadFrame: 0,
      sourceVideo: { slug: source, brief: brief ?? "" } };
    saved = { ...saved, text };
    atomicWrite(ledger, JSON.stringify(saved));
    const result = await send(target, text, boundContext);
    atomicWrite(ledger, JSON.stringify({ ...saved, sent: true }));
    return { slug: target, result };
  }
}
