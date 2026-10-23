"use client";

import { useEffect, useRef, useState } from "react";
import { Circle, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportStamp, uploadToProject } from "@/lib/studio/export";
import type { Take, TakeRecorder } from "@/lib/studio/recorder";

type Phase =
  | "idle"
  | "countdown"
  | "recording"
  | "finishing"
  | "review"
  | "saving";

/** A short countdown tick, quiet and over before the take starts (the mic hears it, the clip doesn't). */
function beep(context: AudioContext, frequency: number) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  const t = context.currentTime;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  osc.connect(gain).connect(context.destination);
  osc.start(t);
  osc.stop(t + 0.16);
}

function clock(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Recorder({
  open,
  onOpenChange,
  slug,
  frame,
  disabled,
  onAdd,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  slug: string;
  /** The project's shape, drawn as a guide over the camera. */
  frame: { width: number; height: number };
  disabled: boolean;
  onAdd(path: string, take: { seconds: number; startSeconds: number }): Promise<void>;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<(Take & { url: string }) | null>(null);
  const [error, setError] = useState("");
  const previewRef = useRef<HTMLVideoElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<TakeRecorder | null>(null);
  const countdownRef = useRef(0);
  const live = phase === "countdown" || phase === "recording";

  // The camera is on only while the dialog is open (and off during review).
  const cameraWanted = open && phase !== "review" && phase !== "saving";
  useEffect(() => {
    if (!cameraWanted) return;
    let cancelled = false;
    let opened: MediaStream | null = null;
    void (async () => {
      try {
        const { openCamera, listDevices } = await import(
          "@/lib/studio/recorder"
        );
        opened = await openCamera({
          videoDeviceId: cameraId || undefined,
          audioDeviceId: micId || undefined,
        });
        if (cancelled) {
          opened.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(opened);
        setError("");
        const devices = await listDevices();
        if (cancelled) return;
        setCameras(devices.cameras);
        setMics(devices.mics);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Camera access is blocked. Allow the camera and microphone for this site in your browser, then reopen Record."
            : e instanceof DOMException && e.name === "NotFoundError"
              ? "No camera or microphone found."
              : `Couldn't open the camera: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    })();
    return () => {
      cancelled = true;
      opened?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [cameraWanted, cameraId, micId]);

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = stream;
  }, [stream]);

  // Mic level, drawn straight to the meter (no re-renders).
  useEffect(() => {
    if (!stream?.getAudioTracks().length) return;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    let raf = 0;
    const draw = () => {
      analyser.getFloatTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v));
      const db = 20 * Math.log10(peak || 1e-6);
      const level = Math.min(1, Math.max(0, (db + 60) / 60));
      if (meterRef.current) meterRef.current.style.width = `${level * 100}%`;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      void context.close();
    };
  }, [stream]);

  useEffect(() => {
    if (phase !== "recording") return;
    const started = performance.now();
    const timer = setInterval(
      () => setElapsed((performance.now() - started) / 1000),
      250,
    );
    return () => clearInterval(timer);
  }, [phase]);

  // Closing the dialog throws away a take in progress.
  useEffect(
    () => () => {
      countdownRef.current += 1;
      void recorderRef.current?.discard().catch(() => undefined);
      recorderRef.current = null;
    },
    [],
  );

  async function record() {
    if (!stream) return;
    setError("");
    setElapsed(0);
    const run = ++countdownRef.current;
    setCount(3);
    setPhase("countdown");
    try {
      // Start encoding now: the encoder warms up during the countdown instead of freezing the
      // first seconds of the take. The take starts where the countdown ends.
      const { startRecording } = await import("@/lib/studio/recorder");
      const recorder = await startRecording(stream, (e) => {
        setError(`Recording failed: ${e.message}`);
        void discard();
      });
      if (countdownRef.current !== run) {
        void recorder.discard().catch(() => undefined);
        return;
      }
      recorderRef.current = recorder;
      const sound = new AudioContext();
      try {
        for (let n = 3; n > 0; n -= 1) {
          setCount(n);
          beep(sound, n === 1 ? 1320 : 880);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (countdownRef.current !== run) return;
        }
      } finally {
        void sound.close();
      }
      recorder.markStart();
      setPhase("recording");
    } catch (e) {
      setError(`Couldn't start recording: ${e instanceof Error ? e.message : String(e)}`);
      setPhase("idle");
    }
  }

  async function stop() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    setPhase("finishing");
    try {
      const result = await recorder.stop();
      setTake({ ...result, url: URL.createObjectURL(result.blob) });
      setPhase("review");
    } catch (e) {
      setError(`Couldn't finish the recording: ${e instanceof Error ? e.message : String(e)}`);
      setPhase("idle");
    }
  }

  /** Stop the countdown or recording and throw it away, ready to go again. */
  async function discard() {
    countdownRef.current += 1;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setPhase("idle");
    setElapsed(0);
    await recorder?.discard().catch(() => undefined);
  }

  function retake() {
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
    setPhase("idle");
  }

  async function keepTake() {
    if (!take) return;
    setPhase("saving");
    setError("");
    try {
      const path = await uploadToProject(
        slug,
        `assets/recordings/take-${exportStamp()}.${take.extension}`,
        take.blob,
      );
      await onAdd(path, take);
      URL.revokeObjectURL(take.url);
      setTake(null);
      setPhase("idle");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("review");
    }
  }

  const vertical = frame.height > frame.width;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && live) void discard();
        onOpenChange(next);
      }}
    >
      <DialogContent className="gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record</DialogTitle>
          <DialogDescription>
            Talk to the camera. The take goes on your timeline, ready to edit.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
          {phase === "review" || phase === "saving" ? (
            <video
              key={take?.url}
              src={take?.url}
              onLoadedMetadata={(e) => {
                // Skip the countdown that was recorded to warm the encoder.
                if (take) e.currentTarget.currentTime = take.startSeconds;
              }}
              controls
              autoPlay
              playsInline
              className="size-full"
              aria-label="Your take"
            />
          ) : (
            <>
              <video
                ref={previewRef}
                autoPlay
                muted
                playsInline
                className="size-full -scale-x-100 object-cover"
                aria-label="Camera preview"
              />
              {vertical && (
                // What a vertical video keeps; the rest is dimmed.
                <div
                  className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 border-x border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                  style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
                />
              )}
              {phase === "countdown" && (
                <div className="absolute inset-0 flex items-center justify-center text-7xl font-black text-white drop-shadow-lg">
                  {count}
                </div>
              )}
              {phase === "recording" && (
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white tabular-nums">
                  <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
                  {clock(elapsed)}
                </div>
              )}
              {phase === "finishing" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
                  Finishing the take…
                </div>
              )}
            </>
          )}
        </div>

        {phase !== "review" && phase !== "saving" && (
          <div className="flex items-center gap-2 text-xs">
            <select
              aria-label="Camera"
              className="min-w-0 flex-1 truncate rounded-md border bg-background p-1.5"
              value={cameraId || stream?.getVideoTracks()[0]?.getSettings().deviceId || ""}
              disabled={live}
              onChange={(e) => setCameraId(e.target.value)}
            >
              {cameras.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
            <select
              aria-label="Microphone"
              className="min-w-0 flex-1 truncate rounded-md border bg-background p-1.5"
              value={micId || stream?.getAudioTracks()[0]?.getSettings().deviceId || ""}
              disabled={live}
              onChange={(e) => setMicId(e.target.value)}
            >
              {mics.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${i + 1}`}
                </option>
              ))}
            </select>
            <div
              className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted"
              title="Mic level"
            >
              <div ref={meterRef} className="h-full w-0 bg-emerald-500" />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          {phase === "idle" && (
            <Button disabled={disabled || !stream} onClick={() => void record()}>
              <Circle className="fill-red-500 text-red-500" /> Record
            </Button>
          )}
          {live && (
            <>
              <Button variant="outline" onClick={() => void discard()}>
                <Trash2 /> Discard
              </Button>
              <Button
                disabled={phase !== "recording"}
                onClick={() => void stop()}
              >
                <Square className="fill-current" /> Stop
              </Button>
            </>
          )}
          {(phase === "review" || phase === "saving") && (
            <>
              <Button
                variant="outline"
                className="mr-auto"
                disabled={phase === "saving"}
                onClick={retake}
              >
                Retake
              </Button>
              <Button
                disabled={disabled || phase === "saving"}
                onClick={() => void keepTake()}
              >
                {phase === "saving" ? "Saving…" : "Use take"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
