import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { forgetProject, sweepWorkspace } from "../packages/agentcut/src/studio/housekeeping.ts";
import { ProxyStore } from "../packages/agentcut/src/studio/proxies.ts";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";

const DAY = 24 * 60 * 60 * 1000;

test("cleanup does not follow linked scratch folders or linked parent folders", () => {
  const { root, paths, file, age, done } = workspace();
  try {
    const outside = join(root, "user-files");
    const kept = file(join(outside, "scratch", "keep.txt"));
    age(kept, 31);
    const studio = join(paths.projects, "direct", ".studio");
    mkdirSync(studio, { recursive: true });
    symlinkSync(join(outside, "scratch"), join(studio, "scratch"), "junction");
    const project = join(paths.projects, "parent");
    mkdirSync(project, { recursive: true });
    symlinkSync(outside, join(project, ".studio"), "junction");
    sweepWorkspace(paths, { renderingSlug: null });
    assert.equal(existsSync(kept), true);
  } finally {
    done();
  }
});

function workspace() {
  const root = mkdtempSync(join(tmpdir(), "agentcut-housekeeping-"));
  const paths = workspacePaths(root);
  const file = (path, contents = "x") => {
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, contents);
    return path;
  };
  const age = (path, days) => {
    const when = new Date(Date.now() - days * DAY);
    utimesSync(path, when, when);
  };
  return { root, paths, file, age, done: () => rmSync(root, { recursive: true, force: true }) };
}

test("render links and leftovers of deleted projects go; a render in progress keeps its links", () => {
  const { paths, file, done } = workspace();
  try {
    file(join(paths.projects, "kept", "project.json"), "{}");
    file(join(paths.render, "public-kept", "assets", "a.mp4"));
    file(join(paths.render, "public-busy", "assets", "a.mp4"));
    file(join(paths.render, "kept.props.json"));
    file(join(paths.render, "gone.props.json"));
    file(join(paths.render, "gone.render.tsx"));
    file(join(paths.render, "remotion.config.ts"));
    sweepWorkspace(paths, { renderingSlug: "busy" });
    assert.equal(existsSync(join(paths.render, "public-kept")), false);
    assert.equal(existsSync(join(paths.render, "public-busy", "assets", "a.mp4")), true);
    assert.equal(existsSync(join(paths.render, "kept.props.json")), true);
    assert.equal(existsSync(join(paths.render, "gone.props.json")), false);
    assert.equal(existsSync(join(paths.render, "gone.render.tsx")), false);
    assert.equal(existsSync(join(paths.render, "remotion.config.ts")), true);
  } finally {
    done();
  }
});

test("deleting a project removes what was made for it outside its folder", () => {
  const { paths, file, done } = workspace();
  try {
    file(join(paths.render, "public-p", "assets", "a.mp4"));
    file(join(paths.render, "p.props.json"));
    file(join(paths.render, "other.props.json"));
    forgetProject(paths, "p");
    assert.equal(existsSync(join(paths.render, "public-p")), false);
    assert.equal(existsSync(join(paths.render, "p.props.json")), false);
    assert.equal(existsSync(join(paths.render, "other.props.json")), true);
  } finally {
    done();
  }
});

test("style trash empties after 30 days and interrupted imports after a day", () => {
  const { paths, file, age, done } = workspace();
  try {
    const trash = join(paths.internal, "deleted-editing-styles");
    file(join(trash, "old-style", "prompt.md"));
    file(join(trash, "new-style", "prompt.md"));
    age(join(trash, "old-style"), 31);
    age(join(trash, "new-style"), 5);
    file(join(paths.projects, ".incoming-old-1", "x"));
    file(join(paths.projects, ".incoming-now-1", "x"));
    age(join(paths.projects, ".incoming-old-1"), 2);
    sweepWorkspace(paths, { renderingSlug: null });
    assert.equal(existsSync(join(trash, "old-style")), false);
    assert.equal(existsSync(join(trash, "new-style")), true);
    assert.equal(existsSync(join(paths.projects, ".incoming-old-1")), false);
    // Possibly still downloading.
    assert.equal(existsSync(join(paths.projects, ".incoming-now-1")), true);
  } finally {
    done();
  }
});

test("chat pictures keep the newest 150 MB", () => {
  const { paths, file, age, done } = workspace();
  try {
    const dir = join(paths.projects, "p", ".studio", "attachments", "claude-frames");
    const big = "x".repeat(60 * 1024 * 1024);
    for (const [name, days] of [["new.png", 0], ["mid.png", 1], ["old.png", 2]]) age(file(join(dir, name), big), days);
    sweepWorkspace(paths, { renderingSlug: null });
    assert.equal(existsSync(join(dir, "new.png")), true);
    assert.equal(existsSync(join(dir, "mid.png")), true);
    assert.equal(existsSync(join(dir, "old.png")), false);
  } finally {
    done();
  }
});

test("agents' scratch expires after 14 days and stays under 500 MB", () => {
  const { paths, file, age, done } = workspace();
  try {
    const dir = join(paths.projects, "p", ".studio", "scratch");
    age(file(join(dir, "today.jpg")), 0);
    age(file(join(dir, "old", "sheet.jpg")), 15);
    const big = "x".repeat(300 * 1024 * 1024);
    age(file(join(dir, "big-new.bin"), big), 1);
    age(file(join(dir, "big-old.bin"), big), 2);
    file(join(paths.projects, "p", ".studio", "keep.json"));
    sweepWorkspace(paths, { renderingSlug: null });
    assert.equal(existsSync(join(dir, "today.jpg")), true);
    assert.equal(existsSync(join(dir, "old")), false, "expired, and its emptied folder");
    assert.equal(existsSync(join(dir, "big-new.bin")), true);
    assert.equal(existsSync(join(dir, "big-old.bin")), false, "over the size limit");
    assert.equal(existsSync(join(paths.projects, "p", ".studio", "keep.json")), true, "only scratch/ is swept");
  } finally {
    done();
  }
});

test("copies go with their footage, when unused, and when unfinished", () => {
  const { root, paths, file, age, done } = workspace();
  try {
    const dir = join(paths.internal, "proxies");
    const key = (c) => c.repeat(40);
    const source = file(join(root, "footage.mp4"));
    const copy = (k, src) => {
      file(join(dir, `${k}.mp4`));
      file(join(dir, `${k}.json`), JSON.stringify({ source: src }));
    };
    copy(key("a"), source);
    copy(key("b"), join(root, "deleted.mp4"));
    copy(key("c"), source);
    copy(key("f"), source);
    file(join(dir, `${key("f")}.json`), JSON.stringify({ source, size: 999, mtimeMs: statSync(source).mtimeMs }));
    age(join(dir, `${key("c")}.mp4`), 15);
    file(join(dir, `${key("d")}.mp4.part.mp4`));
    file(join(dir, `${key("e")}.json`), "{}");
    new ProxyStore(paths.internal).sweep();
    assert.equal(existsSync(join(dir, `${key("a")}.mp4`)), true);
    assert.equal(existsSync(join(dir, `${key("b")}.mp4`)), false, "footage deleted");
    assert.equal(existsSync(join(dir, `${key("b")}.json`)), false);
    assert.equal(existsSync(join(dir, `${key("c")}.mp4`)), false, "unused for 15 days");
    assert.equal(existsSync(join(dir, `${key("f")}.mp4`)), false, "source replaced");
    assert.equal(existsSync(join(dir, `${key("d")}.mp4.part.mp4`)), false, "unfinished");
    assert.equal(existsSync(join(dir, `${key("e")}.json`)), false, "note without a copy");
  } finally {
    done();
  }
});
