"use client";

// Voice-over providers: the user picks one, pastes their API key once, and the agent can
// generate voice-overs with it. Keys go straight to the helper on this computer and are
// never shown again (the field is masked, so it's safe on a stream or screen share).
import { TooltipHint } from "@/components/ui/tooltip";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  KeyRound,
  Mic,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  SampleButton,
  VoiceSamples,
} from "@/components/studio/VoiceSamples";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { studioFileUrl } from "@/lib/studio/bundle";
import type { StudioBridge } from "@/lib/studio/bridge";
import { MediaPlayer } from "@/components/studio/AssetPreview";
import { useAgentName } from "@/components/studio/StudioAgent";

type ProviderId = string;

interface ProviderState {
  id: ProviderId;
  name: string;
  keyUrl: string;
  keyHint: string;
  configured: boolean;
  source: "saved" | "environment" | null;
  models: { id: string; label: string }[];
  defaultModel: string;
  defaultVoice: string;
  styleNote: string;
}

interface VoiceSettings {
  providers: ProviderState[];
  defaultProvider: ProviderId | null;
}

interface VoiceInfo {
  id: string;
  name: string;
  description?: string;
}

interface GenerateResult {
  provider: string;
  voice: string;
  takes: ({ path: string; seconds: number | null } | { error: string })[];
}

const SAMPLE_TEXT =
  "Hi! This is how I'll sound in your video. Let's make something great.";

