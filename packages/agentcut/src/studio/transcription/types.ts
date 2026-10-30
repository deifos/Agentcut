import type { ProviderMetadata } from "../providers/settings.js";

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  fromFrame: number;
  toFrame: number;
  speaker?: string;
  confidence?: number;
}
export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}
export interface Transcript {
  text: string;
  language: string;
  model: string;
  seconds: number;
  fps: number;
  words: TranscriptWord[];
  segments: TranscriptSegment[];
  provider: string;
  provenance: {
    provider: string;
    model: string;
    options: Record<string, unknown>;
    source: string;
    createdAt: string;
    cacheKey: string;
  };
  note?: string;
}
export interface TranscriptionInput {
  path: string;
  provider?: string;
  language?: string;
  model?: string;
  speakerLabels?: boolean;
  job?: string;
}
export interface TranscriptionContext {
  fps: number;
  key: string | null;
  signal: AbortSignal;
  progress(stage: string): void;
  local(options: {
    language: string;
    model: string;
  }): Promise<Record<string, unknown>>;
  audio(): Promise<string>;
}
export interface TranscriptionAdapter {
  metadata: ProviderMetadata & {
    cloud: boolean;
    capabilities: {
      wordTimings: boolean;
      speakers: boolean;
      languageDetection: boolean;
      fillers: string;
    };
    models: string[];
    defaultModel: string;
  };
  run(
    input: TranscriptionInput,
    context: TranscriptionContext,
  ): Promise<Omit<Transcript, "provenance" | "provider">>;
}
