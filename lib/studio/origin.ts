// Where the local helper (`npx agentcut`) listens. The page always talks to it on this computer.
// An exact project link can select a second local helper for an isolated workspace.
// Only the port changes; a link can never redirect the bridge off this computer.
const linkedPort =
  typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get("helperPort");
const port =
  linkedPort &&
  /^\d{1,5}$/.test(linkedPort) &&
  Number(linkedPort) > 0 &&
  Number(linkedPort) <= 65535
    ? Number(linkedPort)
    : 32118;
export const STUDIO_BRIDGE_ORIGIN = `http://127.0.0.1:${port}`;

/** The helper's WebSocket. */
export const STUDIO_BRIDGE_WS_URL = `${STUDIO_BRIDGE_ORIGIN.replace(/^http/, "ws")}/agentcut`;
export const STUDIO_PROTOCOL_VERSION = 1;
