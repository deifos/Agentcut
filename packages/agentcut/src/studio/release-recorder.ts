import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import { killTree } from "./proc.js";
import { randomUUID } from "node:crypto";
import { cursorOverlayScript } from "./release-cursor.js";

/** Record the active Chrome page, not the desktop. Keep a single latest frame in
 * memory and preserve wall-clock timing through encoder backpressure. */
export class ReleaseRecorder {
  private socket: WebSocket | null = null;
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<
    number,
    {
      resolve(value: Record<string, any>): void;
      reject(error: Error): void;
      timer: NodeJS.Timeout;
    }
  >();
  private counter = 0;
  private session: string | undefined;
  private frame: Buffer | null = null;
  private started = 0;
  private written = 0;
  private stopping = false;
  private cancelled = false;
  private pump: Promise<void> | null = null;
  private failure: Error | null = null;
  private log = "";
  private exited: Promise<void> | null = null;
  private cursorId = `agentcut-cursor-${randomUUID()}`;
  private cursorScriptId: string | null = null;
  private pointer = { x: 1100, y: 760 };

  private call(
    method: string,
    params: Record<string, unknown> = {},
    sessionId = this.session,
  ): Promise<Record<string, any>> {
    const id = ++this.counter;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome page capture timed out: ${method}`));
      }, 20_000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket!.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      );
    });
  }

  async start(
    ffmpeg: string,
    endpoint: string,
    pageUrl: string,
    file: string,
    cursor = false,
  ) {
    if (typeof WebSocket === "undefined")
      throw new Error(
        "Release page recording requires Node 22 or later. Agent Browser recommends Node 24 or later.",
      );
    const socket = new WebSocket(endpoint);
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(message.id);
          if (message.error) pending.reject(new Error(message.error.message));
          else pending.resolve(message.result ?? {});
        }
      } else if (
        message.method === "Page.screencastFrame" &&
        message.sessionId === this.session
      ) {
        this.frame = Buffer.from(message.params.data, "base64");
        void this.call("Page.screencastFrameAck", {
          sessionId: message.params.sessionId,
        }).catch((error) => {
          if (!this.stopping) this.failure = error;
        });
      }
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Cannot connect to the demo page recorder.")),
        20_000,
      );
      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error("The demo browser recorder connection failed."));
        },
        { once: true },
      );
    });
    socket.addEventListener("close", () => {
      if (!this.stopping)
        this.failure = new Error("The demo browser closed during recording.");
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error("The demo browser disconnected."));
      }
      this.pending.clear();
    });
    const targets = await this.call("Target.getTargets");
    const target = targets.targetInfos.find(
      (item: { type: string; url: string }) =>
        item.type === "page" && item.url === pageUrl,
    );
    if (!target)
      throw new Error("The active demo page was not found for capture.");
    this.session = (
      await this.call("Target.attachToTarget", {
        targetId: target.targetId,
        flatten: true,
      })
    ).sessionId;
    await this.call("Page.enable");
    if (cursor) {
      const source = cursorOverlayScript(this.cursorId);
      this.cursorScriptId = (
        await this.call("Page.addScriptToEvaluateOnNewDocument", { source })
      ).identifier;
      await this.call("Runtime.evaluate", { expression: source });
    }
    const initial = await this.call("Page.captureScreenshot", {
      format: "jpeg",
      quality: 92,
    });
    this.frame = Buffer.from(initial.data, "base64");
    const child = spawn(
      ffmpeg,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "-framerate",
        "30",
        "-i",
        "pipe:0",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-threads",
        "2",
        "-movflags",
        "+faststart",
        file,
      ],
      { windowsHide: true, stdio: "pipe" },
    );
    this.child = child;
    child.stdin.on("error", (error) => {
      this.failure = error;
    });
    child.stderr.on("data", (data) => {
      this.log = (this.log + data).slice(-3000);
    });
    this.exited = new Promise<void>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`The page recorder failed: ${this.log || code}`)),
      );
    });
    void this.exited.catch((error) => {
      this.failure = error;
    });
    this.started = performance.now();
    await this.call("Page.startScreencast", {
      format: "jpeg",
      quality: 92,
      everyNthFrame: 1,
    });
    this.pump = this.writeFrames();
    void this.pump.catch((error) => {
      this.failure = error;
    });
  }

  async moveToSelector(selector: string, milliseconds = 650) {
    const result = await this.call("Runtime.evaluate", {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); const x = r.x + r.width/2, y = r.y + r.height/2; return r.width && r.height && x >= 0 && y >= 0 && x < innerWidth && y < innerHeight ? {x,y} : null; })()`,
      returnByValue: true,
    });
    const target = result.result?.value as { x: number; y: number } | null;
    if (!target)
      throw new Error(
        "Scroll the cursor target into view before recording this action.",
      );
    const from = { ...this.pointer };
    const steps = Math.ceil(milliseconds / 20);
    for (let step = 1; step <= steps; step++) {
      if (this.cancelled || this.stopping)
        throw new Error("Page recording stopped.");
      const t = step / steps;
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      await this.call("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: from.x + (target.x - from.x) * ease,
        y: from.y + (target.y - from.y) * ease,
      });
      await new Promise((resolve) => setTimeout(resolve, milliseconds / steps));
    }
    this.pointer = target;
  }

  async typeDemo(selector: string, text: string, delayMs: number) {
    const allowed = await this.call("Runtime.evaluate", {
      expression: `(() => { const el=document.querySelector(${JSON.stringify(selector)}); return Boolean(document.querySelector('meta[name="agentcut-demo"][content="synthetic"]') && el && el.matches('textarea[data-demo-input],input[type=text][data-demo-input]')); })()`,
      returnByValue: true,
    });
    if (allowed.result?.value !== true)
      throw new Error("This field is not an isolated demo input.");
    for (const char of text) {
      if (this.cancelled || this.stopping)
        throw new Error("Recording stopped.");
      await this.call("Input.insertText", { text: char });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  private async removeCursor() {
    if (
      !this.cursorScriptId ||
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN
    )
      return;
    try {
      await this.call("Page.removeScriptToEvaluateOnNewDocument", {
        identifier: this.cursorScriptId,
      });
      await this.call("Runtime.evaluate", {
        expression: `window[${JSON.stringify(this.cursorId)}]?.()`,
      });
    } catch {}
    this.cursorScriptId = null;
  }

  private async writeFrames() {
    while (!this.cancelled) {
      if (this.failure) throw this.failure;
      const target = Math.max(
        1,
        Math.ceil(((performance.now() - this.started) / 1000) * 30),
      );
      while (this.written < target && !this.cancelled) {
        if (!this.child!.stdin.write(this.frame!))
          await once(this.child!.stdin, "drain");
        this.written++;
      }
      if (this.stopping) return;
      await new Promise((resolve) => setTimeout(resolve, 12));
    }
  }

  async stop() {
    this.stopping = true;
    const timer = setTimeout(() => this.cancel(), 30_000);
    try {
      await this.call("Page.stopScreencast");
      await this.pump;
      if (this.failure) throw this.failure;
      this.child!.stdin.end();
      await this.exited;
      if (this.cancelled) throw new Error("Page recording was cancelled.");
    } finally {
      clearTimeout(timer);
      if (this.child?.exitCode === null) killTree(this.child);
      await this.removeCursor();
      this.dispose();
    }
  }
  cancel() {
    this.cancelled = true;
    this.stopping = true;
    if (this.child) killTree(this.child);
    void this.removeCursor().finally(() => this.dispose());
  }
  private dispose() {
    this.socket?.close();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Page recording stopped."));
    }
    this.pending.clear();
    this.frame = null;
  }
}
