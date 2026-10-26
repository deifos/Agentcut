// SigLIP vectors with Transformers.js: images when indexing, text when searching. Same space, so a
// query like "lonely city at night" scores shots directly, without going through their descriptions.
import { AutoProcessor, AutoTokenizer, env, RawImage, SiglipTextModel, SiglipVisionModel } from "@huggingface/transformers";
import { MODEL_CACHE } from "./lib.mjs";

export const EMBED_MODEL = process.env.BROLL_EMBED_MODEL ?? "Xenova/siglip-base-patch16-224";
env.cacheDir = MODEL_CACHE;

let vision;
async function visionModel() {
  vision ??= Promise.all([
    AutoProcessor.from_pretrained(EMBED_MODEL),
    SiglipVisionModel.from_pretrained(EMBED_MODEL, { dtype: "fp32" }),
  ]);
  return vision;
}

let text;
async function textModel() {
  text ??= Promise.all([
    AutoTokenizer.from_pretrained(EMBED_MODEL),
    SiglipTextModel.from_pretrained(EMBED_MODEL, { dtype: "fp32" }),
  ]);
  return text;
}

const rows = (tensor) => {
  const [count, dim] = tensor.dims;
  return Array.from({ length: count }, (_, i) => Array.from(tensor.data.subarray(i * dim, (i + 1) * dim)));
};

/** One raw (unnormalized) vector per image. */
export async function embedImages(paths) {
  const [processor, model] = await visionModel();
  const images = await Promise.all(paths.map((p) => RawImage.read(p)));
  const { pooler_output } = await model(await processor(images));
  return rows(pooler_output);
}

/** One raw vector per text; SigLIP was trained on max_length padding. */
export async function embedTexts(texts) {
  const [tokenizer, model] = await textModel();
  const inputs = tokenizer(texts, { padding: "max_length", truncation: true });
  const { pooler_output } = await model(inputs);
  return rows(pooler_output);
}
