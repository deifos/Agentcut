import assert from "node:assert/strict";
import test from "node:test";
import {
  exportCanvasVideos,
  readExportVideo,
} from "../lib/studio/canvas-export.ts";
function video(slug, variants = { wide: { width: 1920, height: 1080 } }) {
  return {
    slug,
    name: slug,
    doc: {
      slug,
      project: { variants },
      layers: { tracks: [{ kind: "scene", clips: [{}] }] },
      projectHash: "p",
      layersHash: "l",
    },
    assets: [{ path: "assets/a.png", size: 1, updatedAt: 1 }],
    bundle: { revision: 1 },
    error: null,
  };
}
function setup(videos) {
  const renders = [],
    events = [],
    saved = [];
  return {
    renders,
    events,
    saved,
    deps: {
      members: async () => Object.keys(videos),
      read: async (slug) => structuredClone(videos[slug]),
      load: async (v) => ({
        slug: v.slug,
        revision: v.bundle.revision,
        module: {},
      }),
      render: async (v, variant, loaded, report) => {
        renders.push([v.slug, variant, loaded?.slug]);
        report("rendering", 0.5);
        return { path: `renders/${v.slug}-${variant}.mp4` };
      },
      onProgress: (e) => events.push(e),
      onResult: (e) => saved.push(e),
    },
  };
}
const choice = (slug, variants = ["wide"]) => ({ slug, name: slug, variants });
test("binds each serial file to its own document/module/format; removes duplicates", async () => {
  const s = setup({
    a: video("a"),
    b: video("b", { square: { width: 1080, height: 1080 } }),
  });
  await exportCanvasVideos(
    [choice("a"), choice("a", ["wide", "wide"]), choice("b", ["square"])],
    "browser",
    new AbortController().signal,
    s.deps,
  );
  assert.deepEqual(s.renders, [
    ["a", "wide", "a"],
    ["b", "square", "b"],
  ]);
  assert.deepEqual(
    s.events
      .filter((e) => e.stage === "preparing")
      .map((e) => [e.slug, e.index, e.total]),
    [
      ["a", 1, 2],
      ["b", 2, 2],
    ],
  );
});
test("preflights every video before any render, including missing, editing and per-video formats", async () => {
  for (const kind of ["missing", "editing", "variant", "empty"]) {
    const videos = { a: video("a"), b: video("b") };
    if (kind === "editing") videos.b.error = "Editing now";
    const s = setup(videos);
    const choices =
      kind === "missing"
        ? [choice("a"), choice("gone")]
        : kind === "variant"
          ? [choice("a"), choice("b", ["mobile"])]
          : kind === "empty"
            ? [choice("a"), choice("b", [])]
            : [choice("a"), choice("b")];
    await assert.rejects(
      exportCanvasVideos(
        choices,
        "local",
        new AbortController().signal,
        s.deps,
      ),
    );
    assert.equal(s.renders.length, 0);
  }
});
test("stops before rendering a changed target or mismatched bundle", async () => {
  for (const kind of ["change", "bundle"]) {
    const s = setup({ a: video("a") });
    let reads = 0;
    const read = s.deps.read;
    s.deps.read = async (slug) => {
      const v = await read(slug);
      if (kind === "change" && ++reads > 1) v.doc.projectHash = "changed";
      return v;
    };
    if (kind === "bundle")
      s.deps.load = async () => ({ slug: "wrong", revision: 1, module: {} });
    await assert.rejects(
      exportCanvasVideos(
        [choice("a")],
        "browser",
        new AbortController().signal,
        s.deps,
      ),
    );
    assert.equal(s.renders.length, 0);
  }
});
test("cancellation and a failed second file preserve only actual saved results", async () => {
  const s = setup({ a: video("a"), b: video("b") });
  const render = s.deps.render;
  s.deps.render = async (...args) => {
    if (args[0].slug === "b") throw Error("failed");
    return render(...args);
  };
  await assert.rejects(
    exportCanvasVideos(
      [choice("a"), choice("b")],
      "local",
      new AbortController().signal,
      s.deps,
    ),
    /failed/,
  );
  assert.deepEqual(
    s.saved.map((f) => f.slug),
    ["a"],
  );
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    exportCanvasVideos([choice("a")], "browser", c.signal, s.deps),
  );
  assert.equal(s.renders.length, 1);
});
test("edit during render reports saved file and stops following files", async () => {
  const videos = { a: video("a"), b: video("b") },
    s = setup(videos),
    render = s.deps.render;
  s.deps.render = async (...args) => {
    const result = await render(...args);
    videos.a.assets[0].size = 2;
    return result;
  };
  await assert.rejects(
    exportCanvasVideos(
      [choice("a"), choice("b")],
      "browser",
      new AbortController().signal,
      s.deps,
    ),
    /during export/,
  );
  assert.equal(s.saved.length, 1);
  assert.equal(s.renders.length, 1);
});
test("snapshot flags empty, draft, queued and invalid videos without opening editor", async () => {
  const base = {
    slug: "a",
    project: { name: "A", variants: { wide: {} } },
    layers: { tracks: [{ kind: "audio", clips: [{}] }] },
    projectValid: true,
    layersValid: true,
    issues: [],
    bundle: { ok: true, hasCode: true, revision: 1 },
    assets: [],
    chat: { running: null, messages: [] },
  };
  for (const kind of ["draft", "empty", "queued", "invalid"]) {
    const data = structuredClone(base);
    if (kind === "empty") data.layers.tracks = [];
    if (kind === "queued") data.chat.messages = [{ status: "queued" }];
    if (kind === "invalid") data.projectValid = false;
    const result = await readExportVideo(
      {
        request: async (method, p) => {
          assert.equal(method, "studio.project.snapshot");
          assert.equal(p.slug, "a");
          return data;
        },
      },
      "a",
    );
    assert.equal(result.draft, true);
    assert.equal(Boolean(result.error), kind !== "draft");
  }
});
