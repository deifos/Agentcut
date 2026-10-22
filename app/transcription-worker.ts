import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";

type DeviceType = "webgpu" | "wasm";
type ModelSize = "tiny" | "base" | "small";

const MODEL_IDS: Record<ModelSize, string> = {
  tiny: "onnx-community/whisper-tiny_timestamped",
  base: "onnx-community/whisper-base_timestamped",
  small: "onnx-community/whisper-small_timestamped",
};

const PER_DEVICE_CONFIG = {
  webgpu: {
    dtype: {
      encoder_model: "fp32" as const,
      decoder_model_merged: "q4" as const,
    },
    device: "webgpu" as const,
  },
  wasm: {
    dtype: "q8" as const,
    device: "wasm" as const,
  },
};

class PipelineSingleton {
  static currentModelId: string | null = null;
  static instance: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

  static resetInstance(): void {
    this.instance = null;
    this.currentModelId = null;
  }

  static async getInstance(
    modelSize: ModelSize = "base",
    progress_callback?: (progress: {
      status?: string;
      data?: unknown;
      loaded?: number;
      total?: number;
      progress?: number;
    }) => void,
    device: DeviceType = "webgpu",
  ): Promise<AutomaticSpeechRecognitionPipeline> {
    const modelId = MODEL_IDS[modelSize];

    if (this.currentModelId && this.currentModelId !== modelId) {
      this.resetInstance();
    }

    if (!this.instance) {
      this.currentModelId = modelId;
      // Typed by hand: inferring pipeline()'s overloads is too complex for tsc here.
      const createPipeline = pipeline as unknown as (
        task: "automatic-speech-recognition",
        model: string,
        options: object,
      ) => Promise<AutomaticSpeechRecognitionPipeline>;
      this.instance = createPipeline("automatic-speech-recognition", modelId, {
        ...PER_DEVICE_CONFIG[device],
        ...(progress_callback && { progress_callback }),
      });
    }
    return this.instance;
  }
}

let activeDevice: DeviceType | null = null;
let activeModelSize: ModelSize | null = null;
let loadPromise: Promise<void> | null = null;

self.addEventListener("message", async (e: MessageEvent) => {
  const { type, data } = e.data;
  switch (type) {
    case "load":
      await handleLoad(data);
      break;
    case "run":
      await handleRun(data);
      break;
  }
});

async function handleLoad({
  device = "wasm",
  modelSize = "base",
}: {
  device?: DeviceType;
  modelSize?: ModelSize;
}) {
  if (
    !loadPromise ||
    device !== activeDevice ||
    modelSize !== activeModelSize
  ) {
    if (device !== activeDevice || modelSize !== activeModelSize) {
      PipelineSingleton.resetInstance();
      loadPromise = null;
    }

    self.postMessage({
      status: "loading",
      data: `Loading Whisper ${modelSize} model (${device})...`,
    });

    loadPromise = (async () => {
      try {
        const transcriber = await PipelineSingleton.getInstance(
          modelSize,
          (progressInfo) => self.postMessage(progressInfo),
          device,
        );

        activeDevice = device;
        activeModelSize = modelSize;

        if (device === "webgpu") {
          self.postMessage({
            status: "loading",
            data: "Compiling shaders and warming up model...",
          });
          await transcriber(new Float32Array(16_000), { language: "en" });
        }
      } catch (error) {
        PipelineSingleton.resetInstance();
        activeDevice = null;
        activeModelSize = null;
        throw error;
      }
    })();
  }

  try {
    await loadPromise;
    self.postMessage({ status: "ready" });
  } catch (error) {
    loadPromise = null;
    self.postMessage({
      status: "error",
      data: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function handleRun({
  audio,
  language = "en",
  device,
  modelSize = "base",
}: {
  audio: Float32Array;
  language?: string;
  device?: DeviceType;
  modelSize?: ModelSize;
}) {
  try {
    if (loadPromise) await loadPromise;

    const targetDevice = device ?? activeDevice ?? "wasm";
    const targetModelSize = modelSize ?? activeModelSize ?? "base";
    const transcriber = await PipelineSingleton.getInstance(
      targetModelSize,
      undefined,
      targetDevice,
    );

    // Access pipeline internals for chunked streaming
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = transcriber as any;
    const proc = p.processor;
    const model = p.model;
    const tokenizer = p.tokenizer;

    const sampling_rate: number = proc.feature_extractor.config.sampling_rate;
    const hop_length: number = proc.feature_extractor.config.hop_length;
    const time_precision: number =
      proc.feature_extractor.config.chunk_length /
      model.config.max_source_positions;

    const CHUNK_S = 30;
    const STRIDE_S = 5;
    const window_samples = sampling_rate * CHUNK_S;
    const stride_samples = sampling_rate * STRIDE_S;
    const jump_samples = window_samples - 2 * stride_samples;

    const generation_config: Record<string, unknown> = {
      language,
      return_timestamps: true,
      return_token_timestamps: true,
      force_full_sequences: false,
      suppress_tokens: [],
    };

    const start = performance.now();

    // Build chunk list
    type Chunk = {
      stride: number[];
      input_features: unknown;
      is_last: boolean;
      tokens?: bigint[];
      token_timestamps?: number[];
    };
    const chunks: Chunk[] = [];
    let offset = 0;
    while (true) {
      const offset_end = offset + window_samples;
      const subarr = audio.subarray(offset, offset_end);
      const feature = await proc(subarr);
      const is_first = offset === 0;
      const is_last = offset_end >= audio.length;
      chunks.push({
        stride: [
          subarr.length,
          is_first ? 0 : stride_samples,
          is_last ? 0 : stride_samples,
        ],
        input_features: feature.input_features,
        is_last,
      });
      if (is_last) break;
      offset += jump_samples;
    }

    // Process chunks with streaming partial results
    const processed: Chunk[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const data = await model.generate({
        inputs: chunk.input_features,
        ...generation_config,
        num_frames: Math.floor(chunk.stride[0] / hop_length),
      });

      chunk.tokens = data.sequences.tolist()[0] as bigint[];
      chunk.token_timestamps = (
        data.token_timestamps.tolist()[0] as number[]
      ).map((x: number) => Math.round(x * 100) / 100);
      chunk.stride = chunk.stride.map((x) => x / sampling_rate);
      processed.push(chunk);

      const [partialText, partialOptional] = tokenizer._decode_asr(processed, {
        time_precision,
        return_timestamps: "word",
        force_full_sequences: false,
      }) as [
        string,
        { chunks?: Array<{ text: string; timestamp: [number, number] }> },
      ];

      self.postMessage({
        status: "update",
        result: { text: partialText, chunks: partialOptional.chunks ?? [] },
        progress: 60 + Math.round(((i + 1) / chunks.length) * 39),
      });
    }

    const end = performance.now();

    const [fullText, fullOptional] = tokenizer._decode_asr(processed, {
      time_precision,
      return_timestamps: "word",
      force_full_sequences: false,
    }) as [
      string,
      { chunks?: Array<{ text: string; timestamp: [number, number] }> },
    ];

    self.postMessage({
      status: "complete",
      result: {
        text: fullText,
        chunks: fullOptional.chunks ?? [],
        wordLevel: true,
      },
      time: end - start,
    });
  } catch (error) {
    PipelineSingleton.resetInstance();
    activeDevice = null;
    activeModelSize = null;
    loadPromise = null;
    self.postMessage({
      status: "error",
      data: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
