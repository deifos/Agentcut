export const SCREEN_SLICK_COMPANION_PORT = 17373;
export const SCREEN_SLICK_COMPANION_HTTP_ORIGIN = `http://127.0.0.1:${SCREEN_SLICK_COMPANION_PORT}`;
export const SCREEN_SLICK_COMPANION_WS_ORIGIN = `ws://127.0.0.1:${SCREEN_SLICK_COMPANION_PORT}`;
const COMPANION_READ_RETRY_DELAYS_MS = [0, 150, 450, 900];

function getCompanionBridgeHost(): string {
  return "127.0.0.1";
}

function getCompanionHttpOrigin(): string {
  return `http://${getCompanionBridgeHost()}:${SCREEN_SLICK_COMPANION_PORT}`;
}

function getCompanionWsOrigin(): string {
  return `ws://${getCompanionBridgeHost()}:${SCREEN_SLICK_COMPANION_PORT}`;
}

const SESSION_TOKEN_KEY = "screenslick-companion-session-token";

export type CompanionConnectionState =
  | "checking"
  | "disconnected"
  | "pairing"
  | "connected"
  | "error";

export interface CompanionDisplay {
  id: string;
  label: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scaleFactor: number;
  isPrimary: boolean;
}

export interface CompanionStatusResponse {
  app: "screenslick-companion";
  version: string;
  paired: boolean;
  bridgeError?: string | null;
  capabilities: {
    cursorTelemetry: boolean;
    clickTelemetry: boolean;
    nativeRecording: boolean;
    systemAudio?: boolean;
  };
  displays: CompanionDisplay[];
}

// Latest released ScreenSlick Companion version. Bump together with the
// companion's Cargo.toml/tauri.conf.json so the studio can nudge users on
// older builds to update.
export const LATEST_COMPANION_VERSION = "0.3.11";

export function isCompanionVersionOutdated(
  version: string | null | undefined,
): boolean {
  if (!version) return false;
  const parse = (value: string) =>
    value.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const current = parse(version);
  const latest = parse(LATEST_COMPANION_VERSION);
  for (let i = 0; i < Math.max(current.length, latest.length); i += 1) {
    const currentPart = current[i] ?? 0;
    const latestPart = latest[i] ?? 0;
    if (currentPart < latestPart) return true;
    if (currentPart > latestPart) return false;
  }
  return false;
}

export interface CompanionPermissionsResponse {
  cursorTelemetry: "granted" | "unsupported";
  clickTelemetry: "granted" | "needs-permission" | "unsupported";
  nativeRecording: "granted" | "needs-permission" | "unsupported";
}

export interface CompanionCursorSample {
  type: "cursor";
  timestampMs: number;
  displayId: string;
  screenX: number;
  screenY: number;
  cursorKind?: "arrow" | "text" | "hand" | "resize" | "unknown";
}

export interface CompanionInputEvent {
  type: "click" | "mousedown" | "mouseup" | "scroll";
  timestampMs: number;
  displayId: string;
  screenX: number;
  screenY: number;
  button?: "left" | "right" | "middle";
  scrollDeltaY?: number;
}

export type CompanionTelemetryEvent =
  | CompanionCursorSample
  | CompanionInputEvent;

export interface CompanionPairRequestResponse {
  requestId: string;
  expiresAt: string;
}

export interface CompanionPairConfirmPending {
  status: "pending";
}

export interface CompanionPairConfirmApproved {
  status: "approved";
  token: string;
  expiresAt: string;
}

export type CompanionPairConfirmResponse =
  | CompanionPairConfirmPending
  | CompanionPairConfirmApproved;

export interface CompanionRecordingMarkStartResponse {
  recordingId: string;
  t0CompanionMs: number;
  markedAtUnixMs: number;
}
export interface CompanionCaptureSourceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompanionCaptureSource {
  id: string;
  label: string;
  sourceType: "display" | "window" | "region";
  displayId?: string | null;
  bounds: CompanionCaptureSourceBounds;
  physicalBounds: CompanionCaptureSourceBounds;
  cropPhysical?: CompanionCaptureSourceBounds | null;
  scaleFactor: number;
  isPrimary: boolean;
}

