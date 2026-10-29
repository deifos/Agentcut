import { StringDecoder } from "node:string_decoder";

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

/** Budget caches and workers, not total Chrome/GPU memory. Leave room for the editor and OS. */
export function renderPolicy(freeBytes: number, cpus: number, requested?: string) {
  const cpuLimit = Math.max(1, Math.floor(cpus));
  const memoryLimit = Math.max(1, Math.floor((freeBytes - 2 * GiB) / (2 * GiB)));
  let workers = Math.min(2, cpuLimit, memoryLimit);
  if (requested !== undefined) {
    if (!/^[1-9]\d*$/.test(requested) || Number(requested) > cpuLimit) {
      throw new Error(`AGENTCUT_RENDER_CONCURRENCY must be a whole number from 1 to ${cpuLimit}.`);
    }
    workers = Math.min(Number(requested), memoryLimit);
  }
  const cacheBytes = Math.floor(Math.max(64 * MiB, Math.min(512 * MiB, freeBytes / (workers * 8))));
  return { workers, cacheBytes };
}

/** Child-process chunks are not lines. Keep partial lines and UTF-8 characters between chunks. */
export function renderLines(onLine: (line: string) => void) {
  const decoder = new StringDecoder("utf8");
  let pending = "";
  const consume = (text: string) => {
    pending += text;
    const lines = pending.split(/[\r\n]/);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      const clean = line.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "").trim();
      if (clean) onLine(clean);
    }
    // Bound malformed output without a newline.
    pending = pending.slice(-16_384);
  };
  return {
    write: (chunk: Buffer) => consume(decoder.write(chunk)),
    end: () => consume(`${decoder.end()}\n`),
  };
}

export function renderProgress(line: string) {
  const match = /\b(Rendered|Encoded)\s+(\d+)\/(\d+)/i.exec(line)
    ?? /()\b(\d+)\/(\d+)\s+frames\b/i.exec(line);
  if (!match) return null;
  const done = Number(match[2]);
  const total = Number(match[3]);
  if (!Number.isSafeInteger(done) || !Number.isSafeInteger(total) || total < 1 || done > total) return null;
  const stage = match[1].toLowerCase() === "encoded" ? "encoding" : "rendering";
  // Reserve the last part for encoding and finalizing. Only a successful exit means done.
  const progress = stage === "rendering" ? done / total * 0.9 : 0.9 + done / total * 0.09;
  return { stage, progress, done, total };
}
