import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { tempDir } from "./helpers/temp.mjs";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";
import { createProject } from "../packages/agentcut/src/studio/projects.ts";
import {
  installCommunityStyle,
  saveEditingStyle,
} from "../packages/agentcut/src/studio/editing-styles.ts";
import { makeEditingStyleDemo } from "../packages/agentcut/src/studio/editing-style-demo.ts";
import {
  communityStyleFromHash,
  communityStudioHash,
  filterCommunityStyles,
  normalizePrompt,
  parseCommunityIndex,
  parseCommunityStyleMeta,
  parseTags,
  sha256Hex,
  submissionIssueUrl,
} from "../lib/community-styles.ts";
import { readCommunityCatalog, readCommunityStyleFolder } from "../lib/community-styles-read.ts";
import { applyEditingStyleRequest, parseEditingStyle } from "../lib/studio/editing-styles.ts";
import { unzipStore, zipStore } from "../lib/zip-store.ts";

const CATALOG = resolve("public", "community-styles");
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(12)]);
const META = {
  version: 1,
  name: "Calm explainer",
  description: "Slow pushes, lower-third captions and soft music.",
  author: { name: "Ada", github: "ada-l" },
  tags: ["explainer", "captions"],
  revision: 1,
};
const PROMPT = "Use lower-third captions.\r\nPush in slowly on key lines.\n";

function styleFolder(overrides = {}, files = {}) {
  const dir = tempDir(join(tmpdir(), "community-style-"));
  const folder = join(dir, "calm-explainer");
  mkdirSync(folder);
  const all = {
    "style.json": JSON.stringify({ ...META, ...overrides }),
    "PROMPT.md": PROMPT,
    "poster.jpg": JPEG,
    "demo.mp4": MP4,
    ...files,
  };
  for (const [name, data] of Object.entries(all)) if (data !== null) writeFileSync(join(folder, name), data);
  return { dir, folder };
}

test("the catalog in the repo is valid and survives the studio's index parser", async () => {
  const index = readCommunityCatalog(CATALOG);
  assert.ok(index.styles.length >= 1);
  const parsed = parseCommunityIndex(JSON.parse(JSON.stringify(index)));
  assert.deepEqual(parsed.styles.map((style) => style.id), index.styles.map((style) => style.id));
  for (const style of index.styles) {
    // The browser's hash of the served prompt must match the build's.
    const served = readFileSync(join(CATALOG, style.id, "PROMPT.md"), "utf8");
    assert.equal(await sha256Hex(normalizePrompt(served)), style.promptSha256);
  }
});

test("a style folder holds only the allowed files, within limits and of the right type", () => {
  const ok = readCommunityStyleFolder(styleFolder().folder, "calm-explainer");
  assert.equal(ok.demo, "calm-explainer/demo.mp4");
  assert.equal(ok.promptSha256, createHash("sha256").update(normalizePrompt(PROMPT)).digest("hex"));
  assert.equal(readCommunityStyleFolder(styleFolder({}, { "demo.mp4": null }).folder, "calm-explainer").demo, null);

  const rejects = (folder, pattern) => assert.throws(() => readCommunityStyleFolder(folder, "calm-explainer"), pattern);
  rejects(styleFolder({}, { "run.sh": "echo hi" }).folder, /not allowed/);
  rejects(styleFolder({}, { "poster.jpg": null }).folder, /poster\.jpg is missing/);
  rejects(styleFolder({}, { "poster.jpg": Buffer.from("<svg/>") }).folder, /JPEG/);
  rejects(styleFolder({}, { "demo.mp4": Buffer.from("not a video at all") }).folder, /MP4/);
  rejects(styleFolder({}, { "PROMPT.md": "x".repeat(64_001) }).folder, /limit/);
  rejects(styleFolder({ homepage: "https://example.com" }).folder, /unknown fields/);
  rejects(styleFolder({ tags: ["Not A Tag"] }).folder, /tags/);
  rejects(styleFolder({ author: { name: "Ada", github: "-bad-" } }).folder, /GitHub/);
  const sub = styleFolder();
  mkdirSync(join(sub.folder, "nested"));
  rejects(sub.folder, /not allowed/);
  assert.throws(() => readCommunityStyleFolder(styleFolder().folder, "Bad_Id"), /folder name/);
});

