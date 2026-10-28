import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensurePreviewDependencies } from "../packages/agentcut/src/studio/workspace.ts";
import { buildProjectBundle } from "../packages/agentcut/src/studio/bundler.ts";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";

test("preview setup installs once, repairs upgrades, and retries failures", { skip: process.platform === "win32" }, async () => {
  const root = mkdtempSync(join(tmpdir(), "agentcut-deps-"));
  const bin = join(root, "bin");
  mkdirSync(bin);
  const oldPath = process.env.PATH;
  // A deterministic npm substitute: no network or changes to the user's workspace.
  writeFileSync(join(bin, "npm"), `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
fs.appendFileSync('installs', '1');
if (fs.existsSync('fail')) { console.error('registry unavailable'); process.exit(1); }
if (fs.existsSync('incomplete')) process.exit(0);
const pkg = JSON.parse(fs.readFileSync('package.json'));
for (const [name, version] of Object.entries(pkg.dependencies)) {
  const dir = path.join('node_modules', name);
  fs.mkdirSync(dir, {recursive:true});
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({version, main:'index.js'}));
  fs.writeFileSync(path.join(dir, 'index.js'), 'export const REVISION = 183;');
}
`, { mode: 0o755 });
  process.env.PATH = `${bin}:${oldPath}`;
  try {
    await Promise.all([ensurePreviewDependencies(root), ensurePreviewDependencies(root)]);
    assert.equal(readFileSync(join(root, "installs"), "utf8"), "1");
    await ensurePreviewDependencies(root);
    assert.equal(readFileSync(join(root, "installs"), "utf8"), "1");
    writeFileSync(join(root, "node_modules/three/package.json"), '{"version":"0.1.0"}');
    await ensurePreviewDependencies(root);
    assert.equal(readFileSync(join(root, "installs"), "utf8"), "11");
    rmSync(join(root, "node_modules/three"), { recursive: true });
    writeFileSync(join(root, "fail"), "");
    const paths = workspacePaths(root);
    mkdirSync(join(paths.projects, "example/scenes"), { recursive: true });
    const bundle = await buildProjectBundle(paths, "example", { revision: 1, code: "last good preview" });
    assert.equal(bundle.ok, false);
    assert.equal(bundle.code, "last good preview");
    assert.match(bundle.errors[0].text, /Preview dependency setup failed.*npm install/s);
    assert.match(bundle.errors[0].text, /registry unavailable/);
    rmSync(join(root, "fail"));
    writeFileSync(join(root, "incomplete"), "");
    await assert.rejects(ensurePreviewDependencies(root), /did not install: three/);
    rmSync(join(root, "incomplete"));
    await ensurePreviewDependencies(root);
    assert.equal(JSON.parse(readFileSync(join(root, "node_modules/three/package.json"))).version, "0.183.2");
    mkdirSync(paths.runtime, { recursive: true });
    mkdirSync(paths.render, { recursive: true });
    writeFileSync(join(paths.runtime, "index.tsx"), "export const createStudioModule = (scenes) => scenes;");
    writeFileSync(join(paths.projects, "example/scenes/Device.tsx"), 'import { REVISION } from "three"; export default function Device() { return REVISION; }');
    rmSync(join(root, "node_modules/three"), { recursive: true });
    const repaired = await buildProjectBundle(paths, "example", bundle);
    assert.equal(repaired.ok, true, JSON.stringify(repaired.errors));
    assert.match(repaired.code, /183/);
  } finally {
    process.env.PATH = oldPath;
    rmSync(root, { recursive: true, force: true });
  }
});