export interface CompanionNativeRecordingStartResponse {
  recordingId: string;
  source: CompanionCaptureSource;
  startedAtUnixMs: number;
  t0CompanionMs: number;
  cursorIncludedInVideo: boolean;
}

export interface CompanionNativeRecordingStopResponse {
  recordingId: string;
  fileUrl: string;
  packageId?: string | null;
  metadataUrl?: string | null;
  durationMs: number | null;
  stoppedAtUnixMs: number;
  mimeType: string;
}

export interface CompanionRecordingPackageMetadata {
  id: string;
  createdAt: string;
  createdAtUnixMs: number;
  durationMs: number | null;
  platform: string;
  companionVersion: string;
  screen: {
    displayId: string;
    label: string;
    captureMode?: "display" | "window" | "area";
    bounds: CompanionCaptureSourceBounds;
    physicalBounds: CompanionCaptureSourceBounds;
    scaleFactor: number;
    width: number;
    height: number;
    frameRate: number;
    cursorFree: boolean;
    file: string;
    mimeType: string;
  };
  camera?: {
    enabled: boolean;
    deviceId?: string | null;
    deviceName?: string | null;
    file?: string | null;
    mimeType?: string | null;
    width?: number | null;
    height?: number | null;
    frameRate?: number | null;
    startOffsetMs?: number | null;
    durationMs?: number | null;
  } | null;
  microphone?: {
    enabled: boolean;
    deviceId?: string | null;
    deviceName?: string | null;
    file?: string | null;
    mimeType?: string | null;
    startOffsetMs?: number | null;
    durationMs?: number | null;
  } | null;
  systemAudio?: {
    enabled: boolean;
    deviceId?: string | null;
    deviceName?: string | null;
    file?: string | null;
    mimeType?: string | null;
    startOffsetMs?: number | null;
    durationMs?: number | null;
  } | null;
  cursor: {
    file: string;
  };
  clicks: {
    file: string;
  };
  files: {
    screen: string;
    camera?: string | null;
    microphone?: string | null;
    systemAudio?: string | null;
    cursor: string;
    clicks: string;
    thumbnail?: string | null;
  };
  editorImportVersion: number;
}

export interface CompanionRecordingIndexEntry {
  id: string;
  createdAt: string;
  createdAtUnixMs: number;
  packagePath: string;
  durationMs: number | null;
  thumbnailPath?: string | null;
  sourceDisplayId?: string | null;
  sourceDisplayLabel?: string | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  hasScreen: boolean;
  hasCamera: boolean;
  hasMicrophone: boolean;
  hasSystemAudio?: boolean;
  hasCursor: boolean;
  hasClicks: boolean;
  openStatus: string;
}

export interface CompanionRecordingIndex {
  version: number;
  recordings: CompanionRecordingIndexEntry[];
}

export interface CompanionEditorSessionResponse {
  registered: boolean;
  sessionId: string;
  editorInstanceId: string;
  activeEditorCount: number;
  expiresInMs: number;
}

export interface CompanionEditorPendingRecording {
  packageId: string;
  queuedAtUnixMs: number;
}

export interface CompanionEditorPendingRecordingsResponse {
  recordings: CompanionEditorPendingRecording[];
}

export interface CompanionEditorPendingRecordingAckResponse {
  acknowledged: boolean;
  sessionId: string;
  packageId: string;
}

export function createNativeCaptureSettingsSnapshot(
  source: CompanionCaptureSource,
  cursorIncludedInVideo: boolean,
): CompanionCaptureSettingsSnapshot {
  return {
    source: "native",
    displayId: source.id,
    displayLabel: source.label,
    cursorIncludedInVideo,
    width: Math.round(source.physicalBounds.width),
    height: Math.round(source.physicalBounds.height),
    frameRate: 60,
    displaySurface: "monitor",
    logicalSurface: false,
    cursor: cursorIncludedInVideo ? "always" : "never",
  };
}

export interface CompanionCaptureSettingsSnapshot {
  source?: "browser" | "native";
  displayId?: string;
  displayLabel?: string;
  cursorIncludedInVideo?: boolean;
  width?: number;
  height?: number;
  frameRate?: number;
  displaySurface?: string;
  logicalSurface?: boolean;
  cursor?: string;
}

