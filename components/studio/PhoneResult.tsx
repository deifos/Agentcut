"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  PHONE_CHUNK,
  PHONE_MAX_BYTES,
  openPhoneResult,
} from "@/packages/agentcut/src/studio/phone-protocol";
import { PhoneRequestError } from "@/lib/studio/phone";
import {
  parsePhoneResultLink,
  phoneResultRequest,
  type PhoneResultLink,
} from "@/lib/studio/phone-result";

interface Details {
  name: string;
  bytes: number;
  chunks: number;
  expires: number;
}
function initialLink() {
  try {
    return { link: parsePhoneResultLink(location.hash), error: "" };
  } catch (error) {
    return {
      link: null,
      error: error instanceof Error ? error.message : "This link is invalid.",
    };
  }
}

export function PhoneResult() {
  const [initial] = useState(initialLink);
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState(initial.error);
  const [unavailable, setUnavailable] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const active = useRef<AbortController | null>(null);
  const mediaUrl = useRef<string | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!initial.link) return;
    const link = initial.link;
    const controller = new AbortController();
    async function load() {
      try {
        const [info, encrypted] = await Promise.all([
          phoneResultRequest(link, "", { signal: controller.signal }).then(
            (r) => r.json(),
          ),
          phoneResultRequest(link, "result/manifest", {
            signal: controller.signal,
          }).then((r) => r.arrayBuffer()),
        ]);
        const manifest = JSON.parse(
          new TextDecoder().decode(
            await openPhoneResult(
              link.key,
              link.job,
              "result/manifest",
              encrypted,
            ),
          ),
        );
        if (
          !Number.isInteger(info.bytes) ||
          info.bytes < 1 ||
          info.bytes > PHONE_MAX_BYTES ||
          info.chunks !== Math.ceil(info.bytes / PHONE_CHUNK) ||
          !Number.isFinite(info.expires) ||
          manifest.bytes !== info.bytes ||
          typeof manifest.name !== "string"
        )
          throw new Error("The video details are invalid.");
        if (!controller.signal.aborted) {
          setDetails({ ...info, name: manifest.name.slice(0, 200) });
          setError("");
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Could not open the video.");
        if (e instanceof PhoneRequestError && e.status === 410)
          setUnavailable(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [initial.link, retry]);
  useEffect(
    () => () => {
      active.current?.abort();
      if (mediaUrl.current) URL.revokeObjectURL(mediaUrl.current);
    },
    [],
  );

  function clearVideo() {
    video.current?.pause();
    if (video.current) {
      video.current.removeAttribute("src");
      video.current.load();
    }
    if (mediaUrl.current) URL.revokeObjectURL(mediaUrl.current);
    mediaUrl.current = null;
    setVideoUrl(null);
  }
  useEffect(() => {
    const changed = () => location.reload();
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  function failure(e: unknown) {
    setError(e instanceof Error ? e.message : "The request failed. Try again.");
    if (e instanceof PhoneRequestError && e.status === 410) {
      setUnavailable(true);
      clearVideo();
    }
  }
  async function loadVideo(
    link: PhoneResultLink,
    info: Details,
    signal: AbortSignal,
  ) {
    // Re-check expiry and deletion even when this tab already has a local preview.
    await phoneResultRequest(link, "", { signal });
    if (mediaUrl.current) return mediaUrl.current;
    const parts: Uint8Array<ArrayBuffer>[] = [];
    for (let n = 0; n < info.chunks; n++) {
      const encrypted = await (
        await phoneResultRequest(link, `result/${n}`, { signal })
      ).arrayBuffer();
      const part = await openPhoneResult(
        link.key,
        link.job,
        `result/${n}`,
        encrypted,
      );
      if (part.length !== Math.min(PHONE_CHUNK, info.bytes - n * PHONE_CHUNK))
        throw new Error("The video is incomplete. Try again.");
      signal.throwIfAborted();
      parts.push(part);
      setProgress(Math.round(((n + 1) / info.chunks) * 100));
    }
    signal.throwIfAborted();
    const url = URL.createObjectURL(new Blob(parts, { type: "video/mp4" }));
    mediaUrl.current = url;
    return url;
  }
  async function handleVideo(download: boolean) {
    if (!initial.link || !details || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setNotice("");
    setProgress(0);
    try {
      const url = await loadVideo(initial.link, details, controller.signal);
      if (download) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = details.name.replace(/[\\/]/g, "-");
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setNotice("Download started.");
      } else setVideoUrl(url);
    } catch (e) {
      if (!controller.signal.aborted) failure(e);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      active.current = null;
    }
  }
  async function remove() {
    if (!initial.link || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await phoneResultRequest(initial.link, "delete", {
        method: "POST",
        signal: controller.signal,
      });
      clearVideo();
      setRemoved(true);
      setConfirmDelete(false);
    } catch (e) {
      if (!controller.signal.aborted) failure(e);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      active.current = null;
    }
  }

  return (
    <main className="min-h-dvh bg-background px-5 py-8 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/phone"
          className="font-display text-2xl font-extrabold tracking-tight"
        >
          agent<span className="text-brand">cut</span>
        </Link>
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {removed
              ? "Online video deleted"
              : unavailable
                ? "Video unavailable"
                : details
                  ? "Your video is ready"
                  : "Your video"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {removed
              ? "The project and rendered file on your computer are unchanged."
              : unavailable
                ? "This private link no longer provides access to an online video."
                : "Watch it here. Download a copy only when you want one."}
          </p>
        </header>
        {details && !removed && !unavailable ? (
          <>
            <div>
              <p className="break-all font-medium">{details.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {(details.bytes / 1024 / 1024).toFixed(1)} MB · Available until{" "}
                {new Date(details.expires).toLocaleString()}
              </p>
            </div>
            {videoUrl ? (
              <video
                ref={video}
                controls
                playsInline
                autoPlay
                src={videoUrl}
                className="max-h-[65dvh] w-full rounded-xl bg-black"
                onError={() =>
                  setError(
                    "This browser cannot play the video. Use Download to save a copy.",
                  )
                }
              />
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-xl border bg-muted/30">
                <Button
                  size="lg"
                  disabled={busy}
                  onClick={() => void handleVideo(false)}
                >
                  Watch video
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void handleVideo(true)}
              >
                Download
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void navigator.clipboard
                    .writeText(location.href)
                    .then(() => setNotice("Private link copied."))
                    .catch(() =>
                      setError(
                        "Could not copy the link. Copy it from the address bar.",
                      ),
                    );
                }}
              >
                Copy private link
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                Delete online video
              </Button>
            </div>
            {confirmDelete ? (
              <section
                aria-label="Confirm deletion"
                className="space-y-3 rounded-xl border p-4"
              >
                <p className="text-sm">
                  Delete this online video? This link will stop working. The
                  project and rendered file on your computer will stay.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void remove()}
                  >
                    Delete video
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep video
                  </Button>
                </div>
              </section>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Keep this link private. Anyone with the complete link can watch,
              download, or delete this online video.
            </p>
          </>
        ) : !error && !removed && !unavailable ? (
          <p role="status">Opening video details…</p>
        ) : null}
        {busy ? (
          <div role="status" className="space-y-2">
            <p className="text-sm">
              {confirmDelete
                ? "Deleting online video…"
                : `Loading video: ${progress}%`}
            </p>
            {!confirmDelete ? (
              <progress
                aria-label="Video loading progress"
                className="w-full"
                value={progress}
                max={100}
              />
            ) : null}
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            {initial.link && !details && !unavailable ? (
              <Button
                variant="outline"
                onClick={() => setRetry((value) => value + 1)}
              >
                Try again
              </Button>
            ) : null}
          </div>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm">
            {notice}
          </p>
        ) : null}
        <Link href="/phone" className="inline-block text-sm underline">
          Back to your videos
        </Link>
      </div>
    </main>
  );
}
