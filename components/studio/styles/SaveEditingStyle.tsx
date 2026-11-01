"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveEditingStyleRequest } from "@/lib/studio/editing-styles";

export function SaveEditingStyle({
  open,
  onOpenChange,
  slug,
  disabled,
  onSend,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  slug: string;
  disabled: boolean;
  onSend(text: string): Promise<void>;
}) {
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!sending) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogTitle>Save current style</DialogTitle>
        <DialogDescription>
          The agent will inspect this video and the available edit history, then
          save reusable editing rules. Follow its progress in chat. Use the
          saved style on different footage from Saved editing styles.
        </DialogDescription>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (sending || disabled) return;
            if (!name.trim()) {
              setError("Enter a style name.");
              return;
            }
            setSending(true);
            setError(null);
            try {
              await onSend(saveEditingStyleRequest(name, slug));
              setName("");
              onOpenChange(false);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not send the save request. Try again.",
              );
            } finally {
              setSending(false);
            }
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="editing-style-name">Style name</Label>
            <Input
              id="editing-style-name"
              value={name}
              maxLength={80}
              required
              autoFocus
              disabled={sending}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "editing-style-error" : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              placeholder="For example: My interview edits"
            />
          </div>
          {error ? (
            <p
              id="editing-style-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          {disabled ? (
            <p role="status" className="text-sm text-muted-foreground">
              Connect the helper and wait for the current agent task to finish.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={sending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={disabled || sending || !name.trim()}
            >
              {sending ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : null}
              {sending ? "Sending…" : "Ask agent to save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
