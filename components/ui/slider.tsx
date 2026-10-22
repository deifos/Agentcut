"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  thumbAriaLabel?: string;
  getThumbAriaValueText?: (value: number, index: number) => string;
  trackClassName?: string;
  rangeClassName?: string;
  thumbClassName?: string;
  trackStyle?: React.CSSProperties;
  rangeStyle?: React.CSSProperties;
  thumbStyle?: React.CSSProperties;
  /** Optional content rendered across the full slider track. */
  trackChildren?: React.ReactNode;
  /** Optional content rendered inside the filled range (e.g. a label that
   * gets clipped to the current fill width, like the track's own caption). */
  rangeChildren?: React.ReactNode;
};

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbAriaLabel,
  getThumbAriaValueText,
  trackClassName,
  rangeClassName,
  thumbClassName,
  trackStyle,
  rangeStyle,
  thumbStyle,
  trackChildren,
  rangeChildren,
  ...props
}: SliderProps) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        style={trackStyle}
        className={cn(
          "relative grow overflow-hidden rounded-md border border-border/60 bg-muted/80 data-[orientation=horizontal]:h-3 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-3",
          trackClassName,
        )}
      >
        {trackChildren}
        <SliderPrimitive.Range
          data-slot="slider-range"
          style={rangeStyle}
          className={cn(
            "absolute overflow-hidden bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
            rangeClassName,
          )}
        >
          {rangeChildren}
        </SliderPrimitive.Range>
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={thumbAriaLabel}
          aria-valuetext={getThumbAriaValueText?.(_values[index], index)}
          style={thumbStyle}
          className={cn(
            "block h-5 w-2.5 shrink-0 rounded-[3px] border-2 border-primary-foreground/80 bg-primary shadow-sm ring-ring/40 transition-[color,box-shadow,transform] hover:scale-105 hover:ring-2 focus-visible:ring-3 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
            thumbClassName,
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