export function VoicesDialog({
  open,
  onOpenChange,
  getBridge,
  slug,
  onGenerated,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  getBridge(): StudioBridge | null;
  slug: string | null;
  onGenerated(): void;
}) {
  const agentName = useAgentName();
  const [settings, setSettings] = useState<VoiceSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<ProviderId>("elevenlabs");
  const [key, setKey] = useState("");
  const [makeDefault, setMakeDefault] = useState(true);
  const [saving, setSaving] = useState(false);

  const request = useCallback(
    async <T,>(
      method: string,
      params: Record<string, unknown> = {},
      timeoutMs = 30_000,
    ) => {
      const bridge = getBridge();
      if (!bridge) throw new Error("The studio helper isn't connected.");
      return bridge.request<T>(method, params, timeoutMs);
    },
    [getBridge],
  );

  useEffect(() => {
    if (!open) return;
    let alive = true;
    request<VoiceSettings>("studio.voice.settings")
      .then((value) => {
        if (!alive) return;
        setSettings(value);
        setError(null);
        // Only the first key becomes the default automatically; later ones ask.
        setMakeDefault(!value.defaultProvider);
        const firstMissing = value.providers.find((p) => !p.configured);
        if (firstMissing) setAdding(firstMissing.id);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const message = e instanceof Error ? e.message : String(e);
        setError(
          /Unknown studio method/.test(message)
            ? "Update and restart the studio helper (npm run build, then npm run studio) to use voices."
            : message,
        );
      });
    return () => {
      alive = false;
    };
  }, [open, request]);

  const provider = settings?.providers.find((p) => p.id === adding) ?? null;
  const configured = settings?.providers.filter((p) => p.configured) ?? [];

  const save = async () => {
    if (!key.trim() || !provider) return;
    setSaving(true);
    try {
      const next = await request<VoiceSettings>(
        "studio.voice.saveKey",
        { provider: provider.id, key: key.trim(), makeDefault },
        45_000,
      );
      setSettings(next);
      setKey("");
      setMakeDefault(false);
      toast.success(
        `${provider.name} is connected. Ask ${agentName} for a voice-over any time.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: ProviderId) => {
    try {
      setSettings(
        await request<VoiceSettings>("studio.voice.removeKey", {
          provider: id,
        }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const setDefault = async (id: ProviderId) => {
    try {
      setSettings(
        await request<VoiceSettings>("studio.voice.setDefault", {
          provider: id,
        }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="size-4" /> Voice-over &amp; music
          </DialogTitle>
          <DialogDescription>
            Connect your own voice provider. Then just ask {agentName}: “make a
            voiceover with Puck” or “read the script in an upbeat voice”. A
            Gemini key also lets {agentName} write original songs with Google
            Lyria (“make an upbeat song for this video”). Without one,{" "}
            {agentName} composes music in code.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea
          className="-mr-3 min-h-0 flex-1"
          viewportClassName="max-h-[calc(90vh-9rem)] pr-3"
        >
          {error ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              {error}
            </p>
          ) : null}
          {!settings && !error ? (
            <Spinner className="mx-auto size-5 text-muted-foreground" />
          ) : null}

          {settings ? (
            <div className="space-y-5">
              <section className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Add a provider
                </h3>
                <div className="flex gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
                  <ShieldCheck className="mt-px size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground">
                      Your key stays on this computer
                    </p>
                    <p className="text-muted-foreground">
                      It&apos;s saved in your user folder, never uploaded to
                      Agentcut, never put in a project and never shown to{" "}
                      {agentName}. The studio helper adds it only when it calls the
                      provider. The field is masked, so it&apos;s safe to paste
                      on a stream.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
                  <Select
                    value={adding}
                    onValueChange={(value) => setAdding(value as ProviderId)}
                  >
                    <SelectTrigger className="w-full" aria-label="Provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settings.providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.configured ? (
                            <Check className="text-emerald-500" />
                          ) : null}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={key}
                      onChange={(event) => setKey(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void save();
                      }}
                      placeholder={
                        provider?.configured
                          ? "Paste a new key to replace it"
                          : "Paste your API key"
                      }
                      autoComplete="off"
                      spellCheck={false}
                      data-1p-ignore
                      data-lpignore="true"
                      aria-label={`${provider?.name ?? "Provider"} API key`}
                      className="min-w-0 flex-1 font-mono"
                    />
                    <Button
                      type="button"
                      onClick={() => void save()}
                      disabled={!key.trim() || saving}
                    >
                      {saving ? <Spinner /> : <KeyRound />}{" "}
                      {saving ? "Checking…" : "Save"}
                    </Button>
                  </div>
                </div>
                {provider ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <a
                      href={provider.keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 font-semibold text-foreground hover:underline"
                    >
                      Get a {provider.name} key{" "}
                      <ExternalLink className="size-3" />
                    </a>
                    <span>{provider.keyHint}</span>
                    <Label className="ml-auto gap-1.5 text-[11px] font-normal text-muted-foreground">
                      <Checkbox
                        checked={makeDefault}
                        onCheckedChange={(value) =>
                          setMakeDefault(value === true)
                        }
                      />{" "}
                      Use as default
                    </Label>
                  </div>
                ) : null}
                </section>

              <VoiceSamples
                initialProvider={settings.defaultProvider ?? adding}
              />

              <section className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Connected
                </h3>
                {configured.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    None yet. Pick a provider above and paste its key.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
                    {configured.map((p) => {
                      const isDefault = settings.defaultProvider === p.id;
                      return (
                        <li
                          key={p.id}
                          className="flex items-center gap-2 px-3 py-2 text-[13px]"
                        >
                          <Check className="size-3.5 text-emerald-500" />
                          <span className="font-semibold">{p.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {p.source === "environment"
                              ? "from an environment variable"
                              : "key saved"}
                          </span>
                          {isDefault ? (
                            <Badge variant="secondary" className="ml-auto">
                              Default
                            </Badge>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => void setDefault(p.id)}
                              className="ml-auto text-muted-foreground"
                            >
                              Make default
                            </Button>
                          )}
                          {p.source === "saved" ? (
                            <TooltipHint content="Remove key">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => void remove(p.id)}
                                aria-label={`Remove ${p.name} key`}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 />
                              </Button>
                            </TooltipHint>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {configured.length > 0 && slug ? (
                <TryVoice
                  key={settings.defaultProvider ?? configured[0].id}
                  providers={configured}
                  initialProvider={settings.defaultProvider ?? configured[0].id}
                  slug={slug}
                  request={request}
                  onGenerated={onGenerated}
                />
              ) : null}

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Generating a voice-over uses your provider account (billed by
                them). Listening to the samples is free.
              </p>
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function TryVoice({
  providers,
  initialProvider,
  slug,
  request,
  onGenerated,
}: {
  providers: ProviderState[];
  initialProvider: ProviderId;
  slug: string;
  request: <T>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ) => Promise<T>;
  onGenerated(): void;
}) {
  const [providerId, setProviderId] = useState<ProviderId>(initialProvider);
  const provider = providers.find((p) => p.id === providerId) ?? providers[0];
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [voice, setVoice] = useState("");
  const [model, setModel] = useState(provider.defaultModel);
  const [text, setText] = useState(SAMPLE_TEXT);
  const [style, setStyle] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ path: string } | null>(null);

  useEffect(() => {
    let alive = true;
    request<{ voices: VoiceInfo[] }>("studio.voice.voices", {
      provider: provider.id,
    })
      .then(({ voices: list }) => {
        if (!alive) return;
        setVoices(list);
        setVoice((current) =>
          list.some((v) => v.id === current)
            ? current
            : (list.find((v) => v.id === provider.defaultVoice)?.id ??
              list[0]?.id ??
              ""),
        );
      })
      .catch(
        (e: unknown) =>
          alive && toast.error(e instanceof Error ? e.message : String(e)),
      );
    return () => {
      alive = false;
    };
  }, [provider.id, provider.defaultVoice, request]);

  const generate = async () => {
    setBusy(true);
    setResult(null);
    try {
      const out = await request<GenerateResult>(
        "studio.voice.generate",
        {
          slug,
          provider: provider.id,
          model,
          voice,
          text,
          style: style || undefined,
          name: `sample-${voice || provider.id}`,
        },
        180_000,
      );
      const take = out.takes.find(
        (t): t is { path: string; seconds: number | null } => "path" in t,
      );
      if (!take) throw new Error((out.takes[0] as { error: string }).error);
      setResult({ path: take.path });
      onGenerated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const supportsStyle = provider.id === "gemini" || provider.id === "openai";

  return (
    <section className="space-y-2 rounded-lg border border-border/70 p-3">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Try a voice
      </h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select
          value={provider.id}
          onValueChange={(value) => {
            const next = providers.find((p) => p.id === value)!;
            setProviderId(next.id);
            setModel(next.defaultModel);
          }}
        >
          <SelectTrigger className="w-full" aria-label="Provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1.5">
          <Select value={voice} onValueChange={setVoice}>
            <SelectTrigger className="w-full" aria-label="Voice">
              <SelectValue placeholder="Voice" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {voices.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                  {v.description ? (
                    <span className="text-muted-foreground">
                      · {v.description}
                    </span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SampleButton provider={provider.id} voice={voice} />
        </div>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="w-full" aria-label="Model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {provider.models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={2}
        className="resize-none"
        aria-label="Text to speak"
      />
      {supportsStyle ? (
        <Input
          value={style}
          onChange={(event) => setStyle(event.target.value)}
          placeholder="Style (optional): warm, upbeat launch announcer, quick pace"
        />
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {provider.styleNote}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => void generate()}
          disabled={
            busy || !text.trim() || (!voice && provider.id === "elevenlabs")
          }
        >
          {busy ? <Spinner /> : <Mic />} {busy ? "Generating…" : "Generate"}
        </Button>
        {result ? (
          <span className="truncate text-[11px] text-muted-foreground">
            Saved to {result.path}
          </span>
        ) : null}
      </div>
      {result ? (
        <MediaPlayer url={studioFileUrl(slug, result.path)} kind="audio" />
      ) : null}
    </section>
  );
}
