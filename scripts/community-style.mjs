#!/usr/bin/env node
// Maintain the community style catalog (public/community-styles/).
//
//   npm run community:check                      validate every style in the catalog
//   npm run community:add -- <file.zip|folder>   validate a submission and add it
//   npm run community:add -- <file.zip> --update replace a listed style with a newer revision
//
// A submission is the zip from Studio → Styles → Saved → Share publicly: one folder named after
// the style holding style.json, PROMPT.md, poster.jpg and demo.mp4. Read the rules this prints
// before committing: they are instructions people's agents will follow.
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { DEFAULT_CATALOG_DIR, readCommunityCatalog, readCommunityPrompt, readCommunityStyleFolder } from "../lib/community-styles-read.ts";
import { COMMUNITY_STYLE_FILES, COMMUNITY_STYLE_ID } from "../lib/community-styles.ts";
import { unzipStore } from "../lib/zip-store.ts";

const [command, source, ...flags] = process.argv.slice(2);

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function check() {
  const { styles } = readCommunityCatalog();
  for (const style of styles)
    console.log(`✓ ${style.id}  r${style.revision}  ${style.name} by ${style.author.name}${style.demo ? "" : "  (no demo)"}`);
  console.log(`\n${styles.length} community style${styles.length === 1 ? "" : "s"} OK.`);
}

/** Unpack a submission into a temp folder and return the style folder inside it. */
function stage(input) {
  const path = resolve(input);
  if (!existsSync(path)) fail(`${input} doesn't exist.`);
  const temp = mkdtempSync(join(tmpdir(), "community-style-"));
  try {
    return { temp, id: unpack(path, temp) };
  } catch (error) {
    rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

/** Copy the submission's style folder into temp and return its id. */
function unpack(path, temp) {
  if (lstatSync(path).isDirectory()) {
    // A folder: either the style folder itself or one holding it.
    const inner = readdirSync(path).filter((name) => !name.startsWith("."));
    const dir = inner.includes("style.json") ? path : inner.length === 1 ? join(path, inner[0]) : fail("Expected one style folder.");
    const id = basename(dir);
    mkdirSync(join(temp, id));
    for (const name of readdirSync(dir)) {
      if (!(name in COMMUNITY_STYLE_FILES)) fail(`"${name}" is not allowed in a style.`);
      cpSync(join(dir, name), join(temp, id, name));
    }
    return id;
  }
  const files = unzipStore(new Uint8Array(readFileSync(path)));
  const ids = new Set(files.map((file) => file.name.split("/")[0]));
  if (ids.size !== 1) fail("The zip must hold exactly one style folder.");
  const [id] = ids;
  if (!COMMUNITY_STYLE_ID.test(id)) fail(`"${id}" isn't a valid style id (lowercase letters, numbers, dashes).`);
  mkdirSync(join(temp, id));
  for (const file of files) {
    const parts = file.name.split("/");
    if (parts.length !== 2 || !(parts[1] in COMMUNITY_STYLE_FILES)) fail(`"${file.name}" is not allowed in a style.`);
    writeFileSync(join(temp, id, parts[1]), file.data);
  }
  return id;
}

function add() {
  if (!source) fail("Usage: npm run community:add -- <submission.zip|folder> [--update]");
  const update = flags.includes("--update");
  const { temp, id } = stage(source);
  try {
    const entry = readCommunityStyleFolder(join(temp, id), id);
    const target = join(DEFAULT_CATALOG_DIR, id);
    if (existsSync(target)) {
      if (!update) fail(`"${id}" is already listed. Pass --update to replace it with a newer revision.`);
      const current = readCommunityStyleFolder(target, id);
      if (entry.revision <= current.revision)
        fail(`The submission is revision ${entry.revision}; the listed one is ${current.revision}. Bump "revision" in style.json.`);
      if (entry.promptSha256 === current.promptSha256 && entry.revision === current.revision) fail("Nothing changed.");
    } else if (update) fail(`"${id}" isn't listed yet; drop --update to add it.`);
    // The same rules under another id is a re-share of a listed style, not a new one.
    const twin = readCommunityCatalog().styles.find((style) => style.id !== id && style.promptSha256 === entry.promptSha256);
    if (twin) fail(`These rules are already listed as "${twin.id}" (${twin.name} by ${twin.author.name}).`);

    console.log(`\n${entry.name} (${id}) by ${entry.author.name}${entry.author.github ? ` (github: ${entry.author.github})` : ""}`);
    console.log(`revision ${entry.revision} · tags: ${entry.tags.join(", ") || "none"} · demo: ${entry.demo ? "yes" : "no"}`);
    console.log(`\n${entry.description}\n`);
    console.log("──────── PROMPT.md (read all of it before committing) ────────\n");
    console.log(readCommunityPrompt(id, temp));
    console.log("\n───────────────────────────────────────────────────────────────");

    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    for (const name of readdirSync(join(temp, id))) cpSync(join(temp, id, name), join(target, name));
    readCommunityStyleFolder(target, id);
    console.log(`\n✓ ${update ? "Updated" : "Added"} public/community-styles/${id}/. Check the demo, then commit.`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

try {
  if (command === "check") check();
  else if (command === "add") add();
  else fail("Usage: community-style.mjs check | add <submission.zip|folder> [--update]");
} catch (error) {
  console.error(`
✗ ${error instanceof Error ? error.message : String(error)}
`);
  process.exitCode = 1;
}
