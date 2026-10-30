import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import workerModule from "../workers/share/src/index.ts";
import { checkPath, importShare, shareProject } from "../packages/agentcut/src/studio/share.ts";
import { SLUG_PATTERN } from "../packages/agentcut/src/studio/projects.ts";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";

const worker = workerModule.default ?? workerModule;
const api = "https://share.test";

function service(t) {
  const objects = new Map();
  const env = {
    SIGNING_SECRET: "share-regression-test-only",
    BUCKET: {
      async put(key, data, options) {
        objects.set(key, { data, customMetadata: options.customMetadata });
        return {};
      },
      async get(key) {
        const object = objects.get(key);
        return object ? { ...object, size: object.data.byteLength, body: object.data } : null;
      },
    },
  };
  const previousCaches = globalThis.caches;
  globalThis.caches = { default: { async match() {}, async put() {} } };
  t.after(() => {
    if (previousCaches === undefined) delete globalThis.caches;
    else globalThis.caches = previousCaches;
  });
  const request = async (url, options = {}) => {
    const headers = new Headers(options.headers);
    if (options.body) headers.set("content-length", String(Buffer.byteLength(options.body)));
    return worker.fetch(new Request(url, { ...options, headers }), env, { waitUntil() {} });
  };
  t.mock.method(globalThis, "fetch", request);
  return { objects, request };
}

function project(t, slug = "example") {
  const root = mkdtempSync(join(tmpdir(), "agentcut-share-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const paths = workspacePaths(root);
  const dir = join(paths.projects, slug);
  mkdirSync(join(dir, "assets"), { recursive: true });
  const files = new Map([
    ["project.json", Buffer.from(JSON.stringify({ name: "Share test", fps: 30, durationInFrames: 30 }))],
    ["assets/example.bin", Buffer.from([0, 255, 128, 42])],
  ]);
  for (const [path, bytes] of files) writeFileSync(join(dir, path), bytes);
  return { paths, slug, files };
}

function assertImported(fixture, result) {
  assert.match(result.slug, SLUG_PATTERN);
  for (const [path, bytes] of fixture.files) {
    assert.deepEqual(readFileSync(join(fixture.paths.projects, result.slug, path)), bytes);
  }
  assert.equal(readdirSync(fixture.paths.projects).some((name) => name.startsWith(".incoming-")), false);
}

test("one upload token cannot store leading-zero chunk aliases", async (t) => {
  const { request, objects } = service(t);
  const created = await (await request(`${api}/v1/shares`, {
    method: "POST", body: JSON.stringify({ bytes: 1, chunks: 1 }),
  })).json();
  const options = {
    method: "PUT",
    headers: { "x-share-token": created.token, "x-share-created": String(created.created), "x-share-chunks": "1" },
    body: Buffer.alloc(17),
  };
  assert.equal((await request(`${api}/v1/shares/${created.id}/c/0`, options)).status, 200);
  for (const alias of ["00", "000", "0000"]) {
    assert.equal((await request(`${api}/v1/shares/${created.id}/c/${alias}`, options)).status, 404);
  }
  assert.equal((await request(`${api}/v1/shares/${created.id}/c/1`, options)).status, 400);
  assert.equal(objects.size, 1);
  assert.equal((await request(`${api}/v1/shares/${created.id}/manifest`, {
    ...options, headers: { ...options.headers, "x-share-token": "invalid" },
  })).status, 401);
});

test("duplicate imports keep long project names valid and preserve bytes", async (t) => {
  service(t);
  const fixture = project(t, "a".repeat(64));
  const ref = await shareProject(fixture.paths, fixture.slug, api, () => {});
  for (let n = 2; n <= 10; n++) {
    const result = await importShare(fixture.paths, { ...ref, api }, () => {});
    assertImported(fixture, result);
    assert.ok(result.slug.endsWith(`-${n}`));
  }
});

test("sharing leaves out agent instructions", async (t) => {
  service(t);
  const fixture = project(t);
  const projectRoot = join(fixture.paths.projects, fixture.slug);
  mkdirSync(join(projectRoot, "scenes", ".claude"), { recursive: true });
  writeFileSync(join(projectRoot, "CLAUDE.md"), "run this");
  writeFileSync(join(projectRoot, "scenes", "AGENTS.md"), "run this");
  writeFileSync(join(projectRoot, "scenes", ".claude", "settings.json"), "{}");
  const ref = await shareProject(fixture.paths, fixture.slug, api, () => {});
  const result = await importShare(fixture.paths, { ...ref, api }, () => {});
  const imported = join(fixture.paths.projects, result.slug);
  for (const path of ["CLAUDE.md", "scenes/AGENTS.md", "scenes/.claude"]) {
    assert.equal(existsSync(join(imported, path)), false, path);
  }
  assertImported(fixture, result);
});

test("importing refuses agent instructions, whatever the link claims", () => {
  for (const path of ["CLAUDE.md", "claude.md", "scenes/AGENTS.md", ".claude/settings.json", "assets/.mcp.json", ".codex/config.toml"]) {
    assert.throws(() => checkPath(path), /agent instructions/, path);
  }
  for (const path of ["project.json", "scenes/intro.tsx", "assets/claude.mp4", "notes.md"]) {
    assert.equal(checkPath(path), path);
  }
});

test("overlapping imports of one link both contain the complete project", async (t) => {
  const { request } = service(t);
  const fixture = project(t);
  const ref = await shareProject(fixture.paths, fixture.slug, api, () => {});
  let arrivals = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("/c/0")) {
      if (++arrivals === 2) release();
      await gate;
    }
    return request(url, options);
  });
  const results = await Promise.all([
    importShare(fixture.paths, { ...ref, api }, () => {}),
    importShare(fixture.paths, { ...ref, api }, () => {}),
  ]);
  assert.notEqual(results[0].slug, results[1].slug);
  for (const result of results) assertImported(fixture, result);
});

test("a failed overlapping import does not delete the other import's files", async (t) => {
  const { request } = service(t);
  const fixture = project(t);
  const ref = await shareProject(fixture.paths, fixture.slug, api, () => {});
  let arrivals = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("/c/0")) {
      const first = ++arrivals === 1;
      if (arrivals === 2) release();
      await gate;
      if (first) return new Response(Buffer.alloc(16));
    }
    return request(url, options);
  });
  const results = await Promise.allSettled([
    importShare(fixture.paths, { ...ref, api }, () => {}),
    importShare(fixture.paths, { ...ref, api }, () => {}),
  ]);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const successful = results.find((result) => result.status === "fulfilled");
  assert.ok(successful);
  assertImported(fixture, successful.value);
});
