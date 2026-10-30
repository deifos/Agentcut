"use client";

import { TooltipHint } from "@/components/ui/tooltip";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { BookmarkPlus, Check, X } from "lucide-react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { cn } from "@/lib/utils";
import {
  loadSavedColors,
  removeSavedColor,
  saveSavedColor,
  subscribeSavedColors,
} from "@/lib/saved-colors";

interface SharedColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  debounceMs?: number;
  mode?: "popover" | "native";
  children?: ReactNode;
  onTriggerClick?: () => void;
  onOpenChange?: (open: boolean) => void;
}

const FALLBACK_HEX = "#ffffff";
const POPOVER_WIDTH = 248;
const POPOVER_HEIGHT = 356;

function normalizeHexColor(value: string | null | undefined): string {
  if (!value) return FALLBACK_HEX;

  const trimmed = value.trim();
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;

  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const expanded = hex
      .split("")
      .map((char) => char + char)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `#${hex.toLowerCase()}`;
  }

  return FALLBACK_HEX;
}

export function SharedColorPicker({
  value,
  onChange,
  className,
  disabled,
  debounceMs = 50,
  mode = "popover",
  children,
  onTriggerClick,
  onOpenChange,
}: SharedColorPickerProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const [isMounted, setIsMounted] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [savedColors, setSavedColors] = useState<string[]>(() =>
    loadSavedColors(),
  );
  const normalizedValue = normalizeHexColor(value);
  const [draftColor, setDraftColor] = useState(normalizedValue);
  const draftColorRef = useRef(normalizedValue);
  const pendingCommitRef = useRef<string | null>(null);

  const updateOpen = useCallback(
    (nextOpen: boolean | ((open: boolean) => boolean)) => {
      const currentOpen = isOpenRef.current;
      const resolvedOpen =
        typeof nextOpen === "function" ? nextOpen(currentOpen) : nextOpen;
      if (resolvedOpen === currentOpen) return;

      isOpenRef.current = resolvedOpen;
      setIsOpen(resolvedOpen);
      onOpenChange?.(resolvedOpen);
    },
    [onOpenChange],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(
    () => subscribeSavedColors(() => setSavedColors(loadSavedColors())),
    [],
  );

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (pendingCommitRef.current) return;
    if (draftColorRef.current === normalizedValue) return;

    draftColorRef.current = normalizedValue;
    setDraftColor(normalizedValue);
  }, [normalizedValue]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      updateOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        updateOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, updateOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const updatePopoverPosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 12;

      const left = Math.max(
        margin,
        Math.min(
          viewportWidth - POPOVER_WIDTH - margin,
          rect.right - POPOVER_WIDTH,
        ),
      );

      const belowTop = rect.bottom + 8;
      const aboveTop = Math.max(margin, rect.top - 8 - POPOVER_HEIGHT);
      const top =
        belowTop + POPOVER_HEIGHT <= viewportHeight - margin
          ? belowTop
          : aboveTop;

      setPopoverPosition({ top, left });
    };

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [isOpen]);

  const commitValue = useCallback(
    (nextValue: string) => {
      const normalized = normalizeHexColor(nextValue);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (debounceMs <= 0) {
        pendingCommitRef.current = null;
        onChange(normalized);
        return;
      }

      pendingCommitRef.current = normalized;
      timeoutRef.current = setTimeout(() => {
        if (pendingCommitRef.current !== normalized) return;

        timeoutRef.current = null;
        pendingCommitRef.current = null;
        onChange(normalized);
      }, debounceMs);
    },
    [debounceMs, onChange],
  );

  const applyColor = useCallback(
    (nextColor: string) => {
      const normalized = normalizeHexColor(nextColor);
      draftColorRef.current = normalized;
      setDraftColor(normalized);
      commitValue(normalized);
    },
    [commitValue],
  );

  const isSaved = savedColors.includes(draftColor);

  if (mode === "native") {
    return (
      <input
        type="color"
        value={draftColor}
        onChange={(event) => applyColor(event.currentTarget.value)}
        className={className}
        disabled={disabled}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-flex shrink-0", className)}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          onTriggerClick?.();
          updateOpen((open) => !open);
        }}
        className={cn(
          "size-full min-h-0 min-w-0 cursor-pointer rounded-[inherit] bg-transparent transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35",
          disabled && "pointer-events-none opacity-50",
        )}
        style={{ backgroundColor: draftColor }}
        aria-label={`Open color picker for ${draftColor.toUpperCase()}`}
      >
        {children}
      </button>

      {isOpen && !disabled && isMounted
        ? createPortal(
            <div
              ref={popoverRef}
              data-shared-color-picker-popover
              className="agentcut-color-picker fixed z-[220] w-[248px] rounded-md border border-border bg-background p-3 shadow-xl"
              style={{
                top: popoverPosition.top,
                left: popoverPosition.left,
              }}
            >
              <div className="space-y-3">
                <HexColorPicker color={draftColor} onChange={applyColor} />

                <div className="flex items-center gap-2">
                  <HexColorInput
                    color={draftColor}
                    onChange={applyColor}
                    prefixed
                    className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[11px] font-mono uppercase text-foreground outline-none transition-colors focus:border-foreground/50"
                  />
                  <button
                    type="button"
                    onClick={() => setSavedColors(saveSavedColor(draftColor))}
                    disabled={isSaved}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-sm border border-border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors",
                      isSaved
                        ? "cursor-default text-muted-foreground"
                        : "hover:bg-muted",
                    )}
                  >
                    {isSaved ? (
                      <>
                        <Check className="h-3 w-3" />
                        Saved
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="h-3 w-3" />
                        Save
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Saved Colors
                  </div>
                  {savedColors.length > 0 ? (
                    <div className="grid grid-cols-6 gap-1">
                      {savedColors.map((savedColor) => {
                        const selected = savedColor === draftColor;
                        return (
                          <div key={savedColor} className="relative">
                            <TooltipHint content={savedColor.toUpperCase()}>
                              <button
                                type="button"
                                onClick={() => applyColor(savedColor)}
                                className={cn(
                                  "h-7 w-7 rounded-sm border-2 transition-transform hover:scale-105",
                                  selected
                                    ? "border-foreground shadow-sm"
                                    : "border-border",
                                )}
                                style={{ backgroundColor: savedColor }}
                                aria-label={`Use saved color ${savedColor.toUpperCase()}`}
                              />
                            </TooltipHint>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSavedColors(removeSavedColor(savedColor));
                              }}
                              className="absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                              aria-label={`Remove saved color ${savedColor.toUpperCase()}`}
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-sm border border-dashed border-border/70 px-2 py-2 text-[9px] text-muted-foreground">
                      Save your brand colors here so they are ready in every
                      picker.
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
