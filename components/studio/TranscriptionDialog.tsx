"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StudioBridge } from "@/lib/studio/bridge";

interface Provider {
  id: string;
  name: string;
  cloud: boolean;
  configured: boolean;
  source: string | null;
  keyUrl?: string;
  keyHint?: string;
  models: string[];
  capabilities: {
    wordTimings: boolean;
    speakers: boolean;
    languageDetection: boolean;
    fillers: string;
  };
}
interface Settings {
  defaultProvider: string;
  providers: Provider[];
  jobs?: { id: string; provider: string; stage: string; active: boolean }[];
}

export function TranscriptionDialog({
  open,
  onOpenChange,
  getBridge,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  getBridge(): StudioBridge | null;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [providerId, setProviderId] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useCallback(
    async <T,>(method: string, params = {}) => {
      const bridge = getBridge();
      if (!bridge) throw new Error("Connect the studio helper first.");
      return bridge.request<T>(method, params);
    },
    [getBridge],
  );
  const refresh = useCallback(async () => {
    const result = await request<Settings>("studio.transcription.settings");
    setSettings(result);
    setError(null);
  }, [request]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = () => {
      void request<Settings>("studio.transcription.settings")
        .then((s) => {
          if (active) {
            setSettings(s);
            setError(null);
          }
        })
        .catch(() => {
          if (active)
            setError(
              "Transcription settings are unavailable. Update and reconnect the local helper.",
            );
        });
    };
    load();
    const off = getBridge()?.on("studio.transcription", load);
    return () => {
      active = false;
      off?.();
    };
  }, [open, getBridge, request]);
  const run = async (method: string, params: Record<string, unknown>) => {
    setBusy(true);
    try {
      await request(method, params);
      await refresh();
      setKey("");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "The setting could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const provider =
    settings?.providers.find((p) => p.id === providerId) ??
    settings?.providers.find((p) => p.cloud);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setKey("");
        onOpenChange(value);
      }}
    >
      <DialogContent className="flex max-h-[88dvh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Transcription</DialogTitle>
          <DialogDescription>
            Choose how the agent transcribes project audio. You can ask it to
            use another provider for one request.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="max-h-[65dvh] pr-3"
        >
          <div className="flex flex-col gap-5 py-1">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : !settings ? (
              <p role="status">Loading settings…</p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="transcription-default">
                    Preferred provider
                  </Label>
                  <Select
                    value={settings.defaultProvider}
                    disabled={busy}
                    onValueChange={(provider) =>
                      void run("studio.transcription.setDefault", { provider })
                    }
                  >
                    <SelectTrigger id="transcription-default">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settings.providers.map((p) => (
                        <SelectItem
                          key={p.id}
                          value={p.id}
                          disabled={!p.configured}
                        >
                          {p.name}
                          {p.cloud ? " · cloud" : " · local"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Adding a key does not change this preference. A failed
                    request does not switch providers.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="transcription-key-provider">
                    Provider key
                  </Label>
                  <Select
                    value={provider?.id ?? ""}
                    onValueChange={(id) => {
                      setProviderId(id);
                      setKey("");
                    }}
                  >
                    <SelectTrigger id="transcription-key-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settings.providers
                        .filter((p) => p.cloud)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {provider ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {provider.configured
                          ? `Key available from ${provider.source}. The saved key is never shown.`
                          : "No key is saved."}
                      </p>
                      <Input
                        type="password"
                        aria-label={`${provider.name} API key`}
                        autoComplete="off"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="Paste a new key"
                      />
                      <div className="flex gap-2">
                        <Button
                          disabled={busy || !key.trim()}
                          onClick={() =>
                            void run("studio.transcription.saveKey", {
                              provider: provider.id,
                              key,
                            })
                          }
                        >
                          Save key
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy || provider.source !== "saved"}
                          onClick={() =>
                            void run("studio.transcription.removeKey", {
                              provider: provider.id,
                            })
                          }
                        >
                          Remove saved key
                        </Button>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {provider.keyHint} Keys stay in the local helper. They
                        are not included in agent prompts. Saving a key does not
                        send audio or make a paid test call.
                      </p>
                      {provider.keyUrl ? (
                        <a
                          href={provider.keyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline"
                        >
                          Open {provider.name} key settings
                        </a>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <section
                  className="flex flex-col gap-3"
                  aria-label="Transcription capabilities"
                >
                  {settings.providers.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border p-3 text-xs leading-relaxed"
                    >
                      <p className="font-semibold">{p.name}</p>
                      <p>
                        {p.cloud
                          ? "Audio is uploaded to this provider. Provider charges apply."
                          : "Audio stays on this computer. Model files download when needed."}
                      </p>
                      <p>
                        {p.capabilities.speakers
                          ? "Speaker labels available. "
                          : "No speaker labels. "}
                        {p.capabilities.languageDetection
                          ? "Language detection available."
                          : "Choose the language in the request."}
                      </p>
                      <p>{p.capabilities.fillers}</p>
                    </div>
                  ))}
                </section>
                {settings.jobs
                  ?.filter((j) => j.active)
                  .map((j) => (
                    <div
                      key={j.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 text-xs"
                    >
                      <p role="status">
                        {j.provider}: {j.stage.replaceAll("_", " ")}
                        <br />
                        Job: {j.id}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void run("studio.transcription.cancel", { job: j.id })
                        }
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
