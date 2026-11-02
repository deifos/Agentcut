"use client";

// One confirmation for everything destructive: `if (!(await confirmDestructive({ ... }))) return;`.
// The dialog is mounted once in the studio, so any button, menu or shortcut can ask.
import { useSyncExternalStore } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmRequest {
  title: string;
  description?: string;
  /** The button's label, naming the action ("Delete clip"), never just "OK". */
  action: string;
}

type Pending = ConfirmRequest & { resolve(confirmed: boolean): void };

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

/** Resolves true only if the person confirms. A second request while one is open is declined. */
export function confirmDestructive(request: ConfirmRequest): Promise<boolean> {
  if (pending) return Promise.resolve(false);
  return new Promise((resolve) => {
    pending = { ...request, resolve };
    notify();
  });
}

/** Shortcuts stay out of the way while the dialog is up. */
export function isConfirmOpen() {
  return pending !== null || closing;
}

// The key that closes the dialog (Esc) travels on to the page's shortcuts after the dialog has handled
// it, so the dialog keeps the keyboard until that event is over.
let closing = false;

function settle(confirmed: boolean) {
  const current = pending;
  if (!current) return;
  pending = null;
  closing = true;
  setTimeout(() => {
    closing = false;
  }, 0);
  notify();
  current.resolve(confirmed);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const read = () => pending;
const readServer = () => null;

export function ConfirmHost() {
  const request = useSyncExternalStore(subscribe, read, readServer);
  return (
    <AlertDialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      <AlertDialogContent data-testid="confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          {request?.description ? <AlertDialogDescription>{request.description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => settle(true)}
          >
            <Trash2 />
            {request?.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
