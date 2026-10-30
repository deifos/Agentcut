"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

/** Shared hint for controls and truncated text. Also composes with menu/dialog triggers. */
function TooltipHint({
  content,
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof TooltipTrigger>,
  "children" | "content" | "asChild"
> & {
  content?: React.ReactNode;
  children: React.ReactElement<React.ComponentProps<"button">>;
}) {
  const disabled = children.props.disabled;
  return (
    <Tooltip>
      <TooltipTrigger asChild tabIndex={0} {...props}>
        {disabled ? (
          <span
            tabIndex={0}
            aria-disabled="true"
            aria-label={
              children.props["aria-label"] ??
              (typeof content === "string" ? content : undefined)
            }
            className={cn(
              "inline-flex max-w-full items-center",
              children.props.className?.includes("ml-auto") && "ml-auto",
            )}
          >
            {React.cloneElement(children, {
              className: cn(children.props.className, "pointer-events-none"),
            })}
          </span>
        ) : (
          children
        )}
      </TooltipTrigger>
      {content ? (
        <TooltipContent className="max-w-xs">{content}</TooltipContent>
      ) : null}
    </Tooltip>
  );
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipHint,
};
