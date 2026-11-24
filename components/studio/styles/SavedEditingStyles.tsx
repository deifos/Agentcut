"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Film, Globe, Share2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { studioFileUrl } from "@/lib/studio/file-url";
import {
  applyEditingStyleRequest,
  editingStyleMedia,
  type EditingStyle,
} from "@/lib/studio/editing-styles";
import type { AssetEntry } from "@/lib/studio/types";
import type { SavedStylesState } from "@/components/studio/styles/use-saved-styles";
import { ShareStyleDialog, submittedStyles } from "@/components/studio/styles/ShareStyleDialog";

function StyleThumb({ style, library }: { style: EditingStyle; library: AssetEntry[] }) {
  const [playing, setPlaying] = useState(false);
  const media = editingStyleMedia(library, style.id);
  const version = (file: { path: string; version: number }) => `${studioFileUrl("", file.path)}?v=${Math.round(file.version)}`;
  const poster = media.poster ? version(media.poster) : style.preview?.poster;
  const demo = media.demo ? version(media.demo) : style.preview?.demo;
  if (!poster && !demo) return null;
  return (
    <div
      className="relative aspect-[9/16] w-[96px] shrink-0 overflow-hidden rounded-md bg-black"
      onMouseEnter={() => setPlaying(true)}
      onMouseLeave={() => setPlaying(false)}
    >
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" loading="lazy" className="absolute inset-0 size-full object-contain" />
      ) : null}
      {demo && (playing || !poster) ? (
        <video src={demo} muted loop autoPlay={playing} playsInline className="absolute inset-0 size-full object-contain" />
      ) : null}
    </div>
  );
}

export function SavedEditingStyles({
  saved,
  library,
  slug,
  disabled,
  renders,
  canMakeDemo,
  helperHint,
  onSend,
  onDelete,
  onMakeDemo,
}: {
  saved: SavedStylesState;
  library: AssetEntry[];
  slug: string;
  disabled: boolean;
  /** This project's rendered MP4s, for the demo clip. */
  renders: AssetEntry[];
  /** The helper can make demo clips (connected and new enough). */
  canMakeDemo: boolean;
  helperHint: string | null;
  onSend(text: string): Promise<void>;
  onDelete(id: string): Promise<void>;
  onMakeDemo(id: string, input: { path: string; start: number; duration: number }): Promise<void>;
}) {
  const [sending, setSending] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<EditingStyle | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<EditingStyle | null>(null);
  // The studio renders only in the browser, so local storage is there on the first render.
  const [submitted, setSubmitted] = useState<Record<string, number>>(submittedStyles);

  return (
    <>
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
              onClick={saved.reload}
            >
              Refresh
            </Button>
          </div>
          {!saved.loaded ? (
            <p role="status">Loading saved editing styles…</p>
          ) : (
            <>
              {saved.errors.map((error) => (
                <p
                  role="alert"
                  className="text-sm text-destructive"
                  key={error}
                >
                  {error} Use Refresh to try again.
                </p>
              ))}
              {saved.styles.length === 0 && saved.errors.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No saved editing styles yet. Edit a video, then select Save
                  current style above, or add one from Community. Styles are
                  shared across projects in this workspace.
                </p>
              ) : null}
              {saved.styles.map((style) => {
                const community = style.source?.kind === "community";
                const hasDemo = Boolean(editingStyleMedia(library, style.id).demo);
                return (
                  <article
                    key={style.id}
                    className="flex gap-4 rounded-lg border p-4"
                  >
                    <StyleThumb style={style} library={library} />
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words font-semibold">{style.name}</h3>
                        {community ? (
                          <span className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                            <Globe className="size-3" /> Community{style.author ? ` · by ${style.author.name}` : ""}
                          </span>
                        ) : submitted[style.id] ? (
                          <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                            Submitted for review
                          </span>
                        ) : null}
                      </div>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          className="self-start"
                          disabled={disabled || sending !== null || deleting}
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
                          {sending === style.id
                            ? "Sending…"
                            : "Apply to this video"}
                        </Button>
                        {community ? null : (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={deleting}
                            onClick={() => setSharing(style)}
                          >
                            {hasDemo ? <Share2 data-icon="inline-start" /> : <Film data-icon="inline-start" />}
                            {hasDemo ? "Share publicly" : "Add demo & share"}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          disabled={disabled || sending !== null || deleting}
                          aria-label={`Delete ${style.name}`}
                          onClick={() => {
                            setDeleteError(null);
                            setToDelete(style);
                          }}
                        >
                          <Trash2 data-icon="inline-start" /> Delete
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
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
      {sharing ? (
        <ShareStyleDialog
          key={sharing.id}
          open
          onOpenChange={(value) => { if (!value) setSharing(null); }}
          style={sharing}
          media={editingStyleMedia(library, sharing.id)}
          renders={renders}
          canMakeDemo={canMakeDemo}
          helperHint={helperHint}
          onMakeDemo={(input) => onMakeDemo(sharing.id, input)}
          onSubmitted={() => setSubmitted(submittedStyles())}
        />
      ) : null}
      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete saved editing style?</AlertDialogTitle>
          <AlertDialogDescription>
            Delete “{toDelete?.name}” from this workspace’s saved styles?
            Existing videos will not change.
          </AlertDialogDescription>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={disabled || deleting}
              onClick={async () => {
                if (!toDelete || disabled || deleting) return;
                setDeleting(true);
                setDeleteError(null);
                try {
                  await onDelete(toDelete.id);
                  saved.forget(toDelete.id);
                  setToDelete(null);
                } catch (cause) {
                  setDeleteError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not delete this style. Try again.",
                  );
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete style"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
