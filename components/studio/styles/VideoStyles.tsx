"use client";

// Video styles: presets for whole videos that aren't a talking head (music and lyric videos, …).
// A preset is a folder in the workspace library, library/presets/<id>/: PROMPT.md (the recipe, with
// [blanks]), preset.json (name, description, the blanks as form fields), preview.mp4 + poster.jpg, and
// the scenes and assets the recipe copies. Picking one fills the blanks from the form and hands the
// recipe to the agent; "Save this video's style" asks the agent to make a new preset from the project.
import { useEffect, useState } from "react";
import { Bookmark, Clapperboard, Film, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SpeechTextarea } from "@/components/studio/SpeakButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgentName } from "@/components/studio/StudioAgent";
import { cn } from "@/lib/utils";
import { STUDIO_LIBRARY_BASE, studioFileUrl } from "@/lib/studio/bundle";
import { fileName } from "@/lib/studio/format";
import type { AssetEntry } from "@/lib/studio/types";

interface PresetField {
  id: string;
  label: string;
  type: "text" | "longtext" | "audio" | "images";
  required?: boolean;
  placeholder?: string;
  help?: string;
}

interface VideoPreset {
  id: string;
  name: string;
  description: string;
  kind: string;
  preview: string | null;
  poster: string | null;
  fields: PresetField[];
}

const DEFAULT_FIELDS: PresetField[] = [
  { id: "song", label: "Song or voice", type: "audio" },
  { id: "photos", label: "Photos", type: "images" },
  { id: "about", label: "What it's about", type: "longtext" },
];

const libraryUrl = (path: string) => `${STUDIO_LIBRARY_BASE}/${path.split("/").map(encodeURIComponent).join("/")}`;

/** Presets found in the library listing (library:presets/<id>/PROMPT.md marks one). */
function presetIds(library: AssetEntry[]) {
  const ids = new Set<string>();
  for (const entry of library) {
    const match = /^library:presets\/([^/]+)\/PROMPT\.md$/i.exec(entry.path);
    if (match) ids.add(match[1]);
  }
  return [...ids].sort();
}

function useVideoPresets(library: AssetEntry[]) {
  const ids = presetIds(library);
  const key = ids.join("|");
  const has = (id: string, file: string) => library.some((e) => e.path === `library:presets/${id}/${file}`);
  const [presets, setPresets] = useState<VideoPreset[] | null>(null);
  // Read each preset's preset.json from the helper (an external source: fetch on mount / when the list changes).
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      ids.map(async (id): Promise<VideoPreset> => {
        const base: VideoPreset = {
          id,
          name: id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          description: "",
          kind: "Video",
          preview: has(id, "preview.mp4") ? libraryUrl(`presets/${id}/preview.mp4`) : null,
          poster: has(id, "poster.jpg") ? libraryUrl(`presets/${id}/poster.jpg`) : null,
          fields: DEFAULT_FIELDS,
        };
        if (!has(id, "preset.json")) return base;
        try {
          const response = await fetch(libraryUrl(`presets/${id}/preset.json`), { cache: "no-store" });
          const meta = (await response.json()) as Partial<VideoPreset> & { preview?: string; poster?: string };
          return {
            ...base,
            name: meta.name ?? base.name,
            description: meta.description ?? "",
            kind: meta.kind ?? base.kind,
            preview: meta.preview && has(id, meta.preview) ? libraryUrl(`presets/${id}/${meta.preview}`) : base.preview,
            poster: meta.poster && has(id, meta.poster) ? libraryUrl(`presets/${id}/${meta.poster}`) : base.poster,
            fields: Array.isArray(meta.fields) && meta.fields.length ? meta.fields : DEFAULT_FIELDS,
          };
        } catch {
          return base;
        }
      }),
    ).then((list) => {
      if (!cancelled) setPresets(list);
    });
    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return presets;
}

