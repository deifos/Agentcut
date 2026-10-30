export interface VoiceInfo {
  id: string;
  name: string;
  description?: string;
  previewUrl?: string;
}
export interface ProviderSpec {
  id: string;
  name: string;
  keyUrl: string;
  keyHint: string;
  envVar: string;
  defaultModel: string;
  models: { id: string; label: string }[];
  defaultVoice: string;
  styleNote: string;
}
export interface GenerateVoiceInput {
  provider?: string;
  model?: string;
  voice?: string;
  text: string;
  style?: string;
  language?: string;
  speed?: number;
  name?: string;
  takes?: number;
}
export interface Audio {
  data: Buffer;
  ext: "wav" | "mp3";
}
export interface VoiceAdapter {
  spec: ProviderSpec;
  voices: VoiceInfo[] | null;
  listVoices(key: string | null): Promise<VoiceInfo[]>;
  verify(key: string): Promise<void>;
  synthesize(
    key: string,
    input: GenerateVoiceInput,
    model: string,
    voice: string,
  ): Promise<Audio>;
}
