import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, symlinkSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { checkPath } from "../packages/agentcut/src/studio/share.ts";
import { join } from "node:path";
import test from "node:test";
import { claudeAgent, claudeSettings } from "../packages/agentcut/src/studio/agents/claude.ts";
import { codexAgent } from "../packages/agentcut/src/studio/agents/codex.ts";
import { openFile } from "../packages/agentcut/src/studio/reveal.ts";
import { MEDIA_INPUT_ONLY } from "../packages/agentcut/src/studio/references.ts";

const home = "/home/someone";
const run = {
  prompt: "",
  sessionId: null,
  images: [],
  workspace: "/work",
  mcp: { name: "agentcut", command: "node", args: [], env: {} },
  mcpConfigPath: "/work/.agentcut/mcp.json",
  settingsPath: "/work/.agentcut/agent-settings.json",
  allowShell: true,
  readDirs: ["/code/app"],
  shellDomains: ["cdn.example.com"],
  model: null,
  effort: null,
};

test("Claude runs with the settings file on every turn, also when the shell is off", () => {
  for (const allowShell of [true, false]) {
    const args = claudeAgent.buildArgs({ ...run, allowShell });
    assert.equal(args[args.indexOf("--settings") + 1], run.settingsPath);
  }
  assert.ok(!claudeAgent.buildArgs(run).includes("--dangerously-skip-permissions"));
});

test("the shell can't leave the sandbox, write outside it, or reach other sites", () => {
  const { sandbox } = claudeSettings(run, home);
  assert.equal(sandbox.enabled, true);
  assert.equal(sandbox.allowUnsandboxedCommands, false);
  assert.ok(sandbox.network.allowedDomains.includes("registry.npmjs.org"));
  assert.ok(sandbox.network.allowedDomains.includes("cdn.example.com"));
  assert.ok(!sandbox.network.allowedDomains.some((domain) => domain === "*"));
  assert.ok(sandbox.filesystem.denyWrite.includes("/code/app"));
});

test("logins and keys are closed to both the shell and the Read tool", () => {
  const { sandbox, permissions } = claudeSettings(run, home);
  for (const secret of [".ssh", ".aws", ".agentcut/studio-keys.json", ".agentcut/transcription-keys.json", "Library/Keychains"]) {
    assert.ok(sandbox.filesystem.denyRead.includes(join(home, secret)), secret);
    assert.ok(permissions.deny.some((rule) => rule.startsWith(`Read(/${join(home, secret)}`)), secret);
  }
  // The video tools live next to the keys and must stay readable.
  assert.ok(!sandbox.filesystem.denyRead.includes(join(home, ".agentcut")));
});

test("the agent can't change what later runs outside the sandbox", () => {
  const { sandbox, permissions } = claudeSettings(run, home);
  for (const path of ["/work/.agentcut", "/work/.claude", "/work/.mcp.json", "/work/CLAUDE.md"]) {
    assert.ok(sandbox.filesystem.denyWrite.includes(path), path);
    assert.ok(permissions.deny.some((rule) => rule.startsWith(`Edit(/${path}`)), path);
  }
});

test("Codex has no settings file to write", () => {
  assert.equal(codexAgent.settings, undefined);
});

test("only media files can be opened", () => {
  for (const file of ["evil.command", "evil.bat", "evil.exe", "evil.lnk", "evil.desktop", "evil.html", "evil.svg", "evil.app", "evil.mp4.sh", "noextension"]) {
    assert.throws(() => openFile(`/does-not-matter/${file}`), /can be opened/, file);
  }
});

test("no agent process or tool path builds a shell command string", () => {
  const source = (file) => readFileSync(new URL(`../packages/agentcut/src/studio/${file}`, import.meta.url), "utf8");
  for (const file of ["references.ts", "render.ts", "proc.ts", "reveal.ts", "chat.ts", "transcription/service.ts"]) {
    // The lookbehind leaves regex.exec() alone: only child_process's exec takes a shell string.
    assert.doesNotMatch(source(file), /shell:\s*true|(?<![.\w])exec(Sync)?\(/, file);
  }
});

test("the media whitelist keeps real formats and refuses a playlist disguised as a video", { skip: !ffmpegPath() }, async (t) => {
  const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const ffmpeg = ffmpegPath();
  const dir = mkdtempSync(join(tmpdir(), "agentcut-security-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const probe = (file) => {
    try {
      return execFileSync(ffmpeg, ["-hide_banner", ...MEDIA_INPUT_ONLY, "-i", file], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    } catch (error) {
      return String(error.stderr);
    }
  };
  const real = join(dir, "real.mp4");
  execFileSync(ffmpeg, ["-loglevel", "error", "-f", "lavfi", "-i", "testsrc=d=1:s=64x64", "-c:v", "mpeg4", real]);
  assert.match(probe(real), /Duration:/);
  const fake = join(dir, "fake.mp4");
  writeFileSync(fake, "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:1.0,\nother.ts\n#EXT-X-ENDLIST\n");
  assert.match(probe(fake), /not on whitelist/);
});

function ffmpegPath() {
  try {
    const root = join(process.env.HOME ?? "", ".agentcut", "tools", "ffmpeg");
    const out = execFileSync("find", [root, "-type", "f", "-name", "ffmpeg"], { encoding: "utf8" });
    return out.split("\n").find(Boolean) ?? null;
  } catch {
    return null;
  }
}


test("no-bash explicitly denies the shell even with sandbox auto-allow", () => {
  const args = claudeAgent.buildArgs({ ...run, allowShell: false });
  assert.ok(args.slice(args.indexOf("--disallowedTools") + 1).includes("Bash"));
});

test("shares reject local and override instruction files", () => {
  for (const name of ["CLAUDE.local.md", "nested/AGENTS.override.md"]) assert.throws(() => checkPath(name), /agent instructions/);
});

test("media-looking symlinks and directories cannot launch scripts or apps", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "agentcut-open-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const script = join(dir, "evil.command");
  writeFileSync(script, "echo never-run");
  const link = join(dir, "movie.mp4");
  symlinkSync(script, link);
  assert.throws(() => openFile(link), /can be opened/);
  const folder = join(dir, "bundle.mp4");
  mkdirSync(folder);
  assert.throws(() => openFile(folder), /can be opened/);
});
