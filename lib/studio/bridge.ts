import { STUDIO_BRIDGE_WS_URL, STUDIO_PROTOCOL_VERSION } from "@/lib/studio/origin";

export type StudioBridgeStatus =
  | "connecting" // trying to reach the helper
  | "connected"
  | "offline" // helper not running (keeps retrying)
  | "taken"; // another tab took the bridge; waits for the user to reconnect

export type StudioToolHandler = (
  method: string,
  params: unknown,
) => Promise<unknown>;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class StudioRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

const RETRY_MS = 2_000;

/**
 * WebSocket client for the local studio helper. Shares the editor bridge
 * endpoint: hello + bridge→page tool calls (Claude's MCP tools), plus
 * studio.request/response and studio.event for the studio itself.
 */
export class StudioBridge {
  private socket: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private eventListeners = new Map<string, Set<(data: unknown) => void>>();
  private statusListeners = new Set<(status: StudioBridgeStatus) => void>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private counter = 0;
  private closedByUser = false;
  status: StudioBridgeStatus = "connecting";

  constructor(
    private readonly getSession: () => Record<string, unknown>,
    private readonly onToolCall: StudioToolHandler,
  ) {}

  connect() {
    this.closedByUser = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.open();
  }

  close() {
    this.closedByUser = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      if (socket.readyState <= WebSocket.OPEN) socket.close();
    }
    this.failPending("Studio disconnected.");
  }

  private setStatus(status: StudioBridgeStatus) {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }

  onStatus(listener: (status: StudioBridgeStatus) => void) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  on(event: string, listener: (data: unknown) => void) {
    let set = this.eventListeners.get(event);
    if (!set) {
      set = new Set();
      this.eventListeners.set(event, set);
    }
    set.add(listener);
    return () => set?.delete(listener);
  }

  /** Re-send the hello so the bridge knows the active project/playhead. */
  sendHello() {
    this.send({
      type: "hello",
      app: "agentcut",
      protocolVersion: STUDIO_PROTOCOL_VERSION,
      session: {
        workspace: "studio",
        agentProtocolVersion: STUDIO_PROTOCOL_VERSION,
        ...this.getSession(),
      },
    });
  }

  request<T = unknown>(
    method: string,
    params: unknown = {},
    timeoutMs = 60_000,
  ): Promise<T> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(
        new StudioRequestError("The studio helper isn't connected.", "offline"),
      );
    }
    const id = `page_${++this.counter}`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new StudioRequestError(
            `The studio helper didn't answer "${method}" in time.`,
            "timeout",
          ),
        );
      }, timeoutMs);
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      socket.send(
        JSON.stringify({ type: "studio.request", id, method, params }),
      );
    });
  }

  private send(payload: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(payload));
  }

  private failPending(message: string) {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new StudioRequestError(message, "offline"));
      this.pending.delete(id);
    }
  }

  private scheduleRetry() {
    if (this.closedByUser || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, RETRY_MS);
  }

  private open() {
    if (this.closedByUser) return;
    if (this.status !== "offline") this.setStatus("connecting");
    let opened = false;
    let socket: WebSocket;
    try {
      socket = new WebSocket(STUDIO_BRIDGE_WS_URL);
    } catch {
      this.setStatus("offline");
      this.scheduleRetry();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      opened = true;
      this.sendHello();
      this.setStatus("connected");
    };
    socket.onmessage = (event) => {
      void this.handleMessage(String(event.data));
    };
    socket.onerror = () => {
      // onclose follows.
    };
    socket.onclose = (event) => {
      if (this.socket === socket) this.socket = null;
      this.failPending("The studio helper disconnected.");
      if (this.closedByUser) return;
      // 4001: the bridge is moving to the studio helper (it took the port over): reconnect.
      if (opened && event.code !== 4001) {
        // The bridge closes the previous page when another tab connects.
        this.setStatus("taken");
        return;
      }
      this.setStatus("offline");
      this.scheduleRetry();
    };
  }

  private async handleMessage(text: string) {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return;
    }
    if (message.type === "studio.response" && typeof message.id === "string") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      const error = message.error as
        | { message?: string; code?: string }
        | undefined;
      if (error)
        pending.reject(
          new StudioRequestError(error.message ?? "Studio error.", error.code),
        );
      else pending.resolve(message.result);
      return;
    }
    if (message.type === "studio.event" && typeof message.event === "string") {
      const listeners = this.eventListeners.get(message.event);
      if (listeners)
        for (const listener of [...listeners]) listener(message.data);
      return;
    }
    // Bridge → page tool call from Claude's MCP server.
    if (typeof message.id === "string" && typeof message.method === "string") {
      const { id, method } = message;
      try {
        const result = await this.onToolCall(method, message.params ?? {});
        this.send({ id, result });
      } catch (error) {
        this.send({
          id,
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }
}
