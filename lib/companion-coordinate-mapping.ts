import type {
  CompanionCaptureSettingsSnapshot,
  CompanionCursorSample,
  CompanionDisplay,
  CompanionRecordingTelemetry,
  CompanionStatusResponse,
} from "@/lib/companion-protocol";

export type CompanionCaptureMappingIssue =
  | "ambiguous-display-match"
  | "full-display-required"
  | "missing-capture-size"
  | "missing-companion-status"
  | "missing-display-match";

export interface CompanionVideoPoint {
  x: number;
  y: number;
  displayId: string;
  displayLabel: string;
  confidence: number;
  sampleTimestampMs: number;
  sampleAgeMs?: number;
  screenX: number;
  screenY: number;
  interpolated?: boolean;
}

export type CompanionTelemetryQuality = "blocked" | "warning" | "ready";

export interface CompanionTelemetrySummary {
  sampleCount: number;
  durationMs: number;
  firstSampleTimestampMs: number | null;
  lastSampleTimestampMs: number | null;
  averageSampleIntervalMs: number | null;
  maxSampleGapMs: number | null;
  sampleRateHz: number | null;
  coveragePercent: number | null;
  captureLatencyMs: number | null;
  captureLatencySampleCount: number;
  mappingIssue: CompanionCaptureMappingIssue | null;
  mappingIssueLabel: string | null;
  capturedDisplayId: string | null;
  capturedDisplayLabel: string | null;
  displayMatchConfidence: number | null;
  quality: CompanionTelemetryQuality;
  qualityLabel: string;
}

// Cursor samples further than this from the target time are considered stale;
// gaps wider than this are not interpolated across.
const CURSOR_SAMPLE_MAX_AGE_MS = 250;
// Click press/release animation timing for the companion cursor.
const CURSOR_PRESS_DURATION_MS = 70;
const CURSOR_RELEASE_DURATION_MS = 220;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getDisplayPhysicalSize(display: CompanionDisplay) {
  const scaleFactor = display.scaleFactor || 1;
  return {
    width: display.bounds.width * scaleFactor,
    height: display.bounds.height * scaleFactor,
  };
}

function dimensionsMatchScore(
  display: CompanionDisplay,
  captureSettings: CompanionCaptureSettingsSnapshot,
): number {
  if (!captureSettings.width || !captureSettings.height) return 0;

  const physical = getDisplayPhysicalSize(display);
  const directDelta =
    Math.abs(physical.width - captureSettings.width) +
    Math.abs(physical.height - captureSettings.height);
  const swappedDelta =
    Math.abs(physical.width - captureSettings.height) +
    Math.abs(physical.height - captureSettings.width);
  const delta = Math.min(directDelta, swappedDelta);
  const baseline = Math.max(captureSettings.width, captureSettings.height, 1);

  return Math.max(0, 1 - delta / baseline);
}

function getSizeAspectRatio(size: { width: number; height: number }) {
  return size.height > 0 ? size.width / size.height : 0;
}

function isPlausibleScaledCapture(
  display: CompanionDisplay,
  captureSettings: CompanionCaptureSettingsSnapshot,
): boolean {
  if (!captureSettings.width || !captureSettings.height) return false;

  const physical = getDisplayPhysicalSize(display);
  const displayAspectRatio = getSizeAspectRatio(physical);
  const captureAspectRatio = getSizeAspectRatio({
    width: captureSettings.width,
    height: captureSettings.height,
  });
  const aspectDelta = Math.abs(displayAspectRatio - captureAspectRatio);
  const captureFitsInsideDisplay =
    captureSettings.width <= physical.width + 2 &&
    captureSettings.height <= physical.height + 2;

  return aspectDelta < 0.015 && captureFitsInsideDisplay;
}