test("the index parser drops malformed entries instead of failing the whole library", () => {
  const good = readCommunityStyleFolder(styleFolder().folder, "calm-explainer");
  const index = parseCommunityIndex({
    version: 1,
    styles: [
      good,
      { ...good, id: "../escape" },
      { ...good, id: "other", poster: "https://evil.example/poster.jpg" },
      { ...good, id: "nohash", promptSha256: "abc" },
    ],
  });
  assert.deepEqual(index.styles.map((style) => style.id), ["calm-explainer"]);
  assert.throws(() => parseCommunityIndex({ version: 2, styles: [] }));
  assert.deepEqual(filterCommunityStyles(index.styles, "jazz ADA", null).length, 0);
  assert.deepEqual(filterCommunityStyles(index.styles, "calm ada", "captions").length, 1);
  assert.deepEqual(filterCommunityStyles(index.styles, "", "vertical").length, 0);
});

function workspace() {
  const paths = workspacePaths(tempDir(join(tmpdir(), "agentcut-community-")));
  mkdirSync(paths.library, { recursive: true });
  return paths;
}

function installInput(overrides = {}) {
  const prompt = normalizePrompt(PROMPT);
  return {
    id: "calm-explainer",
    name: META.name,
    description: META.description,
    prompt,
    sha256: createHash("sha256").update(prompt).digest("hex"),
    revision: 1,
    author: META.author,
    tags: META.tags,
    catalog: "https://agentcut.example/community-styles",
    poster: "https://agentcut.example/community-styles/calm-explainer/poster.jpg",
    demo: "https://agentcut.example/community-styles/calm-explainer/demo.mp4",
    ...overrides,
  };
}

test("installing a community style adds a saved style once, pinned to the reviewed rules", () => {
  const paths = workspace();
  // A personal style with the same name is never overwritten.
  const own = saveEditingStyle(paths, { name: META.name, description: "Mine.", prompt: "My own rules." });
  const first = installCommunityStyle(paths, installInput());
  assert.equal(first.existing, false);
  assert.notEqual(first.id, own.id);
  assert.equal(readFileSync(join(paths.library, "editing-styles", own.id, "PROMPT.md"), "utf8").trim(), "My own rules.");

  const again = installCommunityStyle(paths, installInput());
  assert.deepEqual(again, { id: first.id, name: META.name, existing: true });

  const dir = join(paths.library, "editing-styles", first.id);
  const meta = JSON.parse(readFileSync(join(dir, "style.json"), "utf8"));
  assert.equal(meta.source.kind, "community");
  assert.equal(meta.source.id, "calm-explainer");
  const style = parseEditingStyle(first.id, meta, readFileSync(join(dir, "PROMPT.md"), "utf8"));
  assert.equal(style.source?.sha256, installInput().sha256);
  assert.equal(style.preview?.demo, installInput().demo);
  assert.deepEqual(style.author, META.author);

  // A newer revision is added alongside; the old copy stays.
  const prompt2 = "New rules.";
  const updated = installCommunityStyle(paths, installInput({
    prompt: prompt2,
    sha256: createHash("sha256").update(prompt2).digest("hex"),
    revision: 2,
  }));
  assert.equal(updated.existing, false);
  assert.notEqual(updated.id, first.id);
  assert.ok(existsSync(join(dir, "PROMPT.md")));
});

test("installing rejects rules that don't match the hash and catalog files off the web", () => {
  const paths = workspace();
  assert.throws(() => installCommunityStyle(paths, installInput({ prompt: "Tampered rules." })), /reviewed version/);
  assert.throws(() => installCommunityStyle(paths, installInput({ catalog: "file:///etc" })));
  assert.throws(() => installCommunityStyle(paths, installInput({ poster: "http://evil.example/p.jpg" })));
  assert.throws(() => installCommunityStyle(paths, installInput({ id: "../up" })));
  assert.ok(installCommunityStyle(paths, installInput({ catalog: "http://localhost:3000/community-styles", demo: null })).id);
});

test("community styles are applied with a guard against instructions outside editing", () => {
  const base = { id: "calm", name: "Calm", description: "d", prompt: "p" };
  const community = { ...base, source: { kind: "community", id: "calm", catalog: "https://x", revision: 1, sha256: "a".repeat(64) } };
  assert.match(applyEditingStyleRequest(community, "proj"), /public community library/);
  assert.doesNotMatch(applyEditingStyleRequest(base, "proj"), /community library/);
  // Saved styles without the new fields still load.
  assert.equal(parseEditingStyle("calm", { version: 1, name: "Calm", description: "d" }, "p").source, undefined);
  // Malformed community fields are dropped, not trusted.
  const odd = parseEditingStyle("calm", { version: 1, name: "Calm", description: "d", preview: { demo: "javascript:alert(1)" }, source: { kind: "community", id: "../x" } }, "p");
  assert.equal(odd.preview, undefined);
  assert.equal(odd.source, undefined);
});

