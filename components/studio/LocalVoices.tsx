"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Mic } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSamplePlayer } from "./VoiceSamples";
import { KOKORO_VOICES } from "@/packages/agentcut/src/studio/voice/kokoro-catalog";
import { MING_VOICES } from "@/packages/agentcut/src/studio/voice/ming-catalog";
import type { StudioBridge } from "@/lib/studio/bridge";

type Voice = {
  id: string;
  name: string;
  language?: string;
  accent?: string;
  gender?: string;
  previewUrl?: string;
  fallbackPreviewUrl?: string;
};
type Provider = {
  id: string;
  name: string;
  configured: boolean;
  local?: boolean;
  voices: readonly Voice[];
};
const INCLUDED_PROVIDERS: Provider[] = [
  {
    id: "kokoro",
    name: "Kokoro (local)",
    configured: false,
    local: true,
    voices: KOKORO_VOICES,
  },
  {
    id: "ming",
    name: "Ming 0.5B (local)",
    configured: false,
    local: true,
    voices: MING_VOICES,
  },
];
type Selection = { provider: string; voice: Voice; style: string };

export function LocalVoices({
  getBridge,
  slug,
  readOnly,
  onGenerated,
}: {
  getBridge(): StudioBridge | null;
  slug: string;
  readOnly: boolean;
  onGenerated(): void;
}) {
  const [providers, setProviders] = useState<Provider[]>(INCLUDED_PROVIDERS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Selection | null>(null);
  const [text, setText] = useState("");
  const [creating, setCreating] = useState(false);
  const [device, setDevice] = useState<"cpu" | "cuda">("cpu");
  const [setupOpen, setSetupOpen] = useState(false);
  const [directory, setDirectory] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState("");
  const mounted = useRef(true);
  const { playing, toggle } = useSamplePlayer();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    const bridge = getBridge();
    async function load() {
      if (!bridge)
        throw new Error(
          "Samples are ready. Connect the studio helper to create speech.",
        );
      const settings = await bridge.request<{
        providers: Provider[];
        mingDirectory?: string;
        mingDevice?: "cpu" | "cuda";
        mingInstalling?: boolean;
      }>("studio.voice.settings");
      const result = INCLUDED_PROVIDERS.map((p) => ({
        ...p,
        configured:
          settings.providers.find((item) => item.id === p.id)?.configured ??
          false,
      }));
      if (alive) {
        setProviders(result);
        setDirectory((current) => current || settings.mingDirectory || "");
        setInstalling(Boolean(settings.mingInstalling));
        if (
          settings.mingDevice &&
          result.find((p) => p.id === "ming")?.configured
        )
          setDevice(settings.mingDevice);
      }
    }
    void load()
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [getBridge, retry]);

  function refresh() {
    setLoading(true);
    setError("");
    setRetry((n) => n + 1);
  }
  async function installMing() {
    const bridge = getBridge();
    if (!bridge || !directory.trim() || installing) return;
    setInstalling(true);
    setInstallError("");
    try {
      await bridge.request(
        "studio.voice.installMing",
        { directory: directory.trim(), device, confirm: true },
        7_200_000,
      );
      setSetupOpen(false);
      refresh();
      toast.success("Ming is ready to create speech.");
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(false);
    }
  }
  async function preview(
    provider: string,
    voice: Voice,
    style: string,
    key: string,
  ) {
    if (voice.previewUrl) {
      toggle(voice.previewUrl, voice.fallbackPreviewUrl);
      return;
    }
    if (samples[key]) {
      toggle(samples[key]);
      return;
    }
    if (busy) return;
    setBusy(key);
    try {
      const bridge = getBridge();
      if (!bridge) throw new Error("Connect the studio helper first.");
      const result = await bridge.request<{ url: string }>(
        "studio.voice.preview",
        { provider, voice: voice.id, style },
        1800_000,
      );
      if (!mounted.current) return;
      setSamples((previous) => ({ ...previous, [key]: result.url }));
      toggle(result.url);
    } catch (e) {
      if (mounted.current)
        toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) setBusy(null);
    }
  }
  async function create() {
    if (!selected || !text.trim() || creating) return;
    setCreating(true);
    try {
      const bridge = getBridge();
      if (!bridge) throw new Error("Connect the studio helper first.");
      const result = await bridge.request<{
        takes: ({ path: string } | { error: string })[];
      }>(
        "studio.voice.generate",
        {
          slug,
          provider: selected.provider,
          voice: selected.voice.id,
          style: selected.style || undefined,
          text: text.trim(),
          name: `voice-${selected.voice.id}`,
        },
        1800_000,
      );
      if (!result.takes.some((take) => "path" in take))
        throw new Error("The voice-over could not be created. Try again.");
      onGenerated();
      setSelected(null);
      setText("");
      toast.success("Voice-over saved to project audio.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }
  return (
    <div className="space-y-3" aria-label="Local voices">
      <p className="text-xs text-muted-foreground">
        Preset samples are included. Listen without installing a model. Creating
        speech or a custom voice preview needs the local model.
      </p>
      <Input
        aria-label="Search local voices"
        placeholder="Search voices or accents"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-8"
      />
      {loading ? (
        <div role="status" className="flex gap-2 text-xs">
          <Spinner />
          Loading voices…
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="space-y-2 text-xs">
          <p>{error}</p>
          <Button size="sm" variant="outline" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : null}
      {!loading &&
      !error &&
      !providers.some((p) =>
        p.voices.some((v) =>
          `${p.name} ${v.name} ${v.language ?? ""} ${v.accent ?? ""} ${v.gender ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
      ) ? (
        <p className="text-xs text-muted-foreground">No matching voices.</p>
      ) : null}
      {providers.map((p) => (
        <section key={p.id} className="space-y-2">
          <h3 className="text-xs font-semibold">{p.name}</h3>
          {!p.configured ? (
            <p className="text-xs text-muted-foreground">
              {p.id === "ming"
                ? "To create speech, install Ming from Voice-over settings. Choose CPU or a compatible NVIDIA GPU."
                : "Connect the studio helper to create speech with Kokoro."}{" "}
              <button className="underline" onClick={refresh}>
                Refresh
              </button>
              {p.id === "ming" ? (
                <Button
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  onClick={() => setSetupOpen(true)}
                >
                  Set up Ming
                </Button>
              ) : null}
            </p>
          ) : null}
          {p.voices
            .filter((v) =>
              `${p.name} ${v.name} ${v.language ?? ""} ${v.accent ?? ""} ${v.gender ?? ""}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((v) => {
              const described = v.id === "freeform" || v.id === "voice_design";
              const id = `${p.id}:${v.id}`;
              const style = described ? (descriptions[id]?.trim() ?? "") : "";
              const key = JSON.stringify([id, style]);
              const isPlaying = Boolean(
                (v.previewUrl || samples[key]) &&
                playing === (v.previewUrl || samples[key]),
              );
              return (
                <div
                  key={id}
                  className="space-y-2 rounded-lg border bg-background/50 p-2.5"
                >
                  <div>
                    <p className="text-xs font-semibold">{v.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[v.language, v.accent, v.gender]
                        .filter(Boolean)
                        .join(" · ") || "Describe the voice and delivery"}
                    </p>
                  </div>
                  {described ? (
                    <Textarea
                      aria-label={`${v.name} description`}
                      placeholder="A warm, calm narrator with a British accent"
                      maxLength={1000}
                      rows={2}
                      value={descriptions[id] ?? ""}
                      onChange={(e) =>
                        setDescriptions((old) => ({
                          ...old,
                          [id]: e.target.value,
                        }))
                      }
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        (!v.previewUrl && !p.configured) ||
                        (described && !style) ||
                        (busy !== null && busy !== key)
                      }
                      onClick={() => void preview(p.id, v, style, key)}
                      aria-label={`${isPlaying ? "Stop" : "Play"} ${v.name} (${p.id}) sample`}
                    >
                      {busy === key ? (
                        <Spinner />
                      ) : isPlaying ? (
                        <Pause />
                      ) : (
                        <Play />
                      )}
                      {busy === key
                        ? "Making sample…"
                        : isPlaying
                          ? "Stop"
                          : "Play sample"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={
                        readOnly || !p.configured || (described && !style)
                      }
                      onClick={() => {
                        if (playing) toggle(playing);
                        setSelected({ provider: p.id, voice: v, style });
                      }}
                      aria-label={`Use ${v.name} (${p.id}) voice`}
                    >
                      <Mic />
                      Use voice
                    </Button>
                  </div>
                </div>
              );
            })}
        </section>
      ))}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install Ming for speech creation</DialogTitle>
            <DialogDescription>
              Listening to the included samples needs no installation. Download
              Ming only to create speech on this computer.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-1 text-sm">
            Run Ming on
            <select
              aria-label="Ming processing device"
              className="w-full rounded-md border bg-background p-2"
              value={device}
              onChange={(e) => setDevice(e.target.value as "cpu" | "cuda")}
              disabled={installing}
            >
              <option value="cpu">CPU — slower, no GPU needed</option>
              <option value="cuda">NVIDIA GPU — faster</option>
            </select>
          </label>
          {device === "cpu" ? (
            <p className="rounded-md border p-3 text-sm">
              CPU mode needs about 9 GB of free memory. We recommend at least 16
              GB of system RAM. In our Ryzen 5 test, a few seconds of speech
              took about half a minute to a minute. Long scripts can take
              several minutes.
            </p>
          ) : null}
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              Model download: about 3 GB, plus several GB for the speech
              runtime.
            </li>
            <li>
              Recommended free disk space: 20 GB during setup. The installed
              model and runtime use up to about 8 GB, depending on the selected
              mode; download caches use extra space.
            </li>
            <li>
              Requires Windows or Linux on x64 and Python 3.10–3.12. NVIDIA GPU
              mode also needs a compatible GPU and driver.
            </li>
          </ul>
          <label className="space-y-1 text-sm">
            Download and installation folder
            <Input
              aria-label="Ming installation folder"
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
              disabled={installing}
              placeholder="Full folder path on this computer"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Model files, runtime, downloads, and caches will go in this folder.
            Choose a drive with enough free space.
          </p>
          {installError ? (
            <p role="alert" className="text-sm text-destructive">
              {installError}
            </p>
          ) : null}
          {installing ? (
            <p role="status" className="text-sm">
              Installing Ming. Keep the helper running. This can take several
              minutes. If you close this window, refresh the voice list later.
            </p>
          ) : null}
          <Button
            disabled={installing || !directory.trim() || !getBridge()}
            onClick={() => void installMing()}
          >
            {installing ? <Spinner /> : null}
            {installing ? "Installing…" : "Download and install"}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !creating) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create voice-over</DialogTitle>
            <DialogDescription>
              {selected?.voice.name} ·{" "}
              {selected?.provider === "ming" ? "Ming" : "Kokoro"}. The audio
              will be saved in this project.
            </DialogDescription>
          </DialogHeader>
          {selected?.style ? (
            <p className="text-xs text-muted-foreground">{selected.style}</p>
          ) : null}
          <Textarea
            aria-label="Voice-over script"
            placeholder="Write the words to speak…"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={creating}
          />
          <Button
            onClick={() => void create()}
            disabled={creating || !text.trim() || readOnly}
          >
            {creating ? <Spinner /> : <Mic />}
            {creating ? "Creating voice-over…" : "Create voice-over"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
