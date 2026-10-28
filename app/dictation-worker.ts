import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";

// Chat dictation: Moonshine reads audio of any length (no 30 s padding like Whisper),
// so re-reading a growing phrase several times a second stays cheap.
const MODEL_ID = "onnx-community/moonshine-base-ONNX";

type DeviceType = "webgpu" | "wasm";

const PER_DEVICE_CONFIG = {
  webgpu: {
    dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
    device: "webgpu",
  },
  wasm: {
    dtype: { encoder_model: "fp32", decoder_model_merged: "q8" },
    device: "wasm",
  },
} as const;

let instance: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function load(device: DeviceType) {
  if (!instance) {
    // Typed by hand: inferring pipeline()'s overloads is too complex for tsc here.
    const createPipeline = pipeline as unknown as (
      task: "automatic-speech-recognition",
      model: string,
      options: object,
    ) => Promise<AutomaticSpeechRecognitionPipeline>;
    instance = (async () => {
      const options = (target: DeviceType) => ({
        ...PER_DEVICE_CONFIG[target],
        progress_callback: (progress: {
          status?: string;
          progress?: number;
          file?: string;
        }) => {
          if (progress.status === "progress") {
            self.postMessage({
              type: "progress",
              file: progress.file,
              progress: progress.progress,
            });
          }
        },
      });
      const initialize = async (target: DeviceType) => {
        const transcriber = await createPipeline(
          "automatic-speech-recognition",
          MODEL_ID,
          options(target),
        );
        try {
          // Shader compilation can fail even after the model loads.
          await transcriber(new Float32Array(16_000), { max_new_tokens: 4 });
          return transcriber;
        } catch (error) {
          await transcriber.dispose();
          throw error;
        }
      };
      try {
        return await initialize(device);
      } catch (error) {
        if (device !== "webgpu") throw error;
        return await initialize("wasm");
      }
    })();
    instance.catch(() => {
      instance = null;
    });
  }
  return instance;
}

// A previous box can still be finishing when the next box starts recording.
// The model's decoder state must only be used by one request at a time.
let queue = Promise.resolve();
self.addEventListener("message", (event: MessageEvent) => {
  queue = queue.then(() => handleMessage(event));
});

async function handleMessage(event: MessageEvent) {
  const { type, id, device, audio } = event.data as {
    type: "load" | "run";
    id?: number;
    device?: DeviceType;
    audio?: Float32Array;
  };
  try {
    const transcriber = await load(device ?? "wasm");
    if (type === "load") {
      self.postMessage({ type: "ready" });
      return;
    }
    if (!audio) return;
    const seconds = audio.length / 16_000;
    // The paper's limit (about 6 tokens per second of audio) stops repeated output.
    const result = (await transcriber(audio, {
      max_new_tokens: Math.max(8, Math.ceil(seconds * 6.5)),
    })) as { text: string };
    self.postMessage({ type: "result", id, text: result.text.trim() });
  } catch (error) {
    self.postMessage({
      type: "error",
      id,
      message:
        error instanceof Error ? error.message : "Speech recognition failed.",
    });
  }
}
