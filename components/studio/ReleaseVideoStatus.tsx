"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { StudioBridge } from "@/lib/studio/bridge";

interface Job {
  id: string;
  slug: string;
  stage: string;
  detail: string;
  error?: string;
  updatedAt: number;
}

export function ReleaseVideoStatus({
  slug,
  bridge,
}: {
  slug: string | null;
  bridge: StudioBridge | null;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    const off = bridge.on("studio.release", (data) => {
      const job = data as Job;
      setJobs((previous) => [
        ...previous.filter((item) => item.id !== job.id),
        job,
      ]);
    });
    void bridge
      .request<Job[]>("studio.release.list")
      .then((result) => {
        if (active)
          setJobs((previous) => {
            const merged = new Map(result.map((job) => [job.id, job]));
            for (const job of previous)
              if (
                !merged.has(job.id) ||
                merged.get(job.id)!.updatedAt < job.updatedAt
              )
                merged.set(job.id, job);
            return [...merged.values()];
          });
      })
      .catch(() => {}); // Older helpers do not support release jobs.
    return () => {
      active = false;
      off();
    };
  }, [bridge]);
  const job = jobs
    .filter((item) => item.slug === slug)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!job) return null;
  const done = ["ready", "failed", "cancelled"].includes(job.stage);
  const act = async (method: string) => {
    if (!bridge) return;
    setBusy(true);
    setError(null);
    try {
      const result = await bridge.request<Job>(
        method,
        { job: job.id },
        120_000,
      );
      setJobs((previous) => [
        ...previous.filter((item) => item.id !== result.id),
        result,
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-3 border-y bg-background px-4 py-2 text-sm"
      aria-live="polite"
    >
      <span className="font-medium">Announcement video</span>
      <span className="min-w-0 flex-1 text-muted-foreground">
        {error || job.error || job.detail}
      </span>
      {job.stage === "login_needed" || job.stage === "failed" ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void act("studio.release.resume")}
        >
          {job.stage === "failed" ? "Retry video" : "I am ready. Continue"}
        </Button>
      ) : null}
      {!done ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void act("studio.release.cancel")}
        >
          Cancel video
        </Button>
      ) : null}
    </div>
  );
}
