// The studio's listening tools (Claude can't hear; these give it numbers).
// Ports of earshot (https://github.com/Leonxlnx/earshot, MIT) running in the browser:
// CLAP + AST via transformers.js, BS.1770 loudness, earshot's calibrated vocabulary,
// realness model and launch-film profile. See lib/studio/listen/data/README.md.
import { studioFileUrl } from "@/lib/studio/bundle";
import { decodeAudioUrl } from "@/lib/studio/audio/decode";
import { measureLoudness, roundDb } from "@/lib/studio/audio/loudness";
import { mixProjectAudio } from "@/lib/studio/audio/mix";
import { resampleLinear } from "@/lib/studio/listen/dsp";
import type { StudioDoc } from "@/lib/studio/types";

interface ListenContext {
  doc: StudioDoc;
  variant: string;
}

function paths(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function assertProjectPath(path: string) {
  if (/^[a-z]:[\\/]/i.test(path) || path.startsWith("/") || path.includes("..")) {
    throw new Error(`"${path}" isn't a project path. Use assets/<file> or library:<path>.`);
  }
}

function round(value: number, digits = 3) {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}

function describeMeasure(buffer: AudioBuffer, fps: number) {
  const m = measureLoudness(buffer);
  return {
    seconds: round(buffer.duration),
    frames: Math.round(buffer.duration * fps),
    integratedLufs: roundDb(m.integratedLufs),
    momentaryMaxLufs: roundDb(m.momentaryMaxLufs),
    shortTermMaxLufs: roundDb(m.shortTermMaxLufs),
    loudnessRangeLu: roundDb(m.loudnessRangeLu),
    samplePeakDb: roundDb(m.samplePeakDb),
    truePeakDb: roundDb(m.truePeakDb),
    onsetS: m.onsetS < 0 ? null : round(m.onsetS),
    onsetFrames: m.onsetS < 0 ? null : Math.round(m.onsetS * fps),
    channels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  };
}

export async function runListenTool(method: string, params: Record<string, unknown>, context: ListenContext): Promise<unknown> {
  const { doc, variant } = context;
  const fps = doc.project?.fps ?? 30;
  switch (method) {
    case "studio_listen_measure": {
      const out: Record<string, unknown> = {};
      if (params.mix) {
        const mix = await mixProjectAudio(doc, variant);
        out.mix = mix ? describeMeasure(mix, fps) : { silent: true };
      }
      const list = paths(params.paths);
      if (list.length) {
        out.files = await Promise.all(
          list.slice(0, 40).map(async (path) => {
            try {
              assertProjectPath(path);
              return { path, ...describeMeasure(await decodeAudioUrl(studioFileUrl(doc.slug, path)), fps) };
            } catch (error) {
              return { path, error: error instanceof Error ? error.message : String(error) };
            }
          }),
        );
      }
      if (!params.mix && !list.length) throw new Error("Pass paths, or mix: true.");
      return out;
    }

    case "studio_listen_rank": {
      const query = String(params.query ?? "").trim();
      if (query.length < 3) throw new Error("query is required: a plain description of the sound.");
      const list = paths(params.paths).slice(0, 80);
      list.forEach(assertProjectPath);
      const { rankFiles, VERDICTS, VERDICT_EVIDENCE } = await import("@/lib/studio/listen/match");
      const result = await rankFiles(
        query,
        list.map((path) => ({ path, url: studioFileUrl(doc.slug, path) })),
      );
      const top = typeof params.top === "number" ? params.top : 10;
      return {
        query,
        ranked: result.rows.slice(0, top),
        errors: result.errors.length ? result.errors : undefined,
        verdicts: Object.fromEntries(VERDICTS.map(([z, name]) => [name, `z >= ${z}`])),
        evidence: VERDICT_EVIDENCE,
        note: `z = how far your description stands out among ${result.vocabSize} vocabulary descriptions for that sound (earshot calibration). Prefer z >= 3 ("strong"); always check realness on the file you choose.`,
      };
    }

    case "studio_listen_tags": {
      const list = paths(params.paths).slice(0, 40);
      list.forEach(assertProjectPath);
      const top = typeof params.top === "number" ? params.top : 8;
      const { astProbabilities } = await import("@/lib/studio/listen/models");
      const files = [];
      for (const path of list) {
        try {
          const buffer = await decodeAudioUrl(studioFileUrl(doc.slug, path));
          const mono = new Float32Array(buffer.length);
          for (let c = 0; c < buffer.numberOfChannels; c += 1) {
            const data = buffer.getChannelData(c);
            for (let i = 0; i < data.length; i += 1) mono[i] += data[i] / buffer.numberOfChannels;
          }
          const y = resampleLinear(mono, buffer.sampleRate, 16_000);
          const win = 160_000;
          const windows: Float32Array[] = [];
          for (let s = 0; s < y.length && windows.length < 6; s += win) {
            if (y.length - s >= 16_000 || s === 0) windows.push(y.slice(s, s + win));
          }
          const { labels, probs } = await astProbabilities(windows);
          const best = new Float32Array(labels.length);
          for (const p of probs) for (let i = 0; i < p.length; i += 1) best[i] = Math.max(best[i], p[i]);
          const order = Array.from(best.keys()).sort((a, b) => best[b] - best[a]);
          files.push({ path, tags: order.slice(0, top).map((i) => ({ label: labels[i], p: round(best[i]) })) });
        } catch (error) {
          files.push({ path, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return { files, note: "AudioSet labels from AST (max over 10 s windows). Probabilities are per label (multi-label)." };
    }

    case "studio_listen_realness": {
      const list = paths(params.paths).slice(0, 40);
      list.forEach(assertProjectPath);
      const { realnessOfUrl } = await import("@/lib/studio/listen/realness");
      const files = [];
      for (const path of list) {
        try {
          files.push(await realnessOfUrl(studioFileUrl(doc.slug, path), path));
        } catch (error) {
          files.push({ path, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return {
        files,
        note: "p_real: real recording or pro-produced (>= 0.77) vs code-synthesized (<= 0.17 for a clip, <= 0.40 for a long file's mean). Judge the trim you will use.",
      };
    }

    case "studio_listen_critique": {
      const { critiqueProject } = await import("@/lib/studio/listen/critique");
      return critiqueProject(doc, variant, { fast: Boolean(params.fast) });
    }

    default:
      throw new Error(`Unknown listen tool ${method}.`);
  }
}
