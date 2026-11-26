import assert from "node:assert/strict";
import test from "node:test";
import { insertEntry, readCatalog, slug } from "../scripts/music-catalog/add.mjs";

const track = (name, category) => ({ id: slug(name), name, filename: `${name}.mp3`, category, durationSeconds: 120 });

function entriesOf(src, category) {
  return [...src.matchAll(/name: ("(?:[^"\\]|\\.)*"),\s*filename: "[^"]*",\s*category: "([a-z]+)"/g)]
    .filter((m) => m[2] === category)
    .map((m) => JSON.parse(m[1]));
}

test("music:add slugs names into catalog ids", () => {
  assert.equal(slug("Night Drive Loop"), "night-drive-loop");
  assert.equal(slug("Café (Late Mix)!"), "cafe-late-mix");
});

test("music:add appends a song to the end of its category", () => {
  const { src } = readCatalog();
  for (const category of ["energetic", "electronic", "cinematic", "chill", "ambient"]) {
    const name = `Aaa Test Song ${category}`;
    const out = insertEntry(src, track(name, category));
    assert.deepEqual(entriesOf(out, category), [...entriesOf(src, category), name]);
    for (const other of ["energetic", "electronic", "cinematic", "chill", "ambient"].filter((c) => c !== category))
      assert.deepEqual(entriesOf(out, other), entriesOf(src, other));
    assert.equal(readCatalogFrom(out).length, readCatalogFrom(src).length + 1);
    // The layout around it is kept: a blank line before each section header, the list closed on its own line.
    assert.match(out, /\},\r?\n\r?\n {2}\/\/ ── Electronic ──\r?\n/);
    assert.match(out, /\},\r?\n\];\r?\n/);
    assert.equal(out.includes("\r\n"), src.includes("\r\n"));
    if (src.includes("\r\n")) assert.ok(!/[^\r]\n/.test(out), "line endings stay CRLF");
  }
});

function readCatalogFrom(src) {
  return [...src.matchAll(/id: "([^"]+)",\s*name:/g)].map((m) => m[1]);
}
