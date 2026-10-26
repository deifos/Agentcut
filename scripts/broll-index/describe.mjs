// Shot descriptions from a local vision model served by Ollama (no API keys, runs on the GPU).
import { readFileSync } from "node:fs";

export const DESCRIBE_MODEL = process.env.BROLL_DESCRIBE_MODEL ?? "gemma3:4b";
const OLLAMA_URL = process.env.OLLAMA_HOST ? `http://${process.env.OLLAMA_HOST.replace(/^https?:\/\//, "")}` : "http://127.0.0.1:11434";

const SCHEMA = {
  type: "object",
  properties: {
    description: { type: "string" },
    subjects: { type: "array", items: { type: "string" } },
    setting: { type: "string" },
    mood: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    shot_size: { type: "string", enum: ["extreme-wide", "wide", "medium", "close-up", "extreme-close-up"] },
    camera: { type: "string", enum: ["static", "pan", "tilt", "zoom", "tracking", "handheld", "aerial", "unclear"] },
    people: { type: "string", enum: ["none", "one", "few", "crowd"] },
    color: { type: "string", enum: ["black-and-white", "color", "tinted"] },
    text_on_screen: { type: "boolean" },
    title_card: { type: "boolean" },
    background_ok: { type: "boolean" },
    quality: { type: "string", enum: ["good", "soft", "damaged"] },
    sensitive: { type: "boolean" },
  },
  required: [
    "description", "subjects", "setting", "mood", "tags", "shot_size", "camera", "people",
    "color", "text_on_screen", "title_card", "background_ok", "quality", "sensitive",
  ],
};

const PROMPT = ({ title, year }) => `You are cataloguing b-roll shots from an archival film for video editors who search by meaning.
The three images are frames from the start, middle and end of ONE shot${title ? ` from "${title}"${year ? ` (${year})` : ""}` : ""}.
Describe only what is visible; use the film title only to name things you can actually see.
Write about the shot itself: never say "the three frames" or "the images".

- description: one or two concrete sentences: the subject, the action, the setting, and how the camera moves across the three frames.
- subjects: the main visible things (nouns, 2–6).
- setting: where it is (e.g. "suburban kitchen", "factory floor", "night city street").
- mood: 2–4 feelings the shot evokes (e.g. "optimistic", "lonely", "tense", "nostalgic").
- tags: 6–14 search words an editor might type, including concepts and metaphors the shot could illustrate
  (e.g. a clock → "time", "deadline", "waiting"; an assembly line → "automation", "scale", "productivity").
- shot_size, people, color.
- camera: compare the framing across the three frames. "static" if the framing doesn't change (people may
  still move); "pan"/"tilt" if the camera turns in place; "tracking" only if the camera itself travels.
- text_on_screen: any readable text, captions or signs. title_card: the shot is mainly titles or credits.
- background_ok: true only if most of the frame is calm and simple (sky, water, wall, landscape, soft
  texture, slow movement) so large text on top stays readable; false for crowds, busy detail or fast action.
- quality: "damaged" for heavy scratches, tears, flicker or near-black frames; "soft" for blurry; else "good".
- sensitive: true for violence, injury, medical or nudity, weapons pointed at people, or demeaning stereotypes.`;

export async function describeShot(framePaths, context) {
  const images = framePaths.map((p) => readFileSync(p).toString("base64"));
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: DESCRIBE_MODEL,
      stream: false,
      format: SCHEMA,
      options: { temperature: 0.2, num_ctx: 8192 },
      keep_alive: "30m",
      messages: [{ role: "user", content: PROMPT(context), images }],
    }),
  });
  if (!response.ok) throw new Error(`Ollama ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const json = await response.json();
  return JSON.parse(json.message.content);
}
