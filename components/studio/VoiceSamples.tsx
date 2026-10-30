"use client";

// Free demo clips for every voice (generated once by scripts/generate-studio-voice-samples.ts
// and hosted on our R2), so people can pick a provider and a voice before adding a key.
import { TooltipHint } from "@/components/ui/tooltip";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import manifest from "@/lib/studio/voice-samples.json";

type ProviderId = "elevenlabs" | "gemini" | "openai" | "xai";

interface SampleVoice {
  id: string;
  name: string;
  description?: string;
  url: string;
}

const PROVIDER_NAMES: Record<ProviderId, string> = {
  elevenlabs: "ElevenLabs",
  gemini: "Gemini",
  openai: "OpenAI",
  xai: "Grok",
};

/** What each provider charges (checked Oct 2026; prices change, so link the source). ~1,000 characters ≈ 1 minute of speech. */
export const VOICE_PRICING: Record<
  ProviderId,
  { summary: string; detail: string; url: string }
> = {
  elevenlabs: {
    summary: "≈ $0.08 / min",
    detail:
      "$0.08 per 1K characters (v4, v3, Multilingual v2), $0.04 for Flash. Free plan: 10K characters a month.",
    url: "https://elevenlabs.io/pricing/api",
  },
  gemini: {
    summary: "≈ $0.014 / min",
    detail:
      "Gemini 3.8 Flash TTS ≈ 1.4¢ a minute ($9 per 1M audio tokens, 25 tokens a second), Flash-Lite ≈ 0.9¢ ($6). Google doubles both on 1 Jan 2027.",
    url: "https://ai.google.dev/gemini-api/docs/pricing",
  },
  openai: {
    summary: "≈ $0.015 / min",
    detail:
      "gpt-4o-mini-tts ≈ 1.5¢ a minute. tts-1 $15 and tts-1-hd $30 per 1M characters.",
    url: "https://platform.openai.com/docs/pricing",
  },
  xai: {
    summary: "≈ $0.015 / min",
    detail: "$15 per 1M characters (about 1,000 characters a minute of speech).",
    url: "https://x.ai/news/grok-stt-and-tts-apis",
  },
};

export function PriceNote({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  const price = VOICE_PRICING[provider as ProviderId];
  if (!price) return null;
  return (
    <p className={cn("text-[11px] text-muted-foreground", className)}>
      <span className="font-semibold text-foreground">{price.summary}</span> ·{" "}
      {price.detail}{" "}
      <a
        href={price.url}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        Pricing
      </a>
    </p>
  );
}

const samples = (
  manifest as { providers: Partial<Record<ProviderId, SampleVoice[]>> }
).providers;

export function sampleFor(provider: string, voice: string): SampleVoice | null {
  return samples[provider as ProviderId]?.find((v) => v.id === voice) ?? null;
}

export function hasVoiceSamples() {
  return Object.values(samples).some((list) => (list?.length ?? 0) > 0);
}

/** One shared player for all sample buttons on the page. */
let current: { audio: HTMLAudioElement; url: string; done(): void } | null =
  null;

export function useSamplePlayer() {
  const [playing, setPlaying] = useState<string | null>(null);
  const mine = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (current && current.url === mine.current) {
        current.audio.pause();
        current = null;
      }
    },
    [],
  );
  const toggle = (url: string) => {
    if (current?.url === url) {
      current.audio.pause();
      current.done();
      current = null;
      return;
    }
    if (current) {
      current.audio.pause();
      current.done();
    }
    const audio = new Audio(url);
    const done = () => {
      setPlaying((value) => (value === url ? null : value));
      if (current?.url === url) current = null;
    };
    audio.onended = done;
    audio.onerror = done;
    current = { audio, url, done };
    mine.current = url;
    setPlaying(url);
    void audio.play().catch(done);
  };
  return { playing, toggle };
}

export function SampleButton({
  provider,
  voice,
  className,
}: {
  provider: string;
  voice: string;
  className?: string;
}) {
  const sample = sampleFor(provider, voice);
  const { playing, toggle } = useSamplePlayer();
  if (!sample) return null;
  const isPlaying = playing === sample.url;
  return (
    <TooltipHint content="Listen to a sample (free)">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => toggle(sample.url)}
        aria-label={
          isPlaying ? `Stop ${sample.name} sample` : `Play ${sample.name} sample`
        }
        className={cn("shrink-0", className)}
      >
        {isPlaying ? <Pause /> : <Play />}
      </Button>
    </TooltipHint>
  );
}

export function VoiceSamples({
  initialProvider,
}: {
  initialProvider?: string;
}) {
  const available = (Object.keys(PROVIDER_NAMES) as ProviderId[]).filter(
    (id) => (samples[id]?.length ?? 0) > 0,
  );
  const [tab, setTab] = useState<ProviderId | undefined>(
    initialProvider && available.includes(initialProvider as ProviderId)
      ? initialProvider as ProviderId
      : available[0],
  );
  const { playing, toggle } = useSamplePlayer();
  if (!available.length || !tab) return null;
  const voices = samples[tab] ?? [];

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Listen to the voices
        </h3>
        <span className="text-[11px] text-muted-foreground">
          free samples, no key needed
        </span>
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as ProviderId)}
        className="gap-2"
      >
        <TabsList>
          {available.map((id) => (
            <TabsTrigger key={id} value={id} className="text-xs">
              {PROVIDER_NAMES[id]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <PriceNote provider={tab} />
      <ScrollArea viewportClassName="max-h-56">
        <div className="grid grid-cols-2 gap-1.5 pr-3 sm:grid-cols-3">
          {voices.map((voice) => {
            const isPlaying = playing === voice.url;
            return (
              <TooltipHint content={
                  voice.description
                    ? `${voice.name}: ${voice.description}`
                    : voice.name
                } key={voice.id}>
                <Button
                  type="button"
                  variant={isPlaying ? "secondary" : "outline"}
                  onClick={() => toggle(voice.url)}
                  className="h-auto justify-start gap-2 px-2 py-1.5 text-left"
                >
                  {isPlaying ? <Pause className="text-primary" /> : <Play />}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">
                      {voice.name}
                    </span>
                    {voice.description ? (
                      <span className="block truncate text-[10px] font-normal text-muted-foreground">
                        {voice.description}
                      </span>
                    ) : null}
                  </span>
                </Button>
              </TooltipHint>
            );
          })}
        </div>
      </ScrollArea>
    </section>
  );
}
