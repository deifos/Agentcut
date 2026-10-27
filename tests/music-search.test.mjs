import assert from "node:assert/strict";
import test from "node:test";
import { MUSIC_TRACKS } from "../lib/music-tracks.ts";
import { MUSIC_ANALYSIS, parseMusicQuery, searchMusic } from "../lib/music-search.ts";

test("plain words become filters", () => {
  assert.deepEqual(parseMusicQuery("High energy synthwave, no vocals"), {
    energy: [4, 5],
    vocals: false,
    words: ["synthwave"],
  });
  assert.deepEqual(parseMusicQuery("calm piano 90 bpm"), { energy: [1, 2], minBpm: 82, maxBpm: 98, words: ["piano"] });
  assert.deepEqual(parseMusicQuery("something fast and dark"), { minBpm: 125, words: ["dark"] });
});

test("every library song is analyzed", () => {
  const missing = MUSIC_TRACKS.filter((t) => !t.isCustom && !MUSIC_ANALYSIS[t.id]).map((t) => t.id);
  assert.deepEqual(missing, []);
  for (const a of Object.values(MUSIC_ANALYSIS)) {
    assert.ok(a.energy >= 1 && a.energy <= 5);
    assert.ok(a.bpm >= 50 && a.bpm <= 220);
  }
});

test("search applies the filters it understood", () => {
  const { filters, tracks } = searchMusic({ query: "high energy no vocals", minSeconds: 30 });
  assert.deepEqual(filters, { energy: [4, 5], vocals: false });
  assert.ok(tracks.length > 0);
  for (const { track, analysis } of tracks) {
    assert.ok(analysis.energy >= 4 && !analysis.vocals && track.durationSeconds >= 30);
  }
  const calm = searchMusic({ query: "calm" }).tracks;
  assert.ok(calm.length > 0 && calm.every(({ analysis }) => analysis.energy <= 2));
});

test("a recording listed twice shows up once", () => {
  const copies = Object.entries(MUSIC_ANALYSIS).filter(([, a]) => a.sameAs);
  assert.ok(copies.length > 0);
  const listed = new Set(searchMusic({}).tracks.map(({ track }) => track.id));
  for (const [id, a] of copies) {
    assert.ok(!listed.has(id) && listed.has(a.sameAs));
  }
});

test("words narrow to songs that match them, and ids give those songs", () => {
  const { tracks } = searchMusic({ query: "orchestral" });
  assert.ok(tracks.length > 0 && tracks.length < MUSIC_TRACKS.length);
  const ids = tracks.slice(0, 2).map(({ track }) => track.id);
  assert.deepEqual(searchMusic({ ids }).tracks.map(({ track }) => track.id).sort(), [...ids].sort());
});

test("category and name searches keep matching aliases", () => {
  assert.ok(searchMusic({ category: "ambient" }).tracks.some(({ track }) => track.id === "radiant-console"));
  assert.ok(searchMusic({ query: "Ulaanbaatar Storm" }).tracks.some(({ track }) => track.id === "ulaanbaatar-storm"));
});

test("explicit ids are not removed by query words or duplicate removal", () => {
  const ids = ["radiant-console", "candela-workspace"];
  assert.deepEqual(searchMusic({ ids, query: "radiant" }).tracks.map(({ track }) => track.id).sort(), [...ids].sort());
});