export interface CompanionCaptureLatencySample {
  videoTimeMs: number;
  captureLatencyMs: number;
  source?: "video-frame-metadata" | "visual-calibration";
}

export interface CompanionClockSync {
  t0BrowserMs: number;
  t0CompanionMs: number;
  browserRequestMs: number;
  browserResponseMs: number;
  offsetMs: number;
  videoStartOffsetMs?: number;
  captureLatencyMs?: number;
  captureLatencySamples?: CompanionCaptureLatencySample[];
}

export interface CompanionVisualCalibration {
  verifiedAt: string;
  cursorStyle: "calibration-cursor" | "system-cursor" | "system-crosshair";
  detectedFrameCount: number;
  captureLatencyMs: number;
  cursorHotspotOffsetX?: number;
  cursorHotspotOffsetY?: number;
  medianErrorPx: number;
  p95ErrorPx: number;
  maxErrorPx: number;
}

export interface CompanionRecordingTelemetry {
  version: 1;
  source: "screenslick-companion";
  recordingId: string;
  recordedAt: string;
  durationMs: number;
  status: CompanionStatusResponse;
  captureSettings: CompanionCaptureSettingsSnapshot | null;
  clockSync: CompanionClockSync;
  cursorSamples: CompanionCursorSample[];
  inputEvents: CompanionInputEvent[];
  visualCalibration?: CompanionVisualCalibration;
}

function getCompanionSessionTokenStorage(): Storage | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage;
}

export function readCompanionSessionToken(): string | null {
  try {
    return (
      getCompanionSessionTokenStorage()?.getItem(SESSION_TOKEN_KEY) ?? null
    );
  } catch {
    return null;
  }
}

export function writeCompanionSessionToken(token: string): void {
  try {
    getCompanionSessionTokenStorage()?.setItem(SESSION_TOKEN_KEY, token);
  } catch {}
}

export function clearCompanionSessionToken(): void {
  try {
    getCompanionSessionTokenStorage()?.removeItem(SESSION_TOKEN_KEY);
  } catch {}
}

function toCompanionUrl(path: string): string {
  return `${getCompanionHttpOrigin()}${path}`;
}

type CompanionFetchInit = RequestInit & {
  // Chromium Local Network Access uses this annotation for public HTTPS pages
  // that intentionally talk to a local/loopback companion service.
  targetAddressSpace?: "loopback";
};

function withCompanionLocalNetworkAccess(
  init: RequestInit = {},
): CompanionFetchInit {
  return {
    ...init,
    targetAddressSpace: "loopback",
  };
}

function fetchCompanion(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, withCompanionLocalNetworkAccess(init));
}

function getCompanionReadOrigins(): string[] {
  const origins = [getCompanionHttpOrigin()];
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    origins.push(`http://localhost:${SCREEN_SLICK_COMPANION_PORT}`);
  }
  return [...new Set(origins)];
}

