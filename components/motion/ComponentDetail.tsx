"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Monitor,
  RotateCcw,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { ComponentPlayer } from "@/components/motion/ComponentPlayer";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { LabeledSlider } from "@/components/ui/labeled-slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MOTION_COMPONENTS,
  resolveComponentProps,
  type PropSpec,
} from "@/motion/components";

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  return {
    copied,
    copy: async (key: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 1600);
      } catch {}
    },
  };
}

function Control({
  name,
  spec,
  value,
  onChange,
}: {
  name: string;
  spec: PropSpec;
  value: unknown;
  onChange(value: unknown): void;
}) {
  const label = (
    <label htmlFor={`prop-${name}`} className="text-[13px] font-semibold">
      {spec.label}
    </label>
  );
  switch (spec.type) {
    case "number":
      if (spec.max - spec.min > 400)
        return (
          <div className="space-y-1.5">
            {label}
            <Input
              id={`prop-${name}`}
              type="number"
              min={spec.min}
              max={spec.max}
              step={spec.step}
              value={String(value)}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) onChange(next);
              }}
            />
          </div>
        );
      return (
        <div className="space-y-1" title={spec.help}>
          <LabeledSlider
            label={spec.label}
            value={Number(value)}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            unit={spec.unit && spec.unit.length <= 3 ? spec.unit : ""}
            onChange={onChange}
          />
        </div>
      );
    case "boolean":
      return (
        <div className="flex items-center justify-between gap-3">
          {label}
          <Switch
            id={`prop-${name}`}
            checked={Boolean(value)}
            onCheckedChange={onChange}
            className="data-[state=checked]:bg-brand data-[state=unchecked]:bg-border"
          />
        </div>
      );
    case "select":
      return (
        <div className="space-y-1.5">
          {label}
          <Select value={String(value)} onValueChange={onChange}>
            <SelectTrigger id={`prop-${name}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {spec.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "color":
      return (
        <div className="space-y-1.5">
          {label}
          <div className="flex items-center gap-2">
            <ColorPicker
              value={
                /^#[0-9a-f]{6}$/i.test(String(value))
                  ? String(value)
                  : "#000000"
              }
              onChange={onChange}
              debounceMs={60}
              className="h-9 w-10 rounded-md border border-border"
            />
            <Input
              id={`prop-${name}`}
              value={String(value)}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
        </div>
      );
    case "lines":
      return (
        <div className="space-y-1.5">
          {label}
          <Textarea
            id={`prop-${name}`}
            rows={Math.max(2, (value as string[]).length)}
            value={(value as string[]).join("\n")}
            onChange={(event) => onChange(event.target.value.split("\n"))}
          />
          {spec.help ? (
            <p className="text-xs text-muted-foreground">
              {spec.help}
            </p>
          ) : null}
        </div>
      );
    default:
      return (
        <div className="space-y-1.5">
          {label}
          {spec.multiline ? (
            <Textarea
              id={`prop-${name}`}
              rows={2}
              value={String(value)}
              onChange={(event) => onChange(event.target.value)}
            />
          ) : (
            <Input
              id={`prop-${name}`}
              value={String(value)}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
          {spec.help ? (
            <p className="text-xs text-muted-foreground">
              {spec.help}
            </p>
          ) : null}
        </div>
      );
  }
}

export function ComponentDetail({ id }: { id: string }) {
  const { meta } = MOTION_COMPONENTS[id];
  const [aspect, setAspect] = useState<"wide" | "mobile">("wide");
  const [example, setExample] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const { copied, copy } = useCopy();
  const props = useMemo(
    () => ({ ...(meta.examples[example]?.props ?? {}), ...overrides }),
    [meta, example, overrides],
  );
  const values = resolveComponentProps(id, props);
  // Only what differs from the defaults goes into the snippet.
  const changed = Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) =>
        JSON.stringify(value) !== JSON.stringify(meta.props[key].default),
    ),
  );
  const clip = {
    id: `${meta.id}-1`,
    from: 0,
    duration: meta.durationInFrames,
    component: meta.id,
    props: changed,
  };
  const prompt = `Use the Agentcut "${meta.name}" component (${meta.id})${Object.keys(changed).length ? ` with ${JSON.stringify(changed)}` : ""}.`;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <Link
          href="/components"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All components
        </Link>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-brand">
            {meta.category}
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight md:text-6xl">
            {meta.name}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            {meta.description}
          </p>
        </div>
        {/* Same 16:9 stage for both: 9:16 sits centered inside it, so nothing below moves. */}
        <div className="aspect-video overflow-hidden rounded-2xl border border-border bg-[#0b0d10] shadow-xl">
          <div
            className={cn(
              "mx-auto h-full",
              aspect === "mobile" ? "aspect-[9/16]" : "w-full",
            )}
          >
            <ComponentPlayer
              key={aspect}
              id={id}
              props={props}
              aspect={aspect}
              controls
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            {(["wide", "mobile"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAspect(value)}
                aria-pressed={aspect === value}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold",
                  aspect === value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground",
                )}
              >
                {value === "wide" ? (
                  <Monitor className="size-4" />
                ) : (
                  <Smartphone className="size-4" />
                )}
                {value === "wide" ? "16:9" : "9:16"}
              </button>
            ))}
          </div>
          {meta.examples.map((ex, index) => (
            <button
              key={ex.name}
              type="button"
              onClick={() => {
                setExample(index);
                setOverrides({});
              }}
              className={cn(
                "h-9 rounded-full border px-4 text-sm font-semibold",
                index === example
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {ex.name}
            </button>
          ))}
        </div>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            When to use it
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed">{meta.useWhen}</p>
        </section>
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Use it in the studio
            </h2>
          </div>
          <p className="text-[15px] text-muted-foreground">
            Ask the agent in the studio, or add it from Assets → Motion and edit
            these props in the inspector.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void copy("prompt", prompt)}
            >
              {copied === "prompt" ? <Check /> : <Copy />} Copy prompt for
              the agent
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void copy("clip", JSON.stringify(clip, null, 2))}
            >
              {copied === "clip" ? <Check /> : <Copy />} Copy clip JSON
            </Button>
            <Button asChild>
              <Link href="/studio">Open the studio</Link>
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-[#0b0d10] p-4 font-mono text-[12px] leading-relaxed text-emerald-200">
            {JSON.stringify(clip, null, 2)}
          </pre>
        </section>
      </div>
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="flex items-center">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Props
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            disabled={Object.keys(overrides).length === 0}
            onClick={() => setOverrides({})}
          >
            <RotateCcw /> Reset
          </Button>
        </div>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          {Object.entries(meta.props).map(([key, spec]) => (
            <Control
              key={`${example}-${key}`}
              name={key}
              spec={spec}
              value={values[key]}
              onChange={(value) =>
                setOverrides((current) => ({ ...current, [key]: value }))
              }
            />
          ))}
        </div>
      </aside>
    </div>
  );
}
