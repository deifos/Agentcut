// A real browser for the tests that need one (WebGL, WebCodecs), over the DevTools protocol, with no
// browser package to install. Uses Chrome from CHROME_PATH or its usual locations; `findChrome()`
// returning null lets a test skip on machines without it.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOCATIONS = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function findChrome() {
  return LOCATIONS.find((path) => path && existsSync(path)) ?? null;
}

export async function launchChrome() {
  const path = findChrome();
  if (!path) throw new Error("Chrome not found. Set CHROME_PATH.");
  const profile = await mkdtemp(join(tmpdir(), "agentcut-chrome-"));
  const child = spawn(path, [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    // Software rendering, so the tests behave the same on machines without a GPU.
    ...(process.env.CHROME_REAL_GPU ? ["--enable-unsafe-webgpu"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]),
    "--ignore-gpu-blocklist",
    "--autoplay-policy=no-user-gesture-required",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  const endpoint = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Chrome did not start: ${output}`)), 30_000);
    child.stderr.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.once("exit", () => reject(new Error(`Chrome exited: ${output}`)));
  });

  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else for (const listener of listeners) listener(message);
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });

  /** Open `url` in a new tab; `evaluate` runs an expression there and returns its awaited value. */
  async function open(url, { onConsole } = {}) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Runtime.enable", {}, sessionId);
    await send("Page.enable", {}, sessionId);
    listeners.add((message) => {
      if (message.sessionId !== sessionId) return;
      if (message.method === "Runtime.consoleAPICalled")
        onConsole?.(message.params.type, message.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
      if (message.method === "Runtime.exceptionThrown")
        onConsole?.("exception", message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    });
    const loaded = new Promise((resolve) => {
      const listener = (message) => {
        if (message.sessionId === sessionId && message.method === "Page.loadEventFired") {
          listeners.delete(listener);
          resolve();
        }
      };
      listeners.add(listener);
    });
    await send("Page.navigate", { url }, sessionId);
    await loaded;
    return {
      /** A raw DevTools command on this tab (real mouse input, screenshots). */
      send: (method, params = {}) => send(method, params, sessionId),
      async evaluate(expression) {
        const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
        if (exceptionDetails)
          throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
        return result.value;
      },
    };
  }

  async function close() {
    socket.close();
    child.removeAllListeners("exit");
    child.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  }

  return { open, close };
}
