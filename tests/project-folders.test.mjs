import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync, writeFileSync } from "node:fs";
import { tempDir } from "./helpers/temp.mjs";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";
import {
  createProject,
  listProjects,
  moveProjectToDate,
} from "../packages/agentcut/src/studio/projects.ts";
import {
  groupProjects,
  localDateKey,
  projectDate,
} from "../lib/studio/project-folders.ts";

test("date moves persist without changing project files, chat, or creation time", () => {
  const paths = workspacePaths(tempDir(join(tmpdir(), "agentcut-folders-")));
  const { slug } = createProject(paths, {
    name: "Launch",
    folderDate: "2026-11-03",
  });
  const dir = join(paths.projects, slug);
  writeFileSync(
    join(dir, ".studio", "chat.json"),
    '{"sessionId":"keep-me","projectTokens":120}',
  );
  const files = ["project.json", "layers.json", ".studio/chat.json"].map(
    (file) => [file, readFileSync(join(dir, file), "utf8")],
  );
  const before = listProjects(paths)[0];
  moveProjectToDate(paths, slug, "2026-10-28");
  const after = listProjects(paths)[0];
  assert.equal(after.folderDate, "2026-10-28");
  assert.equal(after.createdAt, before.createdAt);
  assert.equal(after.updatedAt, before.updatedAt);
  for (const [file, contents] of files)
    assert.equal(readFileSync(join(dir, file), "utf8"), contents);
  assert.throws(
    () => moveProjectToDate(paths, slug, "2026-02-30"),
    /valid date/,
  );
  assert.throws(
    () => moveProjectToDate(paths, slug, "..\\elsewhere"),
    /valid date/,
  );
  assert.throws(
    () => moveProjectToDate(paths, "missing", "2026-11-03"),
    /not found/,
  );
  assert.throws(
    () => createProject(paths, { name: "Bad", folderDate: "2026-13-01" }),
    /valid date/,
  );
  assert.equal(listProjects(paths).length, 1);
});

test("search finds every project by name or date and groups newest dates first", () => {
  const projects = Array.from({ length: 35 }, (_, i) => ({
    slug: `project-${i}`,
    name: i === 34 ? "Launch promo" : `Video ${i}`,
    updatedAt: i,
    folderDate: i === 34 ? "2026-11-03" : "2026-10-28",
  }));
  const search = (query) => groupProjects(projects, query, "2026-11-04");
  assert.deepEqual(
    search("").map((group) => group.date),
    ["2026-11-04", "2026-11-03", "2026-10-28"],
  );
  assert.equal(
    search("").reduce((count, group) => count + group.projects.length, 0),
    35,
  );
  for (const query of [
    "promo",
    "Nov 3",
    "November 3, 2026",
    "2026-11-03",
    "launch Nov 3",
  ]) {
    assert.equal(search(query)[0].projects[0].slug, "project-34", query);
  }
  assert.deepEqual(search("absent"), []);
  const ambiguous = [
    ...projects,
    {
      slug: "video-3",
      name: "Video 3",
      updatedAt: 100,
      folderDate: "2026-11-04",
    },
  ];
  assert.deepEqual(
    groupProjects(ambiguous, "Nov 3", "2026-11-04").map((group) => group.date),
    ["2026-11-03"],
  );
  const createdAt = new Date(2026, 9, 28, 23, 30).getTime();
  assert.equal(projectDate({ createdAt, updatedAt: Date.now() }), "2026-10-28");
  assert.equal(localDateKey(new Date(2026, 10, 4, 0, 1)), "2026-11-04");
});
