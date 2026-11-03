// Start the relay on 8788 and Next on 3000 with NEXT_PUBLIC_PHONE_API_URL set.
// Seeds one encrypted result for browser testing. No coding agent is used.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ensureFfmpeg } from "../packages/agentcut/src/studio/references.ts";
import {
  phoneSecret,
  sealPhone,
  phoneResultKey,
  phoneResultToken,
} from "../packages/agentcut/src/studio/phone-protocol.ts";

const root = mkdtempSync(join(tmpdir(), "agentcut-result-smoke-"));
const video = join(root, "result.mp4");
const ffmpeg = await ensureFfmpeg(() => {});
const generated = spawnSync(
  ffmpeg,
  [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=360x640:rate=30",
    "-t",
    "1",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    video,
  ],
  { windowsHide: true },
);
if (generated.status !== 0) throw new Error(generated.stderr.toString());
const desktop = phoneSecret(),
  invite = phoneSecret(),
  phone = phoneSecret(),
  secret = phoneSecret();
const api = "http://127.0.0.1:8788/v1/phone";
async function request(url, token, method = "GET", body) {
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}` },
    ...(body === undefined
      ? {}
      : { body: body instanceof Uint8Array ? body : JSON.stringify(body) }),
  });
  if (!response.ok)
    throw new Error(`${response.status}: ${await response.text()}`);
  return response.json();
}
const { id } = await request(api, "", "POST", { desktop, invite });
const base = `${api}/${id}`;
await request(`${base}/claim`, invite, "POST", { token: phone });
const job = crypto.randomUUID();
await request(`${base}/jobs`, phone, "POST", { id: job, bytes: 1 });
await request(
  `${base}/jobs/${job}/input/0`,
  phone,
  "PUT",
  await sealPhone(secret, job, "input/0", new Uint8Array([1])),
);
await request(
  `${base}/jobs/${job}/input/manifest`,
  phone,
  "PUT",
  await sealPhone(
    secret,
    job,
    "input/manifest",
    new TextEncoder().encode("{}"),
  ),
);
await request(`${base}/jobs/${job}/commit`, phone, "POST");
for (const stage of ["receiving", "editing", "rendering"])
  await request(`${base}/jobs/${job}/status`, desktop, "POST", { stage });
const bytes = new Uint8Array(readFileSync(video));
await request(`${base}/jobs/${job}/status`, desktop, "POST", {
  stage: "returning",
  bytes: bytes.length,
});
await request(
  `${base}/jobs/${job}/result/0`,
  desktop,
  "PUT",
  await sealPhone(secret, job, "result/0", bytes),
);
await request(
  `${base}/jobs/${job}/result/manifest`,
  desktop,
  "PUT",
  await sealPhone(
    secret,
    job,
    "result/manifest",
    new TextEncoder().encode(
      JSON.stringify({ name: "result.mp4", bytes: bytes.length }),
    ),
  ),
);
await request(`${base}/jobs/${job}/status`, desktop, "POST", { stage: "done" });
const token = await phoneResultToken(secret, job),
  key = await phoneResultKey(secret, job);
await request(`${base}/jobs/${job}/link`, phone, "POST", { token });
const link = `http://localhost:3000/phone/watch#${new URLSearchParams({ device: id, job, token, key })}`;
const fixture = join(root, "fixture.json");
writeFileSync(
  fixture,
  JSON.stringify({
    link,
    video,
    device: id,
    job,
    connection: { id, token: phone, secret },
  }),
);
console.log(fixture);
