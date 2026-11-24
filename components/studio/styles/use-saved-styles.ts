"use client";

import { useCallback, useEffect, useState } from "react";
import { studioFileUrl } from "@/lib/studio/file-url";
import {
  editingStyleIds,
  parseEditingStyle,
  type EditingStyle,
} from "@/lib/studio/editing-styles";
import type { AssetEntry } from "@/lib/studio/types";

export interface SavedStylesState {
  loaded: boolean;
  styles: EditingStyle[];
  errors: string[];
  reload(): void;
  /** Hide a deleted style before the library listing catches up. */
  forget(id: string): void;
}

/** The workspace's saved editing styles, shared by the Saved and Community tabs. */
export function useSavedStyles(library: AssetEntry[]): SavedStylesState {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    library: AssetEntry[];
    attempt: number;
    styles: EditingStyle[];
    errors: string[];
  } | null>(null);
  const [forgotten, setForgotten] = useState<{ library: AssetEntry[]; ids: Set<string> } | null>(null);
  const hidden = forgotten?.library === library ? forgotten.ids : null;

  // Library events include file changes, not just IDs: edits to an existing prompt must reload too.
  useEffect(() => {
    const controller = new AbortController();
    const read = async (id: string, file: string) => {
      const response = await fetch(studioFileUrl("", `library:editing-styles/${id}/${file}`), {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Could not read ${id}/${file} (${response.status}).`);
      return response.text();
    };
    void Promise.allSettled(
      editingStyleIds(library).map(async (id) => {
        const [meta, prompt] = await Promise.all([read(id, "style.json"), read(id, "PROMPT.md")]);
        try {
          return parseEditingStyle(id, JSON.parse(meta), prompt);
        } catch {
          throw new Error(`Editing style "${id}" has invalid or incomplete files.`);
        }
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return;
      const styles: EditingStyle[] = [];
      const errors: string[] = [];
      for (const entry of entries) {
        if (entry.status === "fulfilled") styles.push(entry.value);
        else errors.push(entry.reason instanceof Error ? entry.reason.message : "Could not load an editing style.");
      }
      setResult({ library, attempt, styles, errors });
    });
    return () => controller.abort();
  }, [library, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const forget = useCallback(
    (id: string) =>
      setForgotten((previous) => ({
        library,
        ids: new Set([...(previous?.library === library ? previous.ids : []), id]),
      })),
    [library],
  );
  const loaded = result?.library === library && result.attempt === attempt;
  return {
    loaded,
    styles: loaded ? result.styles.filter((style) => !hidden?.has(style.id)) : [],
    errors: loaded ? result.errors : [],
    reload,
    forget,
  };
}