function hasAmbiguousDisplayMatch(
  displays: CompanionDisplay[],
  captureSettings: CompanionCaptureSettingsSnapshot,
  matchedDisplay: CompanionDisplay,
): boolean {
  if (captureSettings.source === "native" || captureSettings.displayId) {
    return false;
  }
  if (!captureSettings.width || !captureSettings.height) return false;

  return displays.some(
    (display) =>
      display.id !== matchedDisplay.id &&
      isPlausibleScaledCapture(display, captureSettings),
  );
}

export function findCapturedCompanionDisplay(
  displays: CompanionDisplay[],
  captureSettings: CompanionCaptureSettingsSnapshot | null,
): CompanionDisplay | null {
  if (displays.length === 0) return null;
  if (captureSettings?.displayId) {
    const matchedDisplay = displays.find(
      (display) => display.id === captureSettings.displayId,
    );
    if (matchedDisplay) return matchedDisplay;
  }
  if (!captureSettings?.width || !captureSettings.height) {
    return displays.find((display) => display.isPrimary) ?? displays[0] ?? null;
  }

  const plausibleScaledDisplays = displays.filter((display) =>
    isPlausibleScaledCapture(display, captureSettings),
  );
  if (plausibleScaledDisplays.length === 1) {
    return plausibleScaledDisplays[0] ?? null;
  }

  let best: { display: CompanionDisplay; score: number } | null = null;
  for (const display of displays) {
    const score = dimensionsMatchScore(display, captureSettings);
    if (!best || score > best.score) {
      best = { display, score };
    }
  }

  return best?.display ?? displays[0] ?? null;
}

export function getCompanionCaptureMappingIssue({
  status,
  captureSettings,
}: {
  status: CompanionStatusResponse | null | undefined;
  captureSettings: CompanionCaptureSettingsSnapshot | null | undefined;
}): CompanionCaptureMappingIssue | null {
  if (!status) return "missing-companion-status";
  if (!captureSettings?.width || !captureSettings.height) {
    return "missing-capture-size";
  }
  if (
    captureSettings.displaySurface &&
    captureSettings.displaySurface !== "monitor"
  ) {
    return "full-display-required";
  }
  const capturedDisplay = findCapturedCompanionDisplay(
    status.displays,
    captureSettings,
  );
  if (!capturedDisplay) return "missing-display-match";
  if (
    hasAmbiguousDisplayMatch(status.displays, captureSettings, capturedDisplay)
  ) {
    return "ambiguous-display-match";
  }
  if (
    dimensionsMatchScore(capturedDisplay, captureSettings) < 0.92 &&
    !isPlausibleScaledCapture(capturedDisplay, captureSettings)
  ) {
    return "missing-display-match";
  }

  return null;
}

export function getCompanionCaptureMappingIssueLabel(
  issue: CompanionCaptureMappingIssue | null,
): string | null {
  switch (issue) {
    case "ambiguous-display-match":
      return "Capture size is ambiguous across displays.";
    case "full-display-required":
      return "Companion cursor calibration needs a full-display capture.";
    case "missing-capture-size":
      return "Waiting for capture dimensions.";
    case "missing-companion-status":
      return "Waiting for companion display details.";
    case "missing-display-match":
      return "Capture size does not match a companion display.";
    default:
      return null;
  }
}

