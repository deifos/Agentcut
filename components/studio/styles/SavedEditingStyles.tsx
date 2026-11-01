"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { studioFileUrl } from "@/lib/studio/file-url";
import {
  applyEditingStyleRequest,
  editingStyleIds,
  parseEditingStyle,
  type EditingStyle,
} from "@/lib/studio/editing-styles";
import type { AssetEntry } from "@/lib/studio/types";

export function SavedEditingStyles({
  library,
  slug,
  disabled,
  onSend,
}: {
  library: AssetEntry[];
  slug: string;
  disabled: boolean;
  onSend(text: string): Promise<void>;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    library: AssetEntry[];
    attempt: number;
    styles: EditingStyle[];
    errors: string[];
  } | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  // Library events include file changes, not just IDs: edits to an existing prompt must reload too.
  useEffect(() => {
    const controller = new AbortController();
    const read = async (id: string, file: string) => {
      const response = await fetch(
        studioFileUrl("", `library:editing-styles/${id}/${file}`),
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok)
        throw new Error(`Could not read ${id}/${file} (${response.status}).`);
      return response.text();
    };
    void Promise.allSettled(
      editingStyleIds(library).map(async (id) => {
        const [meta, prompt] = await Promise.all([
          read(id, "style.json"),
          read(id, "PROMPT.md"),
        ]);
        try {
          return parseEditingStyle(id, JSON.parse(meta), prompt);
        } catch {
          throw new Error(
            `Editing style "${id}" has invalid or incomplete files.`,
          );
        }
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return;
      const styles: EditingStyle[] = [];
      const errors: string[] = [];
      for (const entry of entries) {
        if (entry.status === "fulfilled") styles.push(entry.value);
        else
          errors.push(
            entry.reason instanceof Error
              ? entry.reason.message
              : "Could not load an editing style.",
          );
      }
      setResult({ library, attempt, styles, errors });
    });
    return () => controller.abort();
  }, [library, attempt]);

  const loaded = result?.library === library && result.attempt === attempt;
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Use saved editing rules on the current footage. The agent will
            choose new content to fit.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Refresh
          </Button>
        </div>
        {!loaded ? (
          <p role="status">Loading saved editing styles…</p>
        ) : (
          <>
            {result.errors.map((error) => (
              <p role="alert" className="text-sm text-destructive" key={error}>
                {error} Use Refresh to try again.
              </p>
            ))}
            {result.styles.length === 0 && result.errors.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No saved editing styles yet. Edit a video, then select Save
                current style above. Styles are shared across projects in this
                workspace.
              </p>
            ) : null}
            {result.styles.map((style) => (
              <article
                key={style.id}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <h3 className="break-words font-semibold">{style.name}</h3>
                <p className="break-words text-sm text-muted-foreground">
                  {style.description}
                </p>
                <details>
                  <summary className="cursor-pointer text-sm">
                    View editing rules
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-sm">
                    {style.prompt}
                  </pre>
                </details>
                <Button
                  type="button"
                  className="self-start"
                  disabled={disabled || sending !== null}
                  onClick={async () => {
                    if (disabled || sending !== null) return;
                    setSending(style.id);
                    setSendError(null);
                    try {
                      await onSend(applyEditingStyleRequest(style, slug));
                    } catch (cause) {
                      setSendError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not send the style request. Try again.",
                      );
                    } finally {
                      setSending(null);
                    }
                  }}
                >
                  {sending === style.id ? "Sending…" : "Apply to this video"}
                </Button>
              </article>
            ))}
          </>
        )}
        {sendError ? (
          <p role="alert" className="text-sm text-destructive">
            {sendError}
          </p>
        ) : null}
        {disabled ? (
          <p role="status" className="text-sm text-muted-foreground">
            Connect the helper and wait for the current agent task to finish
            before applying a style.
          </p>
        ) : null}
      </div>
    </ScrollArea>
  );
}