function isAbortError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function fetchCompanionReadOnly(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const origins = getCompanionReadOrigins();
  let lastError: unknown = null;

  for (const delayMs of COMPANION_READ_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await wait(delayMs);
    }

    for (const origin of origins) {
      try {
        return await fetchCompanion(`${origin}${path}`, init);
      } catch (error) {
        if (isAbortError(error)) throw error;
        lastError = error;
      }
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Could not reach ScreenSlick Companion: ${detail}`);
}

function getAuthHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function getJsonAuthHeaders(token: string): HeadersInit {
  return {
    ...getAuthHeaders(token),
    "content-type": "application/json",
  };
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Companion request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchCompanionStatus(
  signal?: AbortSignal,
): Promise<CompanionStatusResponse> {
  const response = await fetchCompanionReadOnly("/status", {
    cache: "no-store",
    signal,
  });
  return readJsonResponse<CompanionStatusResponse>(response);
}

export async function showCompanionApp(): Promise<{ shown: boolean }> {
  const response = await fetchCompanion(toCompanionUrl("/app/show"), {
    method: "POST",
  });
  return readJsonResponse<{ shown: boolean }>(response);
}

export async function fetchCompanionPermissions(
  signal?: AbortSignal,
): Promise<CompanionPermissionsResponse> {
  const response = await fetchCompanionReadOnly("/permissions", {
    cache: "no-store",
    signal,
  });
  return readJsonResponse<CompanionPermissionsResponse>(response);
}

export async function requestCompanionPairing(): Promise<CompanionPairRequestResponse> {
  const response = await fetchCompanion(toCompanionUrl("/pair/request"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ origin: window.location.origin }),
  });
  return readJsonResponse<CompanionPairRequestResponse>(response);
}

export async function confirmCompanionPairing(
  requestId: string,
): Promise<CompanionPairConfirmResponse> {
  const response = await fetchCompanion(toCompanionUrl("/pair/confirm"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ requestId }),
  });
  return readJsonResponse<CompanionPairConfirmResponse>(response);
}

export async function fetchCompanionRecordingSources(
  token: string,
): Promise<CompanionCaptureSource[]> {
  const response = await fetchCompanionReadOnly("/recording/sources", {
    cache: "no-store",
    headers: getAuthHeaders(token),
  });
  return readJsonResponse<CompanionCaptureSource[]>(response);
}
export async function startCompanionNativeRecording(
  token: string,
  sourceId: string,
): Promise<CompanionNativeRecordingStartResponse> {
  const response = await fetchCompanion(toCompanionUrl("/recording/start"), {
    method: "POST",
    headers: getJsonAuthHeaders(token),
    body: JSON.stringify({ sourceId }),
  });
  return readJsonResponse<CompanionNativeRecordingStartResponse>(response);
}

export async function showCompanionRecordingTargetOverlay(
  token: string,
  sourceId: string,
): Promise<{ source: CompanionCaptureSource }> {
  const response = await fetchCompanion(
    toCompanionUrl("/recording/target/show"),
    {
      method: "POST",
      headers: getJsonAuthHeaders(token),
      body: JSON.stringify({ sourceId }),
    },
  );
  return readJsonResponse<{ source: CompanionCaptureSource }>(response);
}

export async function hideCompanionRecordingTargetOverlay(
  token: string,
): Promise<{ hidden: boolean }> {
  const response = await fetchCompanion(
    toCompanionUrl("/recording/target/hide"),
    {
      method: "POST",
      headers: getAuthHeaders(token),
    },
  );
  return readJsonResponse<{ hidden: boolean }>(response);
}

export async function stopCompanionNativeRecording(
  token: string,
  recordingId: string,
): Promise<CompanionNativeRecordingStopResponse> {
  const response = await fetchCompanion(toCompanionUrl("/recording/stop"), {
    method: "POST",
    headers: getJsonAuthHeaders(token),
    body: JSON.stringify({ recordingId }),
  });
  return readJsonResponse<CompanionNativeRecordingStopResponse>(response);
}

export async function fetchCompanionNativeRecordingFile(
  token: string,
  recordingId: string,
): Promise<Blob> {
  const encodedRecordingId = encodeURIComponent(recordingId);
  const response = await fetchCompanionReadOnly(
    `/recordings/${encodedRecordingId}/file`,
    {
      cache: "no-store",
      headers: getAuthHeaders(token),
    },
  );
  if (!response.ok) {
    throw new Error(`Companion request failed with ${response.status}`);
  }
  return response.blob();
}

export async function fetchCompanionRecordingIndex(): Promise<CompanionRecordingIndex> {
  const response = await fetchCompanionReadOnly("/recordings", {
    cache: "no-store",
  });
  return readJsonResponse<CompanionRecordingIndex>(response);
}

export async function fetchCompanionRecordingPackageMetadata(
  recordingId: string,
): Promise<CompanionRecordingPackageMetadata> {
  const response = await fetchCompanionReadOnly(
    `/recordings/${encodeURIComponent(recordingId)}/metadata`,
    {
      cache: "no-store",
    },
  );
  return readJsonResponse<CompanionRecordingPackageMetadata>(response);
}

export async function fetchCompanionRecordingPackageFile(
  recordingId: string,
  fileName: string,
): Promise<Blob> {
  const response = await fetchCompanionReadOnly(
    `/recordings/${encodeURIComponent(recordingId)}/file/${encodeURIComponent(
      fileName,
    )}`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Companion request failed with ${response.status}`);
  }
  return response.blob();
}