export function mapCompanionCursorSampleToVideoPoint({
  sample,
  status,
  captureSettings,
}: {
  sample: CompanionCursorSample | null | undefined;
  status: CompanionStatusResponse | null | undefined;
  captureSettings: CompanionCaptureSettingsSnapshot | null | undefined;
}): CompanionVideoPoint | null {
  if (!sample) return null;
  if (getCompanionCaptureMappingIssue({ status, captureSettings })) return null;
  if (!status || !captureSettings?.width || !captureSettings.height) {
    return null;
  }

  const capturedDisplay = findCapturedCompanionDisplay(
    status.displays,
    captureSettings,
  );
  if (!capturedDisplay || sample.displayId !== capturedDisplay.id) return null;

  const localX = sample.screenX - capturedDisplay.bounds.x;
  const localY = sample.screenY - capturedDisplay.bounds.y;
  const width = Math.max(capturedDisplay.bounds.width, 1);
  const height = Math.max(capturedDisplay.bounds.height, 1);

  if (localX < 0 || localY < 0 || localX > width || localY > height) {
    return null;
  }

  return {
    x: (localX / width) * captureSettings.width,
    y: (localY / height) * captureSettings.height,
    displayId: capturedDisplay.id,
    displayLabel: capturedDisplay.label,
    confidence: dimensionsMatchScore(capturedDisplay, captureSettings),
    sampleTimestampMs: sample.timestampMs,
    screenX: sample.screenX,
    screenY: sample.screenY,
  };
}

type CaptureLatencySamples = NonNullable<
  CompanionRecordingTelemetry["clockSync"]["captureLatencySamples"]
>;

// getCompanionCaptureLatencyMs runs once per rendered frame; cache the
// finite-filtered samples per source array so the hot path doesn't allocate.
const finiteLatencySamplesCache = new WeakMap<
  CaptureLatencySamples,
  CaptureLatencySamples
>();

function getFiniteCaptureLatencySamples(
  rawSamples: CaptureLatencySamples | undefined,
): CaptureLatencySamples | undefined {
  if (!rawSamples) return undefined;
  let samples = finiteLatencySamplesCache.get(rawSamples);
  if (!samples) {
    samples = rawSamples.filter(
      (sample) =>
        Number.isFinite(sample.videoTimeMs) &&
        Number.isFinite(sample.captureLatencyMs),
    );
    finiteLatencySamplesCache.set(rawSamples, samples);
  }
  return samples;
}

function getCompanionCaptureLatencyMs(
  telemetry: CompanionRecordingTelemetry,
  timeMs: number,
): number {
  const samples = getFiniteCaptureLatencySamples(
    telemetry.clockSync.captureLatencySamples,
  );

  if (samples?.length) {
    let low = 0;
    let high = samples.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const sampleTime = samples[mid]?.videoTimeMs ?? 0;
      if (sampleTime <= timeMs) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const before = high >= 0 ? samples[high] : undefined;
    const after = low < samples.length ? samples[low] : undefined;
    if (before && after && after.videoTimeMs > before.videoTimeMs) {
      const ratio =
        (timeMs - before.videoTimeMs) /
        (after.videoTimeMs - before.videoTimeMs);
      return Math.max(
        0,
        before.captureLatencyMs +
          (after.captureLatencyMs - before.captureLatencyMs) * ratio,
      );
    }

    const nearest = before ?? after;
    if (nearest) return Math.max(0, nearest.captureLatencyMs);
  }

  const latency = telemetry.clockSync.captureLatencyMs;
  return typeof latency === "number" && Number.isFinite(latency)
    ? Math.max(0, latency)
    : 0;
}

export function getCompanionTelemetryTargetTimeMs(
  telemetry: CompanionRecordingTelemetry,
  timeMs: number,
): number {
  const videoStartOffsetMs = Math.max(
    0,
    telemetry.clockSync.videoStartOffsetMs ?? 0,
  );
  return (
    timeMs +
    videoStartOffsetMs -
    getCompanionCaptureLatencyMs(telemetry, timeMs)
  );
}

// Inverting getCompanionTelemetryTargetTimeMs has no closed form (capture
// latency varies over the recording), so binary-search for the video time
// whose target time lands on the companion timestamp.
const TELEMETRY_TIME_MATCH_TOLERANCE_MS = 300;

