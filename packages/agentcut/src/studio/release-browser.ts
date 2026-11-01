import { createRequire } from "node:module";
import { dirname, delimiter, join } from "node:path";
import { existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { killTree, DETACH_FOR_GROUP_KILL } from "./proc.js";
import { ensureFfmpeg } from "./references.js";
import { ReleaseRecorder } from "./release-recorder.js";

const require = createRequire(import.meta.url);

/** The package supplies the controller; Chrome and the shared recorder are acquired on demand. */
export class ReleaseBrowser {
  private children = new Set<ChildProcess>();
  private ffmpeg: string | null = null;
  private ready: Promise<void> | null = null;
  private stopped = false;
  private recorder: ReleaseRecorder | null = null;
  get isClosed() {
    return this.stopped;
  }

  async abortRecording() {
    this.recorder?.cancel();
    this.recorder = null;
  }

  constructor(
    readonly session: string,
    readonly profile: string,
    private readonly headed: boolean,
  ) {}

  private async run(
    args: string[],
    timeoutMs = 90_000,
  ): Promise<Record<string, unknown>> {
    if (this.stopped) throw new Error("Video job was cancelled.");
    const cli = join(
      dirname(require.resolve("agent-browser/package.json")),
      "bin",
      "agent-browser.js",
    );
    return new Promise((resolve, reject) => {
      // The upstream JS launcher uses windowsHide:false for its native child.
      // Call the Windows binary directly so helper commands cannot flash terminals.
      const native = join(dirname(cli), "agent-browser-win32-x64.exe");
      const direct = process.platform === "win32" && existsSync(native);
      const child = spawn(
        direct ? native : process.execPath,
        direct ? args : [cli, ...args],
        {
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          detached: DETACH_FOR_GROUP_KILL,
          env: {
            ...process.env,
            PATH: this.ffmpeg
              ? `${dirname(this.ffmpeg)}${delimiter}${process.env.PATH ?? ""}`
              : process.env.PATH,
          },
        },
      );
      this.children.add(child);
      let output = "",
        errors = "";
      const timer = setTimeout(() => {
        killTree(child);
        reject(
          new Error(
            "Browser command timed out. The job has stopped; do not retry it blindly.",
          ),
        );
      }, timeoutMs);
      child.stdout.on("data", (data) => {
        output = (output + data).slice(-1_000_000);
      });
      child.stderr.on("data", (data) => {
        errors = (errors + data).slice(-4000);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        clearTimeout(timer);
        this.children.delete(child);
        if (code !== 0) {
          let message = (errors || output || `Browser exited ${code}`).slice(
            -4000,
          );
          try {
            message = String(JSON.parse(output).error || message);
          } catch {}
          if (/encoder fell.*behind capture/i.test(message))
            message =
              "The recorder could not keep up with this computer's load. The job stopped. Close heavy work and create a new job to retry.";
          return reject(new Error(message));
        }
        try {
          const result = JSON.parse(output);
          if (result.success === false)
            reject(
              new Error(String(result.error ?? "Browser command failed.")),
            );
          else resolve(result.data ?? result);
        } catch {
          resolve({ output: output.trim() });
        }
      });
    });
  }

  setup(progress: () => void) {
    this.ready ??= (async () => {
      progress();
      this.ffmpeg = await ensureFfmpeg(progress);
      await this.run(["install"], 5 * 60_000);
    })().catch((error) => {
      this.ready = null;
      throw error;
    });
    return this.ready;
  }

  command(args: string[]) {
    return this.run([
      "--session",
      this.session,
      "--profile",
      this.profile,
      ...(this.headed ? ["--headed"] : []),
      "--json",
      ...args,
    ]);
  }

  /** No page text or form values leave the browser when a login form is present. */
  async needsLogin() {
    const result = await this.command([
      "eval",
      "Boolean(document.querySelector('input[type=password]')) || /\\/(login|signin|sign-in|auth)(\\/|$)/i.test(location.pathname)",
    ]);
    return result.result === true;
  }

  async duration(file: string): Promise<number> {
    if (!this.ffmpeg) throw new Error("Recorder is not ready.");
    return new Promise((resolve, reject) => {
      const child = spawn(
        this.ffmpeg!,
        ["-hide_banner", "-i", file, "-frames:v", "1", "-f", "null", "-"],
        { windowsHide: true },
      );
      this.children.add(child);
      let log = "";
      const timer = setTimeout(() => {
        killTree(child);
        reject(new Error("Recording validation timed out."));
      }, 30_000);
      child.stderr.on("data", (data) => {
        log = (log + data).slice(-12000);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        clearTimeout(timer);
        this.children.delete(child);
        const match = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(log);
        if (code !== 0 || !match || !/Video:/.test(log))
          return reject(
            new Error("The browser did not produce a readable video."),
          );
        resolve(
          Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]),
        );
      });
    });
  }

  async startRecording(file: string, cursor = false) {
    const endpoint = await this.command(["get", "cdp-url"]);
    const page = await this.command(["get", "url"]);
    this.recorder = new ReleaseRecorder();
    try {
      await this.recorder.start(
        this.ffmpeg!,
        String(endpoint.cdpUrl),
        String(page.url),
        file,
        cursor,
      );
    } catch (error) {
      this.recorder.cancel();
      this.recorder = null;
      throw error;
    }
  }

  async moveCursor(selector: string) {
    if (this.recorder) await this.recorder.moveToSelector(selector);
  }

  async typeDemo(selector: string, text: string, delayMs: number) {
    if (!this.recorder)
      throw new Error("Demo typing requires an active recording.");
    await this.moveCursor(selector);
    await this.command(["click", selector]);
    await this.recorder.typeDemo(selector, text, delayMs);
  }

  async stopRecording() {
    if (this.recorder) {
      const recorder = this.recorder;
      this.recorder = null;
      await recorder.stop();
    }
  }

  async close() {
    this.recorder?.cancel();
    this.recorder = null;
    for (const child of this.children) killTree(child);
    this.children.clear();
    // The CLI talks to a persistent per-session daemon. Closing the CLI alone is insufficient.
    try {
      await this.command(["close"]);
    } catch {}
    this.stopped = true;
  }
}