function PresetCard({ preset, active, onSelect }: { preset: VideoPreset; active: boolean; onSelect(): void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-muted/30 text-left transition",
        active ? "border-foreground ring-2 ring-foreground/70" : "border-border/60 hover:-translate-y-0.5 hover:border-foreground/40",
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {hover && preset.preview ? (
          <video src={preset.preview} poster={preset.poster ?? undefined} muted loop autoPlay playsInline className="size-full object-cover" />
        ) : preset.poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local helper file
          <img src={preset.poster} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Film className="size-6" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="truncate text-[13px] font-bold">{preset.name}</span>
        <span className="ml-auto shrink-0 rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">{preset.kind}</span>
      </div>
    </button>
  );
}

export function VideoStyles({
  slug,
  library,
  assets,
  chatDisabled,
  readOnly,
  onSend,
}: {
  slug: string;
  library: AssetEntry[];
  /** The open project's files (songs and photos to pick from). */
  assets: AssetEntry[];
  chatDisabled: boolean;
  readOnly: boolean;
  onSend(text: string): void;
}) {
  const agentName = useAgentName();
  const presets = useVideoPresets(library);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [target, setTarget] = useState<"new" | "this">("new");
  const [saveName, setSaveName] = useState("");
  const [dictatingFields, setDictatingFields] = useState<string[]>([]);
  const preset = presets?.find((p) => p.id === selectedId) ?? presets?.[0] ?? null;

  const audio = [...assets, ...library].filter((a) => a.kind === "audio" && !a.path.startsWith("library:presets/"));
  const images = assets.filter((a) => a.kind === "image");
  const value = (id: string) => values[id] ?? "";
  const set = (id: string, next: string | string[]) => setValues((v) => ({ ...v, [id]: next }));
  const missing = preset?.fields.filter((f) => f.required && !(Array.isArray(values[f.id]) ? values[f.id].length : String(values[f.id] ?? "").trim())) ?? [];

  const make = () => {
    if (!preset || dictatingFields.length) return;
    const lines = preset.fields.map((field) => {
      const v = values[field.id];
      const text = Array.isArray(v) ? v.join(", ") : String(v ?? "").trim();
      const fallback = field.id === "lyrics" ? "transcribe them" : field.type === "images" ? "none" : "(not given; decide from the rest)";
      return `- ${field.label}: ${text || fallback}`;
    });
    onSend(
      [
        `Make a video with the "${preset.name}" video style: read library/presets/${preset.id}/PROMPT.md and follow it, with these values for its blanks:`,
        ...lines,
        `(assets/… files are in the "${slug}" project; library:… files are in the library.)`,
        target === "new" ? "Make it as a new project (copy the files it needs into it)." : "Make it in this project, replacing its timeline.",
      ].join("\n"),
    );
  };

  const savePreset = () => {
    const name = saveName.trim() || "my style";
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-style";
    // Self-contained, so it works even where the skill's references/presets.md isn't there yet.
    onSend(
      [
        `Save this video's style as a reusable video style preset named "${name}" in library/presets/${id}/ (see references/presets.md if you have it):`,
        "- scenes/ and assets/: the scene files and the assets the look needs (not the song or personal photos), made generic (no names or lyrics baked in; example content goes in *.example.* files).",
        "- PROMPT.md: the recipe (what to copy, fonts, every rule of the look, timing, sound, workflow), with what changes per video in [brackets].",
        '- preset.json: { "name", "description" (one sentence), "kind" (e.g. "Music video"), "preview": "preview.mp4", "poster": "poster.jpg", "fields": [{ "id", "label", "type": "text" | "longtext" | "audio" | "images", "required"?, "placeholder"?, "help"? }] } with one field per [bracket].',
        "- preview.mp4 (~10 s of the latest render, 960×540, H.264, no audio, a stretch without personal photos) and poster.jpg (one strong frame).",
        "Then tell me it's in the Styles tab under Video styles.",
      ].join("\n"),
    );
    setSaveName("");
  };

  return (
    <div className="flex min-h-0 flex-1">
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid grid-cols-2 gap-3 p-4">
          {presets === null ? (
            <p className="col-span-2 text-[12px] text-muted-foreground">Loading video styles…</p>
          ) : presets.length === 0 ? (
            <div className="col-span-2 rounded-xl border border-dashed border-border/70 p-6 text-center text-[12px] text-muted-foreground">
              No video styles yet. Make a video you like, then save its style below.
            </div>
          ) : (
            presets.map((p) => <PresetCard key={p.id} preset={p} active={p.id === preset?.id} onSelect={() => setSelectedId(p.id)} />)
          )}
        </div>
      </ScrollArea>

      <div className="flex w-[380px] shrink-0 flex-col border-l border-border/60">
        <ScrollArea className="min-h-0 flex-1">
          {preset ? (
            <div className="space-y-3 p-4">
              <div className="overflow-hidden rounded-xl border border-border/60 bg-black">
                {preset.preview ? (
                  <video key={preset.id} src={preset.preview} poster={preset.poster ?? undefined} muted loop autoPlay playsInline className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center text-muted-foreground">
                    <Clapperboard className="size-6" />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[17px] font-bold">{preset.name}</h3>
                  <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">{preset.kind}</span>
                </div>
                {preset.description ? <p className="text-[12px] leading-snug text-muted-foreground">{preset.description}</p> : null}
              </div>
              {preset.fields.map((field) => (
                <div key={field.id} className="space-y-1">
                  <Label className="text-[11px] font-semibold">
                    {field.label}
                    {field.required ? <span className="text-muted-foreground"> *</span> : null}
                  </Label>
                  {field.type === "longtext" ? (
                    <SpeechTextarea
                      value={String(value(field.id))}
                      onValueChange={(next) => set(field.id, next)}
                      disabled={readOnly || chatDisabled}
                      onDictatingChange={(active) => setDictatingFields((fields) => {
                        const rest = fields.filter((id) => id !== field.id);
                        return active ? [...rest, field.id] : rest;
                      })}
                      placeholder={field.placeholder}
                      className="min-h-16 text-[12px]"
                    />
                  ) : field.type === "audio" ? (
<Select value={String(value(field.id)) || undefined} onValueChange={(next) => set(field.id, next)}>
                      <SelectTrigger size="sm" className="w-full text-[12px]">
                        <SelectValue placeholder={audio.length ? "Pick an audio file…" : "No audio files yet: upload one in Assets"} />
                      </SelectTrigger>
                      <SelectContent>
                        {audio.map((a) => (
                          <SelectItem key={a.path} value={a.path} className="text-[12px]">
                            {fileName(a.path)}
                            {a.path.startsWith("library:") ? <span className="text-muted-foreground"> · library</span> : null}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === "images" ? (
                    images.length ? (
                      <div className="grid grid-cols-5 gap-1">
                        {images.slice(0, 20).map((img) => {
                          const picked = (values[field.id] as string[] | undefined) ?? [];
                          const on = picked.includes(img.path);
                          return (
                            <label key={img.path} title={fileName(img.path)} className={cn("relative cursor-pointer overflow-hidden rounded-md border", on ? "border-foreground" : "border-border/60")}>
                              {/* eslint-disable-next-line @next/next/no-img-element -- a local helper file */}
                              <img src={studioFileUrl(slug, img.path)} alt="" loading="lazy" className="block aspect-square w-full bg-muted object-cover" />
                              <Checkbox
                                checked={on}
                                onCheckedChange={(checked) => set(field.id, checked ? [...picked, img.path] : picked.filter((p) => p !== img.path))}
                                className="absolute right-0.5 bottom-0.5 size-3.5 bg-background"
                              />
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">No images in this project. Upload photos in Assets, or leave empty.</p>
                    )
                  ) : (
                    <Input value={String(value(field.id))} onChange={(e) => set(field.id, e.target.value)} placeholder={field.placeholder} className="h-8 text-[12px]" />
                  )}
                  {field.help ? <p className="text-[10px] text-muted-foreground">{field.help}</p> : null}
                </div>
              ))}
              <div className="flex rounded-md border border-border/70 p-0.5 text-[11px]">
                {(["new", "this"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTarget(t)}
                    className={cn("flex-1 rounded px-2 py-1", target === t ? "bg-muted font-semibold" : "text-muted-foreground hover:text-foreground")}
                  >
                    {t === "new" ? "New project" : "This project"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </ScrollArea>
        <div className="space-y-3 border-t border-border/60 p-4">
          <Button type="button" disabled={!preset || readOnly || chatDisabled || missing.length > 0 || dictatingFields.length > 0} onClick={make} className="h-9 w-full gap-1.5">
            <Sparkles className="size-4" />
            {missing.length ? `Add the ${missing[0].label.toLowerCase()} first` : `Make it with ${agentName}`}
          </Button>
          <div className="flex items-center gap-1.5">
            <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name this project's style…" className="h-8 text-[12px]" />
            <Button type="button" variant="outline" size="sm" disabled={readOnly || chatDisabled} onClick={savePreset} className="h-8 shrink-0 gap-1.5 text-[12px]" title={`Ask ${agentName} to save this video's style as a preset`}>
              <Bookmark className="size-3.5" />
              Save style
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
