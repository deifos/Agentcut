"use client";

import type { ComponentProps } from "react";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type PassthroughSliderProps = Omit<
  ComponentProps<typeof Slider>,
  | "value"
  | "defaultValue"
  | "onValueChange"
  | "min"
  | "max"
  | "step"
  | "disabled"
  | "className"
  | "trackClassName"
  | "rangeClassName"
  | "thumbClassName"
  | "trackStyle"
  | "rangeStyle"
  | "thumbStyle"
  | "trackChildren"
  | "rangeChildren"
>;

interface LabeledSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  className?: string;
  /** Render the label baked into the fill. Default true — turn off for
   * compact toolbar sliders (e.g. a volume control) that don't need a
   * caption. */
  showLabel?: boolean;
  /** Render the value badge to the right of the track. Default true —
   * turn off for compact toolbar sliders with no numeric readout. */
  showValue?: boolean;
  /** Override the value shown in the fill label + badge (e.g. to add a
   * "+" sign for a signed offset, or a custom zero-state label).
   * Defaults to a step-aware formatter. */
  formatValue?: (value: number) => string;
  /** Anything else the underlying Slider root accepts — onPointerDown /
   * onPointerUp / onValueCommit / onKeyDown / thumbAriaLabel /
   * getThumbAriaValueText, etc. Lets call sites keep their scrub-preview
   * or aria customizations while sharing the same slider styling. */
  sliderProps?: PassthroughSliderProps;
}

function getStepPrecision(step: number) {
  if (!Number.isFinite(step) || step <= 0 || Number.isInteger(step)) {
    return 0;
  }

  const [, decimal = ""] = step.toString().split(".");
  return decimal.length;
}

function formatSliderValue(value: number, step: number) {
  if (!Number.isFinite(value)) return "0";

  const precision = getStepPrecision(step);
  if (precision === 0) return String(Math.round(value));

  return value.toFixed(precision).replace(/\.?0+$/, "");
}

export function LabeledSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit = "",
  disabled = false,
  className,
  showLabel = true,
  showValue = true,
  formatValue,
  sliderProps,
}: LabeledSliderProps) {
  const displayValue = formatValue
    ? formatValue(value)
    : `${formatSliderValue(value, step)}${unit}`;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Slider
        value={[value]}
        onValueChange={([nextValue]) => onChange(nextValue)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        thumbAriaLabel={label}
        getThumbAriaValueText={() => displayValue}
        {...sliderProps}
        className="flex-1"
        trackClassName="rounded-md border border-foreground/10 bg-background/30 backdrop-blur-md backdrop-saturate-150"
        trackStyle={{
          height: "1.375rem",
          boxShadow:
            "inset 0 1px 3px rgba(0,0,0,0.35), inset 0 -1px 0 rgba(255,255,255,0.08), 0 1px 1px rgba(255,255,255,0.05)",
        }}
        trackChildren={
          showLabel ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[10px] font-bold whitespace-nowrap text-foreground/90"
            >
              {label}
            </span>
          ) : undefined
        }
        rangeClassName="rounded-l-md backdrop-blur-sm"
        rangeStyle={{
          backgroundImage:
            "linear-gradient(90deg, rgb(4 145 94) 0%, rgb(5 170 111) 52%, rgb(49 196 137) 100%), linear-gradient(to bottom, rgba(255,255,255,0.4), rgba(255,255,255,0) 45%, rgba(0,0,0,0.08) 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.18)",
        }}
        rangeChildren={
          showLabel ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-2 flex items-center overflow-hidden text-[10px] font-bold whitespace-nowrap text-white drop-shadow-sm"
            >
              {label}
            </span>
          ) : undefined
        }
        thumbClassName="rounded-md border border-white/70 bg-white/60 backdrop-blur-md ring-0 hover:ring-0 focus-visible:ring-2"
        thumbStyle={{
          width: "0.1875rem",
          height: "1rem",
          boxShadow:
            "0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.7)",
        }}
      />
      {showValue ? (
        <output
          aria-label={`${label} value`}
          className="flex h-6 min-w-11 shrink-0 items-center justify-center rounded-md border border-foreground/10 bg-background/40 px-1.5 text-[9px] font-bold tabular-nums text-foreground backdrop-blur-md backdrop-saturate-150"
          style={{
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        >
          {displayValue}
        </output>
      ) : null}
    </div>
  );
}
