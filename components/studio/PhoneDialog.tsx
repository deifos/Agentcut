"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { StudioBridge } from "@/lib/studio/bridge";
import { PHONE_API } from "@/lib/studio/phone";

interface PhoneStatus {
  connected: boolean;
  paired?: boolean;
  name?: string;
  expires?: number;
  pairing?: { id: string; invite: string; secret: string } | null;
}
export function PhoneDialog({
  getBridge,
  supported,
}: {
  getBridge(): StudioBridge | null;
  supported: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  const [qr, setQr] = useState<{ link: string; data: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open || !supported) return;
    let disposed = false;
    async function refresh() {
      try {
        const data = await getBridge()?.request<PhoneStatus>(
          "studio.phone.status",
          {},
        );
        if (!disposed && data) setStatus(data);
      } catch (e) {
        if (!disposed)
          setError(
            e instanceof Error
              ? e.message
              : "Could not read the phone connection.",
          );
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [open, supported, getBridge]);
  const id = status?.pairing?.id,
    invite = status?.pairing?.invite,
    secret = status?.pairing?.secret;
  const link =
    id && invite && secret && open && typeof location !== "undefined"
      ? `${location.origin}/phone#${new URLSearchParams({ id, invite, key: secret })}`
      : "";
  useEffect(() => {
    if (!link) return;
    let disposed = false;
    void import("qrcode")
      .then((q) =>
        q.toDataURL(link, {
          width: 280,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      )
      .then((data) => {
        if (!disposed) setQr({ link, data });
      })
      .catch(() => {
        if (!disposed)
          setError("Could not create the QR code. Use the connection link.");
      });
    return () => {
      disposed = true;
    };
  }, [link]);
  async function action(method: string) {
    setBusy(true);
    setError("");
    try {
      const bridge = getBridge();
      if (!bridge) throw new Error("Start the helper first.");
      await bridge.request(method, { api: PHONE_API });
      setStatus(await bridge.request<PhoneStatus>("studio.phone.status", {}));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not change the connection.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!PHONE_API) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Phone
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send videos from your phone</DialogTitle>
          <DialogDescription>
            Connect once. Record or choose a video on your phone, then let this
            computer edit it.
          </DialogDescription>
        </DialogHeader>
        {!supported ? (
          <p className="text-sm">
            Update the Agentcut helper to use phone transfers.
          </p>
        ) : status?.connected ? (
          <div className="space-y-4">
            {status.paired ? (
              <>
                <p className="font-medium">Phone connected to {status.name}</p>
                <p className="text-sm text-muted-foreground">
                  Open Agentcut /phone on your phone. Keep this helper running.
                  The studio can open in the background when needed.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm">
                  Scan this code with your phone camera. The link expires at{" "}
                  {status.expires
                    ? new Date(status.expires).toLocaleTimeString()
                    : "—"}
                  .
                </p>
                {/* The QR is generated locally. It contains the private connection key. */}
                {qr?.link === link && link ? (
                  <Image
                    unoptimized
                    src={qr.data}
                    width={280}
                    height={280}
                    alt="Scan to connect your phone to this computer"
                    className="mx-auto rounded-lg"
                  />
                ) : null}
                <Button
                  variant="outline"
                  disabled={!link}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(link)
                      .catch(() =>
                        setError(
                          "Could not copy the link. Scan the QR code instead.",
                        ),
                      );
                  }}
                >
                  Copy private connection link
                </Button>
                <p className="text-xs text-muted-foreground">
                  Keep this link private. The connected phone can start edits
                  with your local agent. Remove an expired connection to create
                  a new code.
                </p>
              </>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void action("studio.phone.disconnect")}
            >
              Remove connection
            </Button>
          </div>
        ) : (
          <Button
            disabled={busy || !status}
            onClick={() => void action("studio.phone.connect")}
          >
            {busy ? "Connecting…" : "Connect a phone"}
          </Button>
        )}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
