// Where the local helper (`npx agentcut`) listens. The page always talks to it on this computer.
export const STUDIO_BRIDGE_ORIGIN = "http://127.0.0.1:32118";

/** The helper's WebSocket. */
export const STUDIO_BRIDGE_WS_URL = `${STUDIO_BRIDGE_ORIGIN.replace(/^http/, "ws")}/agentcut`;
export const STUDIO_PROTOCOL_VERSION = 1;
