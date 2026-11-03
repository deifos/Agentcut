"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createPhoneResultLink } from "@/lib/studio/phone-result";
import {
  PHONE_API,
  PHONE_CHUNK,
  PHONE_MAX_BYTES,
  PHONE_TTL,
  PHONE_DEFAULT_PROMPT,
  PhoneRequestError,
  phoneSecret,
  phoneRequest,
  sealPhone,
  validatePhoneManifest,
  decodeSecret,
  type PhoneConnection,
  type PhoneJob,
} from "@/lib/studio/phone";

const STORAGE = "agentcut.phone.v1";
const LABELS: Record<PhoneJob["stage"], string> = {
  uploading: "Upload not complete",
  waiting: "Waiting for computer",
  receiving: "Computer is receiving video",
  editing: "Editing on your computer",
  rendering: "Creating the finished video",
  returning: "Sending the result",
  done: "Video ready",
  error: "Job stopped. Check the project or helper on your computer.",
};
type Pairing = { id: string; invite: string; secret: string };
type Pending = { id: string; fingerprint: string; prompt: string };

function initialPhoneState() {
  const initial = {
    connection: null as PhoneConnection | null,
    pairing: null as Pairing | null,
    pending: null as Pending | null,
    prompt: "",
    auto: false,
    error: "",
  };
  try {
    const hash = new URLSearchParams(location.hash.slice(1));
    const id = hash.get("id"),
      invite = hash.get("invite"),
      secret = hash.get("key");
    if (id && invite && secret) {
      if (!/^[a-f0-9-]{36}$/.test(id))
        throw new Error("The connection link is invalid.");
      decodeSecret(invite);
      decodeSecret(secret);
      initial.pairing = { id, invite, secret };
    }
    if (!initial.pairing) {
      const savedPairing = sessionStorage.getItem(`${STORAGE}.pairing`);
      if (savedPairing) initial.pairing = JSON.parse(savedPairing);
    }
    const saved = localStorage.getItem(STORAGE);
    if (saved) {
      const c = JSON.parse(saved) as PhoneConnection;
      decodeSecret(c.secret);
      decodeSecret(c.token);
      if (!/^[a-f0-9-]{36}$/.test(c.id))
        throw new Error("Connect this phone again.");
      initial.connection = c;
      if (initial.pairing?.id === c.id) initial.pairing = null;
    }
    initial.prompt = localStorage.getItem(`${STORAGE}.prompt`) || "";
    initial.auto = localStorage.getItem(`${STORAGE}.auto`) === "true";
    initial.pending = JSON.parse(
      localStorage.getItem(`${STORAGE}.pending`) || "null",
    );
  } catch (e) {
    initial.error = e instanceof Error ? e.message : String(e);
  }
  return initial;
}

