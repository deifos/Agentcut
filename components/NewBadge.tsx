"use client";

import { useEffect, useState } from "react";

/**
 * Central registry of "NEW" feature-badge expirations.
 *
 * To add a badge for a new feature:
 *   1. Add an entry below with an ISO date ~48h after the feature ships.
 *   2. Reference via <NewBadge feature="..." /> or useNewBadge("...").
 *
 * The expiration is global — everyone stops seeing the badge at the same
 * instant regardless of cache state. Adjust by redeploying.
 */
const NEW_FEATURE_EXPIRES_AT = {
  "studio-codex": new Date("2026-10-27T23:59:59Z").getTime(),
  "motion-components-pack-2026-10": new Date("2026-10-28T23:59:59Z").getTime(),
  "studio-styles": new Date("2026-10-28T23:59:59Z").getTime(),
} as const;

export type NewFeatureKey = keyof typeof NEW_FEATURE_EXPIRES_AT;

/**
 * Returns true while the given feature's badge window is active.
 * Schedules a one-shot timer to flip to false at the expiration moment, so
 * a long-lived tab transitions out of "NEW" without needing a refresh.
 */
export function useNewBadge(feature: NewFeatureKey): boolean {
  const expiresAt = NEW_FEATURE_EXPIRES_AT[feature];
  const [show, setShow] = useState(() => Date.now() < expiresAt);
  useEffect(() => {
    const remaining = expiresAt - Date.now();
    // Already expired: lazy init already seeded `show = false`, nothing to do.
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setShow(false), remaining);
    return () => window.clearTimeout(timer);
  }, [expiresAt]);
  return show;
}

interface NewBadgeProps {
  feature: NewFeatureKey;
  /** Tailwind class for background color. Defaults to `bg-primary`. */
  className?: string;
  /** Text inside the chip. Defaults to "NEW". */
  label?: string;
}

/**
 * Compact "NEW" chip. Renders nothing after the configured expiration.
 * Put it inline anywhere — usage is position-agnostic; parent controls layout.
 */
export function NewBadge({ feature, className, label = "NEW" }: NewBadgeProps) {
  const show = useNewBadge(feature);
  if (!show) return null;
  return (
    <span
      className={`px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white rounded-sm shrink-0 ${className ?? "bg-primary"}`}
    >
      {label}
    </span>
  );
}
