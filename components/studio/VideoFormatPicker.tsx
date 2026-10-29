"use client";

import { useState } from "react";
import { Monitor, Smartphone, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudioProject } from "@/lib/studio/types";
import { toast } from "sonner";

const FORMATS = [
  { id: "landscape", label: "Landscape", ratio: "16:9", width: 1920, height: 1080, icon: Monitor },
  { id: "portrait", label: "Portrait", ratio: "9:16", width: 1080, height: 1920, icon: Smartphone },
  { id: "square", label: "Square", ratio: "1:1", width: 1080, height: 1080, icon: Square },
  { id: "portrait-4-5", label: "Portrait", ratio: "4:5", width: 1080, height: 1350, icon: Smartphone },
];
const sameRatio = (a: { width: number; height: number }, b: { width: number; height: number }) => Math.abs(a.width / a.height - b.width / b.height) < 0.001;

/** Reuse a matching project format, preserving its resolution and per-format edits. */
export function VideoFormatPicker({ project, variant, disabled, onSave, onChange }: {
  project: StudioProject;
  variant: string;
  disabled: boolean;
  onSave(project: StudioProject): Promise<void>;
  onChange(variant: string): void;
}) {
  const [saving, setSaving] = useState(false);
  const variants = Object.entries(project.variants);
  const current = project.variants[variant];
  const choose = async (format: typeof FORMATS[number]) => {
    const existing = variants.find(([key, size]) => key === variant && sameRatio(size, format)) ?? variants.find(([, size]) => sameRatio(size, format));
    if (existing) { onChange(existing[0]); return; }
    let id = format.id;
    for (let n = 2; project.variants[id]; n++) id = `${format.id}-${n}`;
    setSaving(true);
    try {
      await onSave({ ...project, variants: { ...project.variants, [id]: { width: format.width, height: format.height } } });
      onChange(id);
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  };
  return <div className="flex shrink-0 flex-wrap items-center justify-center gap-1 pb-2" role="group" aria-label="Video format">
    {FORMATS.map((format) => <Button key={format.id} variant={current && sameRatio(current, format) ? "secondary" : "ghost"} size="sm" aria-pressed={Boolean(current && sameRatio(current, format))} disabled={disabled || saving} onClick={() => void choose(format)} title={`${format.label} ${format.ratio}`}><format.icon />{format.ratio}<span className="hidden sm:inline">{format.label}</span></Button>)}
    {variants.filter(([, size]) => !FORMATS.some((format) => sameRatio(size, format))).map(([key, size]) => <Button key={key} variant={variant === key ? "secondary" : "ghost"} size="sm" aria-pressed={variant === key} disabled={disabled || saving} onClick={() => onChange(key)}>{key} {size.width}×{size.height}</Button>)}
    {saving ? <Loader2 className="size-4 animate-spin" aria-label="Saving video format" /> : null}
  </div>;
}
