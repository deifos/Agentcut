import { assemblyai } from "./assemblyai.js";
import { localWhisper } from "./local.js";
import type { TranscriptionAdapter } from "./types.js";

/** Add an adapter here; settings and agent discovery read the same metadata. */
export const TRANSCRIPTION_ADAPTERS: Record<string, TranscriptionAdapter> =
  Object.fromEntries(
    [localWhisper, assemblyai].map((adapter) => [adapter.metadata.id, adapter]),
  );