export function findVideoTimeForCompanionTimestampMs({
  telemetry,
  durationMs,
  companionTimestampMs,
}: {
  telemetry: CompanionRecordingTelemetry;
  durationMs: number;
  companionTimestampMs: number;
}): number | null {
  if (durationMs <= 0 || !Number.isFinite(companionTimestampMs)) return null;

  let low = 0;
  let high = durationMs;
  for (let index = 0; index < 24; index += 1) {
    const mid = (low + high) / 2;
    const targetTimeMs = getCompanionTelemetryTargetTimeMs(telemetry, mid);
    if (targetTimeMs < companionTimestampMs) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const videoTimeMs = (low + high) / 2;
  const targetTimeMs = getCompanionTelemetryTargetTimeMs(
    telemetry,
    videoTimeMs,
  );
  return Math.abs(targetTimeMs - companionTimestampMs) <=
    TELEMETRY_TIME_MATCH_TOLERANCE_MS
    ? clamp(videoTimeMs, 0, durationMs)
    : null;
}

export function getCompanionCursorPressAmountAtTime(
  telemetry: CompanionRecordingTelemetry | null | undefined,
  timeMs: number,
): number {
  if (!telemetry || telemetry.inputEvents.length === 0) return 0;

  const targetTimeMs = getCompanionTelemetryTargetTimeMs(telemetry, timeMs);
  let amount = 0;

  for (let index = telemetry.inputEvents.length - 1; index >= 0; index -= 1) {
    const event = telemetry.inputEvents[index];
    if (
      event.button !== undefined &&
      event.button !== "left" &&
      event.type !== "scroll"
    ) {
      continue;
    }

    const deltaMs = targetTimeMs - event.timestampMs;
    if (deltaMs < 0) continue;

    if (event.type === "mousedown") {
      amount = Math.max(
        amount,
        Math.min(1, deltaMs / CURSOR_PRESS_DURATION_MS),
      );
      break;
    }

    if (event.type === "mouseup" || event.type === "click") {
      if (deltaMs > CURSOR_RELEASE_DURATION_MS) break;
      const release = Math.max(0, 1 - deltaMs / CURSOR_RELEASE_DURATION_MS);
      amount = Math.max(amount, release);
    }
  }

  return Math.max(0, Math.min(1, amount));
}

function getNearestSampleAgeMs({
  before,
  after,
  targetTimeMs,
}: {
  before: CompanionCursorSample | undefined;
  after: CompanionCursorSample | undefined;
  targetTimeMs: number;
}): number {
  const beforeAge = before
    ? Math.abs(before.timestampMs - targetTimeMs)
    : Number.POSITIVE_INFINITY;
  const afterAge = after
    ? Math.abs(after.timestampMs - targetTimeMs)
    : Number.POSITIVE_INFINITY;
  return Math.min(beforeAge, afterAge);
}

function getInterpolatedCursorSample({
  before,
  after,
  targetTimeMs,
}: {
  before: CompanionCursorSample | undefined;
  after: CompanionCursorSample | undefined;
  targetTimeMs: number;
}): { sample: CompanionCursorSample | null; interpolated: boolean } {
  if (!before && !after) return { sample: null, interpolated: false };
  if (!before || !after || before.timestampMs === after.timestampMs) {
    return { sample: before ?? after ?? null, interpolated: false };
  }

  const nearest =
    Math.abs(before.timestampMs - targetTimeMs) <=
    Math.abs(after.timestampMs - targetTimeMs)
      ? before
      : after;

  const gapMs = after.timestampMs - before.timestampMs;
  const canInterpolate =
    gapMs > 0 &&
    gapMs <= CURSOR_SAMPLE_MAX_AGE_MS &&
    targetTimeMs >= before.timestampMs &&
    targetTimeMs <= after.timestampMs &&
    before.displayId === after.displayId;

  if (!canInterpolate) return { sample: nearest, interpolated: false };

  const ratio = (targetTimeMs - before.timestampMs) / gapMs;
  return {
    sample: {
      type: "cursor",
      timestampMs: targetTimeMs,
      displayId: before.displayId,
      screenX: before.screenX + (after.screenX - before.screenX) * ratio,
      screenY: before.screenY + (after.screenY - before.screenY) * ratio,
      cursorKind:
        before.cursorKind === after.cursorKind ? before.cursorKind : "unknown",
    },
    interpolated: true,
  };
}

export function getCompanionCursorPointAtTime(
  telemetry: CompanionRecordingTelemetry | null | undefined,
  timeMs: number,
): CompanionVideoPoint | null {
  if (!telemetry || telemetry.cursorSamples.length === 0) return null;

  const samples = telemetry.cursorSamples;
  const targetTimeMs = getCompanionTelemetryTargetTimeMs(telemetry, timeMs);
  let low = 0;
  let high = samples.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const sampleTime = samples[mid]?.timestampMs ?? 0;
    if (sampleTime <= targetTimeMs) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const before = high >= 0 ? samples[high] : undefined;
  const after = low < samples.length ? samples[low] : undefined;
  const sampleAgeMs = getNearestSampleAgeMs({
    before,
    after,
    targetTimeMs,
  });

  if (!Number.isFinite(sampleAgeMs) || sampleAgeMs > CURSOR_SAMPLE_MAX_AGE_MS)
    return null;

  const { sample, interpolated } = getInterpolatedCursorSample({
    before,
    after,
    targetTimeMs,
  });
  if (!sample) return null;

  const point = mapCompanionCursorSampleToVideoPoint({
    sample,
    status: telemetry.status,
    captureSettings: telemetry.captureSettings,
  });
  return point ? { ...point, sampleAgeMs, interpolated } : null;
}

export function getCompanionTelemetrySummary(
  telemetry: CompanionRecordingTelemetry | null | undefined,
): CompanionTelemetrySummary | null {
  if (!telemetry) return null;

  const sampleCount = telemetry.cursorSamples.length;
  const durationMs = Math.max(0, telemetry.durationMs || 0);
  const mappingIssue = getCompanionCaptureMappingIssue({
    status: telemetry.status,
    captureSettings: telemetry.captureSettings,
  });
  const mappingIssueLabel = getCompanionCaptureMappingIssueLabel(mappingIssue);
  const capturedDisplay =
    telemetry.status && telemetry.captureSettings
      ? findCapturedCompanionDisplay(
          telemetry.status.displays,
          telemetry.captureSettings,
        )
      : null;
  const displayMatchConfidence =
    capturedDisplay && telemetry.captureSettings
      ? dimensionsMatchScore(capturedDisplay, telemetry.captureSettings)
      : null;
  const captureLatencyMs =
    typeof telemetry.clockSync.captureLatencyMs === "number" &&
    Number.isFinite(telemetry.clockSync.captureLatencyMs)
      ? Math.max(0, telemetry.clockSync.captureLatencyMs)
      : null;
  const captureLatencySampleCount =
    telemetry.clockSync.captureLatencySamples?.length ?? 0;
  const isNativeCursorFreeCapture =
    telemetry.captureSettings?.source === "native" &&
    telemetry.captureSettings.cursorIncludedInVideo === false;

  let firstSampleTimestampMs: number | null = null;
  let lastSampleTimestampMs: number | null = null;
  let averageSampleIntervalMs: number | null = null;
  let maxSampleGapMs: number | null = null;
  let sampleRateHz: number | null = null;
  let coveragePercent: number | null = null;

  if (sampleCount > 0) {
    firstSampleTimestampMs = telemetry.cursorSamples[0]?.timestampMs ?? null;
    lastSampleTimestampMs =
      telemetry.cursorSamples[sampleCount - 1]?.timestampMs ?? null;
  }

  if (
    sampleCount > 1 &&
    firstSampleTimestampMs !== null &&
    lastSampleTimestampMs !== null
  ) {
    let totalGapMs = 0;
    let largestGapMs = 0;
    let validGapCount = 0;

    for (let index = 1; index < sampleCount; index += 1) {
      const previous = telemetry.cursorSamples[index - 1];
      const current = telemetry.cursorSamples[index];
      if (!previous || !current) continue;

      const gapMs = Math.max(0, current.timestampMs - previous.timestampMs);
      totalGapMs += gapMs;
      largestGapMs = Math.max(largestGapMs, gapMs);
      validGapCount += 1;
    }

    if (validGapCount > 0) {
      averageSampleIntervalMs = totalGapMs / validGapCount;
      maxSampleGapMs = largestGapMs;
      sampleRateHz =
        averageSampleIntervalMs > 0 ? 1000 / averageSampleIntervalMs : null;
    }

    const sampledRangeMs = Math.max(
      0,
      lastSampleTimestampMs - firstSampleTimestampMs,
    );
    coveragePercent =
      durationMs > 0
        ? Math.min(100, (sampledRangeMs / durationMs) * 100)
        : null;
  }

  let quality: CompanionTelemetryQuality = "ready";
  let qualityLabel = telemetry.visualCalibration
    ? "Automated visual calibration passed."
    : isNativeCursorFreeCapture
      ? "Native cursor-free recording ready for synthetic cursor."
      : "Ready for visual alignment check.";

  if (mappingIssueLabel) {
    quality = "blocked";
    qualityLabel = mappingIssueLabel;
  } else if (
    telemetry.captureSettings?.cursor === "never" &&
    telemetry.captureSettings.source !== "native"
  ) {
    quality = "blocked";
    qualityLabel =
      "Capture did not include the OS cursor, so the few-pixel replay check cannot be verified.";
  } else if (sampleCount < 2) {
    quality = "blocked";
    qualityLabel = "Companion replay needs at least two cursor samples.";
  } else if (telemetry.visualCalibration?.p95ErrorPx !== undefined) {
    if (
      telemetry.visualCalibration.p95ErrorPx > 5 ||
      telemetry.visualCalibration.maxErrorPx > 12
    ) {
      quality = "warning";
      qualityLabel =
        "Automated visual calibration is above the few-pixel target.";
    }
  } else if (sampleRateHz !== null && sampleRateHz < 45) {
    quality = "warning";
    qualityLabel = "Cursor telemetry is below the 60 Hz target.";
  } else if (maxSampleGapMs !== null && maxSampleGapMs > 150) {
    quality = "warning";
    qualityLabel = "Cursor telemetry has a large timing gap.";
  } else if (coveragePercent !== null && coveragePercent < 80) {
    quality = "warning";
    qualityLabel = "Cursor telemetry covers only part of the recording.";
  }

  return {
    sampleCount,
    durationMs,
    firstSampleTimestampMs,
    lastSampleTimestampMs,
    averageSampleIntervalMs,
    maxSampleGapMs,
    sampleRateHz,
    coveragePercent,
    captureLatencyMs,
    captureLatencySampleCount,
    mappingIssue,
    mappingIssueLabel,
    capturedDisplayId: capturedDisplay?.id ?? null,
    capturedDisplayLabel: capturedDisplay?.label ?? null,
    displayMatchConfidence,
    quality,
    qualityLabel,
  };
}

function formatReportNumber(value: number | null, digits = 1): string {
  return value === null ? "n/a" : value.toFixed(digits);
}

function formatReportPercent(value: number | null): string {
  return value === null ? "n/a" : `${Math.round(value)}%`;
}

export function buildCompanionCalibrationReport(
  telemetry: CompanionRecordingTelemetry | null | undefined,
): string | null {
  const summary = getCompanionTelemetrySummary(telemetry);
  if (!telemetry || !summary) return null;

  const capture = telemetry.captureSettings;
  const clockSync = telemetry.clockSync;
  const matchedDisplay = summary.capturedDisplayId
    ? telemetry.status.displays.find(
        (display) => display.id === summary.capturedDisplayId,
      )
    : null;
  const displayBounds = matchedDisplay
    ? `${matchedDisplay.bounds.x},${matchedDisplay.bounds.y} ${matchedDisplay.bounds.width}x${matchedDisplay.bounds.height} @${matchedDisplay.scaleFactor}x`
    : "n/a";
  const browserRoundTripMs = Math.max(
    0,
    clockSync.browserResponseMs - clockSync.browserRequestMs,
  );
  const visualCalibration = telemetry.visualCalibration;

  const report = [
    "ScreenSlick Companion Calibration Report",
    `Generated: ${new Date().toISOString()}`,
    `Recording ID: ${telemetry.recordingId}`,
    `Recorded at: ${telemetry.recordedAt}`,
    `Duration: ${Math.round(summary.durationMs)}ms`,
    "",
    "Capture",
    `Display surface: ${capture?.displaySurface ?? "unknown"}`,
    `Capture size: ${capture?.width ?? "unknown"}x${capture?.height ?? "unknown"}`,
    `Cursor capture setting: ${capture?.cursor ?? "unknown"}`,
    `Matched display: ${summary.capturedDisplayLabel ?? "n/a"} (${summary.capturedDisplayId ?? "n/a"})`,
    `Matched display bounds: ${displayBounds}`,
    `Display match confidence: ${formatReportPercent(
      summary.displayMatchConfidence === null
        ? null
        : summary.displayMatchConfidence * 100,
    )}`,
    "",
    "Clock sync",
    `t0 browser: ${formatReportNumber(clockSync.t0BrowserMs, 3)}ms`,
    `t0 companion: ${formatReportNumber(clockSync.t0CompanionMs, 3)}ms`,
    `Offset: ${formatReportNumber(clockSync.offsetMs, 3)}ms`,
    `Video start offset: ${formatReportNumber(clockSync.videoStartOffsetMs ?? null, 3)}ms`,
    `Capture latency correction: ${formatReportNumber(summary.captureLatencyMs, 3)}ms`,
    `Capture latency keyframes: ${summary.captureLatencySampleCount}`,
    `Browser request round trip: ${formatReportNumber(browserRoundTripMs, 3)}ms`,
    "",
    "Cursor telemetry",
    `Samples: ${summary.sampleCount}`,
    `Average sample rate: ${formatReportNumber(summary.sampleRateHz)}Hz`,
    `Average sample interval: ${formatReportNumber(
      summary.averageSampleIntervalMs,
    )}ms`,
    `Max sample gap: ${formatReportNumber(summary.maxSampleGapMs)}ms`,
    `Coverage: ${formatReportPercent(summary.coveragePercent)}`,
    `Quality: ${summary.quality} - ${summary.qualityLabel}`,
  ];

  if (visualCalibration) {
    report.push(
      "",
      "Automated visual calibration",
      `Verified at: ${visualCalibration.verifiedAt}`,
      `Cursor style: ${visualCalibration.cursorStyle}`,
      `Detected frames: ${visualCalibration.detectedFrameCount}`,
      `Best capture latency: ${formatReportNumber(visualCalibration.captureLatencyMs, 2)}ms`,
      `Cursor hotspot offset: ${formatReportNumber(visualCalibration.cursorHotspotOffsetX ?? null, 2)}, ${formatReportNumber(visualCalibration.cursorHotspotOffsetY ?? null, 2)}px`,
      `Median error: ${formatReportNumber(visualCalibration.medianErrorPx, 2)}px`,
      `P95 error: ${formatReportNumber(visualCalibration.p95ErrorPx, 2)}px`,
      `Max error: ${formatReportNumber(visualCalibration.maxErrorPx, 2)}px`,
    );
  }

  report.push(
    "",
    "Manual visual gate",
    "Pass only if the synthetic companion cursor tracks the baked-in OS cursor within a few pixels on a Windows full-display capture.",
    "Observed max offset px: ______",
    "Result: pass / fail",
  );

  return report.join("\n");
}