async function videoDetails(file: File) {
  const video = document.createElement("video"),
    url = URL.createObjectURL(file);
  try {
    return await new Promise<{
      width: number;
      height: number;
      duration: number;
    }>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(new Error("Cannot read this video. Try an MP4 or MOV file.")),
        20_000,
      );
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
        });
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(
          new Error("This browser cannot read the video. Try an MP4 file."),
        );
      };
      video.src = url;
    });
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export function PhoneApp() {
  const [initial] = useState(initialPhoneState);
  const [connection, setConnection] = useState(initial.connection);
  const [pairing, setPairing] = useState(initial.pairing);
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState(initial.prompt);
  const [auto, setAuto] = useState(initial.auto);
  const [jobs, setJobs] = useState<PhoneJob[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const working = useRef(false);
  const pending = useRef<Pending | null>(initial.pending);

  useEffect(() => {
    if (initial.pairing)
      sessionStorage.setItem(
        `${STORAGE}.pairing`,
        JSON.stringify(initial.pairing),
      );
    if (location.hash) history.replaceState(null, "", location.pathname);
    const changed = () => {
      const next = initialPhoneState();
      if (next.pairing) {
        setPairing(next.pairing);
        sessionStorage.setItem(
          `${STORAGE}.pairing`,
          JSON.stringify(next.pairing),
        );
      }
      if (next.error) setError(next.error);
      history.replaceState(null, "", location.pathname);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, [initial]);

  useEffect(() => {
    if (!connection) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await (
          await phoneRequest(connection.id, connection.token, "jobs")
        ).json();
        if (!disposed) {
          setJobs(data.jobs);
          setMessage("");
        }
      } catch (e) {
        if (!disposed && e instanceof PhoneRequestError && e.status === 410) {
          localStorage.removeItem(STORAGE);
          localStorage.removeItem(`${STORAGE}.pending`);
          sessionStorage.removeItem(`${STORAGE}.pairing`);
          setConnection(null);
          setJobs([]);
        }
        if (!disposed)
          setMessage(
            e instanceof Error
              ? e.message
              : "Cannot reach the transfer service.",
          );
      }
      if (!disposed) timer = setTimeout(() => void poll(), 5000);
    };
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [connection]);
  useEffect(() => {
    if (!busy) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [busy]);

  async function pair() {
    if (!pairing || working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      // Keep the same token on a network retry, including after a reload.
      const claimKey = `${STORAGE}.claim.${pairing.id}`;
      const token = localStorage.getItem(claimKey) || phoneSecret();
      localStorage.setItem(claimKey, token);
      await phoneRequest(pairing.id, pairing.invite, "claim", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      const c = { id: pairing.id, token, secret: pairing.secret };
      localStorage.setItem(STORAGE, JSON.stringify(c));
      setConnection(c);
      setPairing(null);
      sessionStorage.removeItem(`${STORAGE}.pairing`);
      pending.current = null;
      localStorage.removeItem(`${STORAGE}.pending`);
      localStorage.removeItem(claimKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function send(selected: File) {
    if (!connection || working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      if (selected.size < 1 || selected.size > PHONE_MAX_BYTES)
        throw new Error("Choose a video of up to 1 GB.");
      const details = await videoDetails(selected);
      const fingerprint = `${connection.id}:${selected.name}:${selected.size}:${selected.lastModified}`;
      if (pending.current?.fingerprint !== fingerprint)
        pending.current = {
          id: crypto.randomUUID(),
          fingerprint,
          prompt: prompt.trim() || PHONE_DEFAULT_PROMPT,
        };
      const p = pending.current;
      const extension = selected.name.split(".").pop()?.toLowerCase() || "mp4";
      const manifest = validatePhoneManifest(
        {
          ...details,
          name: selected.name.slice(0, 200),
          prompt: p.prompt,
          extension,
          bytes: selected.size,
        },
        selected.size,
      );
      localStorage.setItem(`${STORAGE}.pending`, JSON.stringify(p));
      localStorage.setItem(`${STORAGE}.prompt`, prompt);
      const job = (await (
        await phoneRequest(connection.id, connection.token, "jobs", {
          method: "POST",
          body: JSON.stringify({ id: p.id, bytes: selected.size }),
        })
      ).json()) as PhoneJob & { input?: number[] };
      if (job.stage === "uploading") {
        for (let n = 0; n < job.chunks; n++) {
          if (job.input?.includes(n)) {
            setProgress(Math.round(((n + 1) / job.chunks) * 100));
            continue;
          }
          const data = new Uint8Array(
            await selected
              .slice(n * PHONE_CHUNK, (n + 1) * PHONE_CHUNK)
              .arrayBuffer(),
          );
          const sealed = await sealPhone(
            connection.secret,
            job.id,
            `input/${n}`,
            data,
          );
          let lastError: unknown;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await phoneRequest(
                connection.id,
                connection.token,
                `jobs/${job.id}/input/${n}`,
                { method: "PUT", body: sealed },
              );
              lastError = null;
              break;
            } catch (e) {
              lastError = e;
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * (attempt + 1)),
              );
            }
          }
          if (lastError) throw lastError;
          setProgress(Math.round(((n + 1) / job.chunks) * 100));
        }
        await phoneRequest(
          connection.id,
          connection.token,
          `jobs/${job.id}/input/manifest`,
          {
            method: "PUT",
            body: await sealPhone(
              connection.secret,
              job.id,
              "input/manifest",
              new TextEncoder().encode(JSON.stringify(manifest)),
            ),
          },
        );
        await phoneRequest(
          connection.id,
          connection.token,
          `jobs/${job.id}/commit`,
          { method: "POST" },
        );
      }
      pending.current = null;
      localStorage.removeItem(`${STORAGE}.pending`);
      setFile(null);
      setProgress(100);
      setJobs(
        (
          await (
            await phoneRequest(connection.id, connection.token, "jobs")
          ).json()
        ).jobs,
      );
    } catch (e) {
      if (e instanceof PhoneRequestError && e.status === 410) {
        pending.current = null;
        localStorage.removeItem(`${STORAGE}.pending`);
      }
      setError(
        e instanceof Error
          ? e.message
          : "Upload failed. Select the same file and try again.",
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  function select(selected?: File) {
    if (!selected) return;
    setFile(selected);
    setError("");
    if (auto) void send(selected);
  }

  async function openResult(job: PhoneJob) {
    if (!connection || working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const link = await createPhoneResultLink(
        connection,
        job.id,
        location.origin,
      );
      location.assign(link);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not open the private video link.",
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function disconnect() {
    if (!connection || working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await phoneRequest(connection.id, connection.token, "revoke", {
        method: "POST",
      });
      localStorage.removeItem(STORAGE);
      localStorage.removeItem(`${STORAGE}.pending`);
      sessionStorage.removeItem(`${STORAGE}.pairing`);
      setConnection(null);
      setJobs([]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not remove the connection.",
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background px-5 py-8 text-foreground">
      <div className="mx-auto max-w-lg space-y-7">
        <Link
          href="/"
          className="font-display text-2xl font-extrabold tracking-tight"
        >
          agent<span className="text-brand">cut</span>
        </Link>
        <div>
          <p className="mb-2 text-sm text-muted-foreground">
            Record here. Edit on your computer.
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Your next video starts here.
          </h1>
        </div>
        {!PHONE_API ? (
          <p role="status">Phone transfer is not configured on this site.</p>
        ) : pairing ? (
          <section className="space-y-4 rounded-xl border p-5">
            <h2 className="text-lg font-semibold">Connect this phone</h2>
            <p className="text-sm text-muted-foreground">
              This phone will be able to send videos and edit requests to your
              computer. You can remove the connection at any time.
            </p>
            <Button onClick={() => void pair()} disabled={busy}>
              Connect phone
            </Button>
          </section>
        ) : !connection ? (
          <section className="rounded-xl border p-5">
            <h2 className="font-semibold">Connect your computer first</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Open Agentcut on your computer. Select Phone, then scan the QR
              code. Keep the helper running.
            </p>
          </section>
        ) : (
          <>
            <section className="space-y-5 rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Send a video</h2>
                <button
                  className="text-sm text-muted-foreground underline"
                  disabled={busy}
                  onClick={() => void disconnect()}
                >
                  Disconnect
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`cursor-pointer rounded-lg border bg-primary px-3 py-4 text-center font-medium text-primary-foreground ${busy ? "pointer-events-none opacity-50" : ""}`}
                >
                  Record video
                  <input
                    aria-label="Record video"
                    type="file"
                    accept="video/*"
                    capture="environment"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                      select(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label
                  className={`cursor-pointer rounded-lg border px-3 py-4 text-center font-medium ${busy ? "pointer-events-none opacity-50" : ""}`}
                >
                  Choose video
                  <input
                    aria-label="Choose video"
                    type="file"
                    accept="video/*"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                      select(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {file ? (
                <p className="break-all text-sm">
                  {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              ) : null}
              <label className="block space-y-2 text-sm font-medium">
                <span>
                  Edit instructions{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </span>
                <textarea
                  value={prompt}
                  maxLength={6000}
                  disabled={busy}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    localStorage.setItem(`${STORAGE}.prompt`, e.target.value);
                  }}
                  rows={4}
                  className="w-full resize-y rounded-lg border bg-background p-3"
                  placeholder="Make a 30-second vertical video with captions."
                />
              </label>
              <p className="text-xs text-muted-foreground">
                With no instructions, Agentcut removes long pauses and mistakes
                and keeps the original format.
              </p>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={auto}
                  disabled={busy}
                  className="mt-1"
                  onChange={(e) => {
                    setAuto(e.target.checked);
                    localStorage.setItem(
                      `${STORAGE}.auto`,
                      String(e.target.checked),
                    );
                  }}
                />
                <span>
                  Send and edit automatically when I choose or finish a video.
                  Use the instructions above.
                </span>
              </label>
              <Button
                className="w-full"
                disabled={!file || busy}
                onClick={() => file && void send(file)}
              >
                {busy ? "Transfer in progress…" : "Send and edit"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Up to 1 GB. Keep this page open during transfer. Your computer
                can receive the video when it reconnects, for up to 3 days.
              </p>
            </section>
            {busy ? (
              <div role="status" className="space-y-2">
                <p className="text-sm">Transfer: {progress}%</p>
                <progress
                  className="w-full"
                  value={progress}
                  max={100}
                  aria-label="Transfer progress"
                />
              </div>
            ) : null}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Your videos</h2>
              {jobs.length ? (
                [...jobs].reverse().map((job) => (
                  <article key={job.id} className="rounded-lg border p-4">
                    <p className="text-sm font-medium">
                      {job.resultDeleted
                        ? "Online video deleted"
                        : LABELS[job.stage]}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(job.created).toLocaleString()} · Expires{" "}
                      {new Date(job.created + PHONE_TTL).toLocaleDateString()}
                    </p>
                    {job.stage === "uploading" ? (
                      <p className="mt-2 text-sm">
                        Choose the same file again to retry the upload.
                      </p>
                    ) : null}
                    {job.stage === "done" && !job.resultDeleted ? (
                      <Button
                        variant="outline"
                        className="mt-3"
                        disabled={busy}
                        onClick={() => void openResult(job)}
                      >
                        Open video
                      </Button>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your videos will appear here after you send them.
                </p>
              )}
            </section>
          </>
        )}
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
}