export async function openCompanionRecordingInEditor(
  recordingId: string,
): Promise<{ url: string }> {
  const response = await fetchCompanion(
    toCompanionUrl(
      `/recordings/${encodeURIComponent(recordingId)}/open-editor`,
    ),
    {
      method: "POST",
    },
  );
  return readJsonResponse<{ url: string }>(response);
}

export async function registerCompanionEditorSession(
  sessionId: string,
  editorInstanceId: string,
): Promise<CompanionEditorSessionResponse> {
  const response = await fetchCompanionReadOnly("/editor/active-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, editorInstanceId }),
    cache: "no-store",
  });
  return readJsonResponse<CompanionEditorSessionResponse>(response);
}

export async function fetchCompanionEditorPendingRecordings(
  sessionId: string,
): Promise<CompanionEditorPendingRecordingsResponse> {
  const response = await fetchCompanionReadOnly(
    `/editor/pending-recordings?sessionId=${encodeURIComponent(sessionId)}`,
    {
      cache: "no-store",
    },
  );
  return readJsonResponse<CompanionEditorPendingRecordingsResponse>(response);
}

export async function acknowledgeCompanionEditorPendingRecording(
  sessionId: string,
  packageId: string,
): Promise<CompanionEditorPendingRecordingAckResponse> {
  const response = await fetchCompanionReadOnly(
    "/editor/pending-recordings/ack",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, packageId }),
      cache: "no-store",
    },
  );
  return readJsonResponse<CompanionEditorPendingRecordingAckResponse>(response);
}

export function sendCompanionEditorSessionClear(
  sessionId: string,
  editorInstanceId: string,
): void {
  try {
    void fetchCompanion(toCompanionUrl("/editor/active-session/clear"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, editorInstanceId }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

export async function markCompanionRecordingStart(
  token: string,
): Promise<CompanionRecordingMarkStartResponse> {
  const response = await fetchCompanion(
    toCompanionUrl("/recording/mark-start"),
    {
      method: "POST",
      headers: getAuthHeaders(token),
    },
  );
  return readJsonResponse<CompanionRecordingMarkStartResponse>(response);
}

/**
 * Best-effort cleanup fired from a `pagehide` handler. Normal async cleanup is
 * not guaranteed to run while the page is unloading, so these requests use
 * `keepalive` so the browser flushes them after the document goes away. The
 * companion also self-heals when the event socket drops, so this is the fast
 * path and the socket-disconnect grace timer is the backstop.
 */
export function sendCompanionUnloadCleanup(
  token: string,
  nativeRecordingId: string | null,
): void {
  try {
    void fetchCompanion(toCompanionUrl("/recording/target/hide"), {
      method: "POST",
      headers: getAuthHeaders(token),
      keepalive: true,
    }).catch(() => {});
    if (nativeRecordingId) {
      void fetchCompanion(toCompanionUrl("/recording/stop"), {
        method: "POST",
        headers: getJsonAuthHeaders(token),
        body: JSON.stringify({ recordingId: nativeRecordingId }),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {}
}

export function createCompanionEventsSocket(token: string): WebSocket {
  const url = new URL(`${getCompanionWsOrigin()}/events`);
  url.searchParams.set("token", token);
  return new WebSocket(url);
}

export function getCaptureSettingsSnapshot(
  settings: MediaTrackSettings | null | undefined,
): CompanionCaptureSettingsSnapshot | null {
  if (!settings) return null;

  const extendedSettings = settings as MediaTrackSettings & {
    cursor?: string;
    displaySurface?: string;
    logicalSurface?: boolean;
  };

  return {
    source: "browser",
    width: typeof settings.width === "number" ? settings.width : undefined,
    height: typeof settings.height === "number" ? settings.height : undefined,
    frameRate:
      typeof settings.frameRate === "number" ? settings.frameRate : undefined,
    displaySurface:
      typeof extendedSettings.displaySurface === "string"
        ? extendedSettings.displaySurface
        : undefined,
    logicalSurface:
      typeof extendedSettings.logicalSurface === "boolean"
        ? extendedSettings.logicalSurface
        : undefined,
    cursor:
      typeof extendedSettings.cursor === "string"
        ? extendedSettings.cursor
        : undefined,
  };
}