test("demos are made only from this project's renders and into saved style folders", async () => {
  const paths = workspace();
  const slug = createProject(paths, { name: "Demo source", fonts: [] }).slug;
  const saved = saveEditingStyle(paths, { name: "Mine", description: "d", prompt: "p" });
  const call = (input) => makeEditingStyleDemo(paths, { id: saved.id, project: slug, path: "renders/a.mp4", start: 0, duration: 6, ...input });
  await assert.rejects(call({ path: "assets/raw.mp4" }), /renders folder/);
  await assert.rejects(call({ path: "renders/../../secret.mp4" }));
  await assert.rejects(call({ duration: 30 }));
  await assert.rejects(call({ id: "../projects" }));
  mkdirSync(join(paths.projects, slug, "renders"), { recursive: true });
  writeFileSync(join(paths.projects, slug, "renders", "a.mp4"), MP4);
  await assert.rejects(call({ id: "missing-style" }), /no longer exists/);
});

test("submission zips round-trip, and damaged or compressed zips are refused", () => {
  const files = [
    { name: "calm-explainer/style.json", data: new TextEncoder().encode(JSON.stringify(META)) },
    { name: "calm-explainer/demo.mp4", data: new Uint8Array(MP4) },
  ];
  const zip = zipStore(files);
  const back = unzipStore(zip);
  assert.deepEqual(back.map((file) => file.name), files.map((file) => file.name));
  assert.deepEqual([...back[1].data], [...files[1].data]);
  const damaged = zip.slice();
  damaged[30 + "calm-explainer/style.json".length + 2] ^= 0xff; // a byte of style.json's data
  assert.throws(() => unzipStore(damaged), /damaged/);
  const compressed = zip.slice();
  const view = new DataView(compressed.buffer);
  const central = compressed.findIndex((_, i) => view.getUint32(i, true) === 0x02014b50);
  view.setUint16(central + 10, 8, true);
  assert.throws(() => unzipStore(compressed), /compressed/);
  assert.throws(() => zipStore([{ name: "../evil", data: new Uint8Array() }]));
});

test("the maintainer script adds a valid submission and refuses duplicates and bad ones", () => {
  const site = tempDir(join(tmpdir(), "community-site-"));
  mkdirSync(join(site, "public", "community-styles"), { recursive: true });
  const { folder } = styleFolder();
  const zip = join(site, "calm-explainer.zip");
  writeFileSync(zip, zipStore(["style.json", "PROMPT.md", "poster.jpg", "demo.mp4"].map((name) => ({
    name: `calm-explainer/${name}`,
    data: new Uint8Array(readFileSync(join(folder, name))),
  }))));
  const script = resolve("scripts", "community-style.mjs");
  const tsx = import.meta.resolve("tsx");
  const run = (...args) => spawnSync(process.execPath, ["--import", tsx, script, ...args], { cwd: site, encoding: "utf8" });
  const added = run("add", zip);
  assert.equal(added.status, 0, added.stderr);
  assert.match(added.stdout, /Push in slowly/);
  assert.ok(existsSync(join(site, "public", "community-styles", "calm-explainer", "demo.mp4")));
  assert.notEqual(run("add", zip).status, 0);
  assert.notEqual(run("add", zip, "--update").status, 0); // same revision
  const bad = styleFolder({}, { "notes.txt": "hi" });
  assert.notEqual(run("add", bad.folder).status, 0);
  // The same rules under another id are a re-share, not a new style.
  const twin = join(site, "twin");
  cpSync(folder, join(twin, "calm-copy"), { recursive: true });
  const duplicate = run("add", join(twin, "calm-copy"));
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /already listed as "calm-explainer"/);
  const checked = run("check");
  assert.equal(checked.status, 0, checked.stderr);
  // The folder copy keeps working for the next revision.
  const next = join(site, "next");
  cpSync(folder, join(next, "calm-explainer"), { recursive: true });
  writeFileSync(join(next, "calm-explainer", "style.json"), JSON.stringify({ ...META, revision: 2 }));
  assert.equal(run("add", join(next, "calm-explainer"), "--update").status, 0);
});

test("small helpers: tags, links and the submission form", () => {
  assert.deepEqual(parseTags("Vertical, Talking head,, talking-head, ÉMOJI 🎬"), ["vertical", "talking-head", "emoji"]);
  assert.equal(communityStyleFromHash(communityStudioHash("tiktok-style")), "tiktok-style");
  assert.equal(communityStyleFromHash("#community-style=../x"), null);
  const meta = parseCommunityStyleMeta(META);
  const url = new URL(submissionIssueUrl(meta, "calm-explainer"));
  assert.equal(url.hostname, "github.com");
  assert.equal(url.searchParams.get("title"), "Community style: Calm explainer");
  assert.match(url.searchParams.get("body"), /calm-explainer\.zip/);
});
