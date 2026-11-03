// Optional local integration fixture. Start the relay on 8788 and Next on 3000 with
// NEXT_PUBLIC_PHONE_API_URL=http://127.0.0.1:8788, then run this file with --import tsx.
// Uses real encryption, Worker, helper, background studio, FFmpeg and Remotion.
// The coding agent is replaced with a deterministic one-second trim; no paid agent calls.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { scaffoldWorkspace } from "../packages/agentcut/src/studio/workspace.ts";
import { StudioHost } from "../packages/agentcut/src/studio/host.ts";
import {
  setBridgeExtension,
  startOwnedBridge,
} from "../packages/agentcut/src/bridge.ts";
import { ensureFfmpeg } from "../packages/agentcut/src/studio/references.ts";

process.env.AGENTCUT_PORT = "32120";
process.env.AGENTCUT_EDITOR_ORIGIN = "http://localhost:3000";
const root =
  process.env.PHONE_SMOKE_ROOT ||
  mkdtempSync(join(tmpdir(), "agentcut-phone-smoke-"));
const { paths } = scaffoldWorkspace(root);
const host = new StudioHost({
  paths,
  port: 32120,
  allowedOrigins: ["http://localhost:3000"],
  allowBash: false,
});
let answer = null;
host.chat.send = async (slug) => {
  const dir = join(paths.projects, slug);
  const project = JSON.parse(readFileSync(join(dir, "project.json"), "utf8"));
  project.durationInFrames = 30;
  writeFileSync(join(dir, "project.json"), JSON.stringify(project));
  const layers = JSON.parse(readFileSync(join(dir, "layers.json"), "utf8"));
  layers.tracks[0].clips[0].duration = 30;
  writeFileSync(join(dir, "layers.json"), JSON.stringify(layers));
  writeFileSync(
    join(dir, "assets", "phone-edit-result.json"),
    JSON.stringify({
      status: "complete",
      summary: "Test edit: trim to one second.",
    }),
  );
  answer = {
    messages: [
      { id: "smoke-user", role: "user" },
      { id: "smoke-agent", role: "assistant", status: "done" },
    ],
  };
  return { userMessageId: "smoke-user", turnId: "smoke-agent" };
};
host.chat.history = () => answer ?? { messages: [] };
setBridgeExtension(host);
await startOwnedBridge();
host.start();
const ffmpeg = await ensureFfmpeg(() => {});
const video = join(root, "phone-test.mp4");
const generated = spawnSync(
  ffmpeg,
  [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=360x640:rate=30",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=48000",
    "-t",
    "2",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    video,
  ],
  { windowsHide: true },
);
if (generated.status !== 0) throw new Error(generated.stderr.toString());
const status = host.phones.status().connected
  ? host.phones.status()
  : await host.phones.connect("http://127.0.0.1:8788");
const p = status.pairing;
if (p) {
  const link = `http://localhost:3000/phone#${new URLSearchParams({ id: p.id, invite: p.invite, key: p.secret })}`;
  writeFileSync(
    join(root, "browser-fixture.json"),
    JSON.stringify({ link, video, root }),
  );
}
console.log(`Phone smoke fixture: ${join(root, "browser-fixture.json")}`);
console.log(
  "Test helper is running on port 32120. Ctrl+C stops it. Files stay in the temporary workspace for inspection.",
);
process.on("SIGINT", async () => {
  await host.stop();
  process.exit(0);
});
