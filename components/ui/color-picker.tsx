"use client";

import { SharedColorPicker } from "@/components/ui/shared-color-picker";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
  disabled?: boolean;
  mode?: "popover" | "native";
  onOpenChange?: (open: boolean) => void;
  /** How long the picker waits after the last drag tick before calling onChange. */
  debounceMs?: number;
}

/** Simple debounced color input with reusable saved presets. */
export function ColorPicker({
  value,
  onChange,
  className,
  disabled,
  mode,
  onOpenChange,
  debounceMs = 50,
}: ColorPickerProps) {
  return (
    <SharedColorPicker
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className ?? "w-full h-8 border-2 border-border"}
      debounceMs={debounceMs}
      mode={mode}
      onOpenChange={onOpenChange}
    />
  );
}
