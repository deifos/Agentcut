// Picks a varied set of public-domain films for the catalog: a few per theme, preferring HD scans,
// spreading decades and collections, skipping very short and very long films.
//   BROLL_DATA=E:/agentcut-broll node select.mjs [perTheme=5] [theme,theme…] [exclude.json] > films.json
import { readFileSync } from "node:fs";
import { archiveJson } from "./lib.mjs";

const PER_THEME = Number(process.argv[2] ?? 5);
const ONLY = process.argv[3] ? new Set(process.argv[3].split(",")) : null;
// Films already picked (or rejected) elsewhere: never pick them again.
const EXCLUDE = new Set(process.argv[4] ? JSON.parse(readFileSync(process.argv[4], "utf8")).map((f) => f.id ?? f) : []);
// Archival look only: no modern TV or camcorder footage (NASA's HD space footage is the exception).
const MAX_YEAR = 1985;
const MIN_WIDTH = 480;
const CANDIDATES = 10;
const COLLECTIONS = "(prelinger OR FedFlix OR nasa OR home_movies OR classic_tv_commercials)";
const MIN_S = 3 * 60;
const MAX_S = 35 * 60;

const THEMES = {
  city: "city streets traffic downtown",
  skyline: "skyscraper skyline manhattan metropolis",
  night: "night lights neon broadway",
  factory: "factory assembly line manufacturing",
  computers: "computer electronic brain automation data",
  communication: "telephone television radio communication",
  rockets: "rocket launch missile",
  space: "astronaut space moon",
  aviation: "airplane aviation flight airport",
  roads: "automobile highway driving",
  trains: "train railroad locomotive",
  sea: "ocean waves surf harbor sailing",
  farming: "farm harvest agriculture tractor",
  nature: "forest mountains river landscape",
  animals: "animals wildlife birds",
  weather: "storm weather clouds rain snow",
  disaster: "fire explosion disaster flood",
  military: "army soldiers tanks navy battle",
  school: "school children classroom",
  home: "family home kitchen housewife",
  office: "office secretary typewriter business",
  science: "science laboratory experiment",
  medicine: "doctor hospital medicine",
  sports: "baseball football boxing swimming olympics",
  dance: "dance dancing jitterbug orchestra",
  crowds: "parade celebration crowd festival",
  food: "food cooking restaurant",
  fashion: "fashion beauty style",
  travel: "travel vacation beach resort",
  construction: "construction building bridge dam",
  energy: "electricity power energy atomic",
  oil: "oil steel mining industry",
  underwater: "underwater fish diving coral",
  kids: "toys children playground games",
  holidays: "christmas holiday thanksgiving fireworks",
  signs: "signs neon advertising billboard",
  animation: "cartoon animation animated",
  circus: "circus carnival amusement park rides",
  winter: "winter snow skiing ice skating",
  west: "desert cowboys western ranch",
  future: "future tomorrow world fair robot",
  racing: "racing speedway race track rodeo",
};

const first = (v) => (Array.isArray(v) ? v[0] : v);

function seconds(runtime) {
  const text = String(first(runtime) ?? "");
  const hms = /(\d+):(\d{1,2}):(\d{2})/.exec(text) ?? /(\d+):(\d{2})/.exec(text);
  if (hms) return hms.length === 4 ? +hms[1] * 3600 + +hms[2] * 60 + +hms[3] : +hms[1] * 60 + +hms[2];
  const min = /(\d+)\s*min/i.exec(text);
  return min ? +min[1] * 60 : null;
}

async function bestWidth(id) {
  const meta = await archiveJson(`https://archive.org/metadata/${encodeURIComponent(id)}`);
  const widths = (meta.files ?? [])
    .filter((f) => f.width && /h\.264|mpeg|quicktime|matroska|prores/i.test(f.format ?? "") && Number(f.size ?? 0) < 3e9)
    .map((f) => Number(f.width));
  return widths.length ? Math.max(...widths) : 0;
}

const chosen = new Map();
for (const [theme, words] of Object.entries(THEMES)) {
  if (ONLY && !ONLY.has(theme)) continue;
  const terms = words.split(" ").join(" OR ");
  const q = `collection:${COLLECTIONS} AND mediatype:movies AND licenseurl:*publicdomain* AND (title:(${terms}) OR subject:(${terms}))`;
  const url = new URL("https://archive.org/advancedsearch.php");
  url.searchParams.set("q", q);
  for (const f of ["identifier", "title", "year", "date", "runtime", "collection", "downloads"]) url.searchParams.append("fl[]", f);
  url.searchParams.set("sort[]", "downloads desc");
  url.searchParams.set("rows", "60");
  url.searchParams.set("output", "json");
  const docs = (await archiveJson(url.href)).response.docs;
  const pool = [];
  for (const d of docs) {
    if (chosen.has(d.identifier) || EXCLUDE.has(d.identifier) || pool.length >= CANDIDATES) continue;
    const s = seconds(d.runtime);
    if (s !== null && (s < MIN_S || s > MAX_S)) continue;
    const year = Number(String(first(d.year) ?? first(d.date) ?? "").slice(0, 4)) || null;
    const collection = [].concat(d.collection ?? []).find((c) => COLLECTIONS.includes(c)) ?? "";
    if (year && year > MAX_YEAR && collection !== "nasa") continue;
    const width = await bestWidth(d.identifier);
    if (width < MIN_WIDTH) continue;
    pool.push({ id: d.identifier, title: String(first(d.title) ?? ""), year, collection, width });
  }
  // Prefer HD, then new decades and collections for this theme.
  const picks = [];
  const decades = new Set();
  const collections = new Map();
  while (picks.length < PER_THEME && pool.length) {
    pool.sort((a, b) => score(b) - score(a));
    picks.push(pool.shift());
    const p = picks.at(-1);
    decades.add(p.year ? Math.floor(p.year / 10) : null);
    collections.set(p.collection, (collections.get(p.collection) ?? 0) + 1);
  }
  function score(c) {
    return (c.width >= 1280 ? 3 : c.width >= 720 ? 1 : 0) + (decades.has(c.year ? Math.floor(c.year / 10) : null) ? 0 : 2) - (collections.get(c.collection) ?? 0);
  }
  for (const p of picks) chosen.set(p.id, { ...p, theme });
  console.error(`${theme}: ${picks.map((p) => `${p.id}(${p.year ?? "?"},${p.width})`).join(" ")}`);
}

console.log(JSON.stringify([...chosen.values()], null, 2));
