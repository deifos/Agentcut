/// <reference lib="webworker" />
// CLAP (laion/larger_clap_general) and AST (AudioSet) for the studio's listening
// tools, in a worker so the page stays responsive. Models download once from
// Hugging Face and are cached by the browser.
import {
  AutoModelForAudioClassification,
  AutoProcessor,
  AutoTokenizer,
  ClapAudioModelWithProjection,
  ClapTextModelWithProjection,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  type Processor,
} from "@huggingface/transformers";

const CLAP_ID = "Xenova/larger_clap_general";
const AST_ID = "Xenova/ast-finetuned-audioset-10-10-0.4593";

type Device = "webgpu" | "wasm";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const device: Device = "gpu" in navigator ? "webgpu" : "wasm";
const dtype = device === "webgpu" ? "fp16" : "q8";

let textModel: Promise<{ tokenizer: PreTrainedTokenizer; model: PreTrainedModel }> | null = null;
let audioModel: Promise<{ processor: Processor; model: PreTrainedModel }> | null = null;
let astModel: Promise<{ processor: Processor; model: PreTrainedModel; labels: string[] }> | null = null;

function progress(name: string) {
  return (info: { status?: string; file?: string; loaded?: number; total?: number; progress?: number }) => {
    if (info.status === "progress" || info.status === "done") {
      scope.postMessage({ type: "progress", model: name, file: info.file, loaded: info.loaded, total: info.total, progress: info.progress });
    }
  };
}

async function withFallback<T>(load: (options: { device: Device; dtype: string }) => Promise<T>): Promise<T> {
  try {
    return await load({ device, dtype });
  } catch (error) {
    if (device === "wasm") throw error;
    // WebGPU can fail on some drivers: fall back to CPU.
    return load({ device: "wasm", dtype: "q8" });
  }
}

function getText() {
  textModel ??= (async () => {
    const tokenizer = await AutoTokenizer.from_pretrained(CLAP_ID, { progress_callback: progress("clap-text") });
    const model = await withFallback((o) =>
      ClapTextModelWithProjection.from_pretrained(CLAP_ID, { ...o, progress_callback: progress("clap-text") } as never),
    );
    return { tokenizer, model };
  })();
  return textModel;
}

function getAudio() {
  audioModel ??= (async () => {
    const processor = await AutoProcessor.from_pretrained(CLAP_ID, { progress_callback: progress("clap-audio") });
    const model = await withFallback((o) =>
      ClapAudioModelWithProjection.from_pretrained(CLAP_ID, { ...o, progress_callback: progress("clap-audio") } as never),
    );
    return { processor, model };
  })();
  return audioModel;
}

function getAst() {
  astModel ??= (async () => {
    const processor = await AutoProcessor.from_pretrained(AST_ID, { progress_callback: progress("ast") });
    const model = await withFallback((o) =>
      AutoModelForAudioClassification.from_pretrained(AST_ID, { ...o, progress_callback: progress("ast") } as never),
    );
    const id2label = (model.config as unknown as { id2label: Record<string, string> }).id2label;
    const labels = Object.keys(id2label)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => id2label[key]);
    return { processor, model, labels };
  })();
  return astModel;
}

function normalizeRows(data: Float32Array, rows: number, dim: number) {
  const out = new Float32Array(rows * dim);
  for (let r = 0; r < rows; r += 1) {
    let norm = 0;
    for (let d = 0; d < dim; d += 1) norm += data[r * dim + d] ** 2;
    norm = Math.sqrt(norm) + 1e-12;
    for (let d = 0; d < dim; d += 1) out[r * dim + d] = data[r * dim + d] / norm;
  }
  return out;
}

async function embedText(texts: string[]) {
  const { tokenizer, model } = await getText();
  const batch = 32;
  const out = new Float32Array(texts.length * 512);
  for (let i = 0; i < texts.length; i += batch) {
    const chunk = texts.slice(i, i + batch);
    const inputs = tokenizer(chunk, { padding: true, truncation: true });
    const result = (await model(inputs)) as { text_embeds: { data: Float32Array | Uint16Array; dims: number[] } };
    const data = Float32Array.from(result.text_embeds.data as ArrayLike<number>);
    out.set(normalizeRows(data, chunk.length, 512), i * 512);
  }
  return out;
}

async function embedAudio(windows: Float32Array[]) {
  const { processor, model } = await getAudio();
  const out = new Float32Array(windows.length * 512);
  for (let i = 0; i < windows.length; i += 1) {
    let window = windows[i];
    if (window.length < 480) {
      const padded = new Float32Array(480);
      padded.set(window);
      window = padded;
    }
    const inputs = await processor(window);
    const result = (await model(inputs)) as { audio_embeds: { data: Float32Array | Uint16Array } };
    const data = Float32Array.from(result.audio_embeds.data as ArrayLike<number>);
    out.set(normalizeRows(data, 1, 512), i * 512);
  }
  return out;
}

async function astProbs(windows: Float32Array[]) {
  const { processor, model, labels } = await getAst();
  const probs: Float32Array[] = [];
  for (const window of windows) {
    const inputs = await processor(window);
    const result = (await model(inputs)) as { logits: { data: Float32Array | Uint16Array } };
    const logits = Float32Array.from(result.logits.data as ArrayLike<number>);
    probs.push(logits.map((v) => 1 / (1 + Math.exp(-v))));
  }
  return { labels, probs };
}

scope.addEventListener("message", async (event: MessageEvent) => {
  const { id, type, payload } = event.data as { id: number; type: string; payload: unknown };
  try {
    let result: unknown;
    if (type === "text") result = await embedText(payload as string[]);
    else if (type === "audio") result = await embedAudio(payload as Float32Array[]);
    else if (type === "ast") result = await astProbs(payload as Float32Array[]);
    else if (type === "info") result = { device, dtype };
    else throw new Error(`Unknown request ${type}`);
    scope.postMessage({ type: "result", id, result });
  } catch (error) {
    scope.postMessage({ type: "error", id, error: error instanceof Error ? error.message : String(error) });
  }
});
