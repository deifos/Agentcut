import assert from "node:assert/strict";
import test from "node:test";
import {
  bakeCurve, gradeAtFrame, gradeCssFilter, gradePasses, gradeUniforms, isCssGrade, isNeutralGrade, mixGrades, parseCube, scaleGrade, serializeCube,
} from "../motion/components/color/grade.ts";
import { GRADE_LOOKS, gradeLook } from "../motion/components/color/looks.ts";
import { analyzePixels, colorIssues, linearToOklab, linearToSrgb, oklabToLinear, shotDifference, shotsClash, srgbToLinear } from "../lib/studio/color/analyze.ts";
import { histogramImage, parade, vectorscopeImage, waveform } from "../lib/studio/color/scopes.ts";
import { canMatchShot, combineMatches, computeShotMatch, lookDistance, lookProfile, lookTransfer } from "../lib/studio/color/match.ts";
import { layersSchema, projectSchema } from "../packages/agentcut/src/studio/schema.ts";
import { splitClip, trimClip } from "../lib/studio/edit.ts";
import { copyGrade, gradableClips, gradesToReplace } from "../lib/studio/color/copy-grade.ts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clearLiveClip, getLiveClip, setLiveClip, useLiveClip } from "../motion/components/live-clip.ts";
import { isolateClip } from "../lib/studio/color/frames.ts";

test("clip measurements retain only visible adjustments above the clip, in order", () => {
  const clip = { id: "video", src: "assets/a.mp4", from: 0, duration: 30 };
  const adjustment = (id, hidden = false) => ({ id, kind: "adjustment", hidden,
    clips: [{ id: `${id}-clip`, from: 0, duration: 30, grade: { exposure: 1 } }] });
  const doc = { slug: "test", project: { grade: { exposure: 0.5 } }, layers: { tracks: [
    adjustment("top"), adjustment("hidden", true), adjustment("middle"),
    { id: "footage", kind: "video", clips: [clip] }, adjustment("below"),
  ] } };
  const graded = isolateClip(doc, clip, "video", "graded", "wide");
  assert.deepEqual(graded.layers.tracks.map((track) => track.id), ["top", "middle", "measure"]);
  assert.deepEqual(graded.project.grade, doc.project.grade);
  const source = isolateClip(doc, clip, "video", "source", "wide");
  assert.deepEqual(source.layers.tracks.map((track) => track.id), ["measure"]);
  assert.equal(source.project.grade, undefined);
  assert.equal(doc.layers.tracks.length, 5);
});

/** Flat RGBA pixels of one colour, or a list of [colour, share] bands. */
function flat(bands, count = 4000) {
  const list = Array.isArray(bands[0]) ? bands : [[bands, 1]];
  const data = new Uint8ClampedArray(count * 4);
  let i = 0;
  for (const [[r, g, b], share] of list) {
    const n = Math.round(count * share);
    for (let k = 0; k < n && i < count; k += 1, i += 1) data.set([r, g, b, 255], i * 4);
  }
  return data;
}

test("grades: neutral values change nothing", () => {
  assert.ok(isNeutralGrade(undefined));
  assert.ok(isNeutralGrade({}));
  assert.ok(isNeutralGrade({ brightness: 1, contrast: 1, exposure: 0, wheels: { shadows: { x: 0 } } }));
  assert.ok(isNeutralGrade({ curves: { master: [[0, 0], [1, 1]] } }));
  assert.ok(isNeutralGrade({ pivot: 0.3, skinProtect: 1, lookStrength: 0.4 }), "modifiers alone do nothing");
  for (const grade of [{ exposure: 0.1 }, { look: "noir" }, { lut: "assets/a.cube" }, { grain: 0.1 }, { wheels: { midtones: { level: 0.1 } } }, { hsl: { red: { hue: 0.2 } } }, { keys: [{ frame: 0 }] }])
    assert.equal(isNeutralGrade(grade), false, JSON.stringify(grade));
});

test("grades: only the original five controls stay on the CSS path", () => {
  assert.ok(isCssGrade({ brightness: 1.1, contrast: 1.2, saturation: 0.8, warmth: 0.2, hue: 10 }));
  assert.ok(isCssGrade(undefined));
  assert.equal(isCssGrade({ contrast: 1.2, exposure: 0.5 }), false);
  assert.equal(isCssGrade({ keys: [{ frame: 0, contrast: 1 }] }), false);
});

test("grades: the CSS filter is byte for byte what it always was", () => {
  assert.equal(gradeCssFilter({ brightness: 1.1, contrast: 1.2, saturation: 0.9, warmth: 0.2, hue: 10 }),
    "brightness(1.1) contrast(1.2) saturate(0.9) sepia(0.070) saturate(1.050) hue-rotate(9.2deg)");
  assert.equal(gradeCssFilter({ warmth: -0.5 }), "hue-rotate(6.0deg)");
  assert.equal(gradeCssFilter({ brightness: 1 }), undefined);
});

test("grades: keys ease, hold and only override what they name", () => {
  const grade = { contrast: 1.2, keys: [{ frame: 10, exposure: 0 }, { frame: 20, exposure: 2 }] };
  assert.equal(gradeAtFrame(grade, 0).exposure, 0);
  assert.equal(gradeAtFrame(grade, 30).exposure, 2);
  assert.equal(gradeAtFrame(grade, 15).exposure, 1);
  assert.ok(gradeAtFrame(grade, 12).exposure < 0.4, "eases in");
  assert.equal(gradeAtFrame(grade, 15).contrast, 1.2, "base fields stay");
  const held = gradeAtFrame({ keys: [{ frame: 0, saturation: 0, hold: true }, { frame: 10, saturation: 1 }] }, 9);
  assert.equal(held.saturation, 0);
  assert.equal(gradeAtFrame({ keys: [{ frame: 5, exposure: 1, hold: true }] }, 0).hold, undefined, "key metadata doesn't leak");
  const unsorted = gradeAtFrame({ keys: [{ frame: 20, exposure: 2 }, { frame: 10, exposure: 0 }] }, 15);
  assert.equal(unsorted.exposure, 1, "order in the file doesn't matter");
});

test("grades: mixing covers wheels and the colour mixer", () => {
  const mixed = mixGrades({ wheels: { shadows: { x: 0 } }, hsl: { red: { hue: 0 } } }, { wheels: { shadows: { x: 1 } }, hsl: { red: { hue: 1 } } }, 0.5);
  assert.equal(mixed.wheels.shadows.x, 0.5);
  assert.equal(mixed.hsl.red.hue, 0.5);
});

test("grades: strength scales towards neutral", () => {
  const half = scaleGrade({ exposure: 1, saturation: 0, curves: { master: [[0, 0.2], [1, 0.8]] }, lut: "x.cube" }, 0.5);
  assert.equal(half.exposure, 0.5);
  assert.equal(half.saturation, 0.5);
  assert.deepEqual(half.curves.master, [[0, 0.1], [1, 0.9]]);
  assert.equal(half.lutStrength, 0.5);
  assert.ok(isNeutralGrade(scaleGrade({ exposure: 1, grain: 0.5, vignette: 0.3 }, 0)));
});

test("grades: passes put the correction first and the finish last", () => {
  const passes = gradePasses({ exposure: 1, grain: 0.5, look: "noir" }, 0, gradeLook);
  assert.equal(passes.length, 2);
  assert.equal(passes[0].exposure, 1);
  assert.equal(passes[0].grain, undefined);
  assert.equal(passes[1].grain, 0.5, "the clip's grain overrides the look's");
  assert.deepEqual(gradePasses({}, 0, gradeLook), []);
  assert.deepEqual(gradePasses({ look: "not-real" }, 0, gradeLook), [], "unknown looks draw nothing");
  assert.equal(gradePasses({ look: "noir" }, 0, gradeLook).length, 1);
});

test("uniforms: neutral fields give the identity", () => {
  const u = gradeUniforms({});
  assert.deepEqual(u.matrix, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  u.gains.forEach((g) => assert.ok(Math.abs(g - 1) < 1e-9));
  assert.deepEqual(u.lift, [0, 0, 0]);
  assert.deepEqual(u.gain, [1, 1, 1]);
  assert.equal(u.lutStrength, 0, "no file, no LUT");
  assert.equal(gradeUniforms({ lut: "x", lutStrength: 0.4 }).lutStrength, 0.4);
  assert.ok(gradeUniforms({ blackPoint: 0.9, whitePoint: 0.1 }).whitePoint > 0.9, "levels never divide by zero");
});

test("uniforms: white balance keeps brightness", () => {
  for (const fields of [{ temperature: 1 }, { temperature: -1 }, { tint: 1 }, { tint: -1 }]) {
    const [r, g, b] = gradeUniforms(fields).gains;
    assert.ok(Math.abs(0.2126 * r + 0.7152 * g + 0.0722 * b - 1) < 1e-6, JSON.stringify(fields));
  }
  const warm = gradeUniforms({ temperature: 0.5 }).gains;
  assert.ok(warm[0] > warm[2]);
});

test("curves: pass through their points, stay monotonic and in range", () => {
  const points = [[0, 0], [0.25, 0.1], [0.75, 0.9], [1, 1]];
  const curve = bakeCurve(points, 1001);
  assert.ok(Math.abs(curve[250] - 0.1) < 0.002);
  assert.ok(Math.abs(curve[750] - 0.9) < 0.002);
  for (let i = 1; i < curve.length; i += 1) assert.ok(curve[i] >= curve[i - 1] - 1e-6, `dips at ${i}`);
  assert.ok(Math.abs(bakeCurve(undefined, 11)[5] - 0.5) < 1e-6);
  const open = bakeCurve([[0.2, 0.3], [0.8, 0.7]], 101);
  assert.ok(Math.abs(open[0] - 0.3) < 1e-6 && Math.abs(open[100] - 0.7) < 1e-6, "flat past its ends");
  const dupes = bakeCurve([[0.5, 0.2], [0.5, 0.6], [NaN, 1]], 11);
  assert.ok(dupes.every((v) => Number.isFinite(v)), "bad points are survivable");
});

test(".cube: round trips and reads comments, domains and Windows lines", () => {
  const text = serializeCube(3, 'A "look"', (r, g, b) => [b, g, r]);
  const lut = parseCube(text);
  assert.equal(lut.size, 3);
  // Red changes fastest: index 1 is r=0.5, g=0, b=0, which the swap sends to (0, 0, 0.5).
  assert.deepEqual([...lut.data.slice(4, 8)], [0, 0, 0.5, 1]);
  const crlf = parseCube('# made elsewhere\r\nTITLE "x"\r\nDOMAIN_MIN 0 0 0\r\nDOMAIN_MAX 2 2 2\r\nLUT_3D_SIZE 2\r\n0 0 0\r\n1 0 0\r\n0 1 0\r\n1 1 0\r\n0 0 1\r\n1 0 1\r\n0 1 1\r\n1 1 1\r\n');
  assert.deepEqual(crlf.domainMax, [2, 2, 2]);
  assert.match(text, /^TITLE "A  look "/, "titles can't break the file");
});

test(".cube: rejects what it can't use, with a reason", () => {
  assert.throws(() => parseCube("LUT_1D_SIZE 16\n"), /1D LUT/);
  assert.throws(() => parseCube("hello"), /doesn't look like a .cube/);
  assert.throws(() => parseCube("LUT_3D_SIZE 2\n0 0 0\n"), /incomplete/);
  assert.throws(() => parseCube("LUT_3D_SIZE 999\n"), /between/);
  assert.throws(() => parseCube("0 0 0\nLUT_3D_SIZE 2\n"), /before LUT_3D_SIZE/);
  assert.throws(() => parseCube("LUT_3D_SIZE 2\nDOMAIN_MIN 1 1 1\nDOMAIN_MAX 0 0 0\n" + "0 0 0\n".repeat(8)), /DOMAIN_MIN/);
  assert.throws(() => parseCube("LUT_3D_SIZE 2\n" + "0 0 0\n".repeat(9)), /too many/);
  assert.throws(() => parseCube("LUT_3D_SIZE 2\n0 x 0\n"), /unreadable/);
});

test("looks: all valid, unique, and each actually changes the picture", () => {
  assert.ok(GRADE_LOOKS.length >= 12);
  assert.equal(new Set(GRADE_LOOKS.map((look) => look.id)).size, GRADE_LOOKS.length);
  for (const look of GRADE_LOOKS) {
    assert.equal(isNeutralGrade(look.fields), false, look.id);
    assert.ok(look.description.length > 8, look.id);
    assert.equal(gradePasses({ look: look.id }, 0, gradeLook).length, 1, look.id);
    assert.ok(isNeutralGrade(scaleGrade(look.fields, 0)), `${look.id} fades out at strength 0`);
  }
});

test("schema: accepts the full format, rejects bad values and paths", () => {
  const grade = {
    exposure: 1, temperature: -0.3, tint: 0.1, highlights: -0.2, shadows: 0.2, whites: 0, blacks: 0, vibrance: 0.1, pivot: 0.4, blackPoint: 0.02, whitePoint: 0.98, gamma: 1.1,
    wheels: { shadows: { x: -0.1, y: 0.1, level: 0 }, highlights: { x: 0.1 } },
    curves: { master: [[0, 0], [1, 1]], r: [[0, 0.1], [1, 0.9]] },
    hsl: { blue: { hue: 0.1, saturation: -0.2, luminance: 0 } },
    look: "noir", lookStrength: 0.5, lut: "assets/looks/film.cube", lutStrength: 0.8, skinProtect: 0.5,
    match: { gains: [1, 1.1, 0.9], contrast: 1, saturation: 1, anchor: "a" },
    grain: 0.1, grainSize: 1.5, halation: 0.1, bloom: 0.1, vignette: -0.1,
    keys: [{ frame: 0, exposure: 0 }, { frame: 10, exposure: 1, hold: true }],
  };
  const layers = (clipGrade) => ({
    version: 1, markers: [], tracks: [
      { id: "adj", name: "Adjustment", kind: "adjustment", clips: [{ id: "a1", from: 0, duration: 10, grade: clipGrade }] },
      { id: "v", name: "Video", kind: "video", clips: [{ id: "v1", from: 0, duration: 10, src: "assets/a.mp4", grade: clipGrade, inheritGrade: false }] },
      { id: "i", name: "Image", kind: "image", clips: [{ id: "i1", from: 0, duration: 10, src: "assets/a.png", grade: clipGrade, inheritGrade: true }] },
    ],
  });
  assert.ok(layersSchema.safeParse(layers(grade)).success, JSON.stringify(layersSchema.safeParse(layers(grade)).error?.issues));
  for (const bad of [{ exposure: 9 }, { lut: "../../secret.cube" }, { lut: "assets/../../x.cube" }, { lut: "assets/x.png" }, { lut: "/etc/x.cube" }, { grain: 2 }, { nope: 1 }, { curves: { master: [[0, 2], [1, 1]] } }, { hsl: { teal: { hue: 0 } } }, { keys: [{ exposure: 1 }] }])
    assert.equal(layersSchema.safeParse(layers(bad)).success, false, JSON.stringify(bad));
  const project = { version: 1, name: "x", fps: 30, durationInFrames: 10, background: "#000", variants: { a: { width: 100, height: 100 } }, defaultVariant: "a", fonts: [], grade };
  assert.ok(projectSchema.safeParse(project).success);
});

test("edits: a split keeps the grade's keys on the same picture", () => {
  const layers = { version: 1, markers: [], tracks: [{ id: "v", name: "V", kind: "video", clips: [{ id: "c", from: 100, duration: 100, src: "a.mp4", grade: { keys: [{ frame: 10, exposure: 0 }, { frame: 60, exposure: 2 }] } }] }] };
  const { layers: next, newId } = splitClip(layers, "c", 140);
  const second = next.tracks[0].clips.find((clip) => clip.id === newId);
  assert.deepEqual(second.grade.keys.map((key) => key.frame), [0, 20]);
  const first = next.tracks[0].clips.find((clip) => clip.id === "c");
  assert.deepEqual(first.grade.keys.map((key) => key.frame), [10, 60], "first piece unchanged");
});

test("edits: trimming a clip's start keeps its keys on the same picture", () => {
  const layers = { version: 1, markers: [], tracks: [{ id: "v", name: "V", kind: "video", clips: [{ id: "c", from: 100, duration: 100, src: "a.mp4", trimStart: 50, grade: { keys: [{ frame: 10, exposure: 0 }, { frame: 60, exposure: 2 }] } }] }] };
  const next = trimClip(layers, "c", "start", 120);
  assert.deepEqual(next.tracks[0].clips[0].grade.keys.map((key) => key.frame), [0, 40]);
  const end = trimClip(layers, "c", "end", 150);
  assert.deepEqual(end.tracks[0].clips[0].grade.keys.map((key) => key.frame), [10, 60], "trimming the end moves nothing");
});

test("live edits: reach the clip until they're cleared, and renders ignore them", () => {
  setLiveClip("clip-a", { grade: { exposure: 1 } });
  setLiveClip("clip-a", { opacity: 0.5 });
  assert.deepEqual(getLiveClip("clip-a"), { grade: { exposure: 1 }, opacity: 0.5 }, "edits merge");
  assert.equal(getLiveClip("clip-b"), undefined, "other clips are untouched");
  clearLiveClip("clip-a");
  assert.equal(getLiveClip("clip-a"), undefined);
  clearLiveClip("never-set");
  const clip = { id: "clip-c", opacity: 1 };
  setLiveClip("clip-c", { opacity: 0.2 });
  const Probe = ({ rendering }) => createElement("span", null, String(useLiveClip(clip, rendering).opacity));
  assert.match(renderToStaticMarkup(createElement(Probe, { rendering: true })), />1</, "a render draws what's saved");
  clearLiveClip("clip-c");
});

test("copying a grade: every clip gets the look and settings, and keeps its own matching", () => {
  const video = (id, grade, extra = {}) => ({ id, from: 0, duration: 10, src: `assets/${id}.mp4`, ...(grade ? { grade } : {}), ...extra });
  const look = { look: "silver-mono", exposure: 0.3, keys: [{ frame: 0, saturation: 0 }] };
  const layers = { version: 1, markers: [], tracks: [
    { id: "cut", name: "Cutouts", kind: "video", clips: [
      { id: "b-cutout-0", from: 0, duration: 10, src: "assets/cutouts/b.webm", grade: { temperature: 0.2 } },
      { id: "c-cutout-0", from: 0, duration: 10, src: "assets/cutouts/c.webm", grade: { vibrance: 0.5 } },
    ] },
    { id: "v", name: "V", kind: "video", clips: [
      video("a", { ...look, match: { gains: [2, 2, 2] } }),
      video("b", { temperature: 0.2, match: { gains: [1.5, 1, 1] } }),
      video("c"),
    ] },
    { id: "locked", name: "L", kind: "video", locked: true, clips: [video("l", { hue: 10 })] },
    { id: "hidden", name: "H", kind: "video", hidden: true, clips: [video("h")] },
  ] };
  assert.deepEqual(gradableClips(layers).map((clip) => clip.id), ["a", "b", "c"], "locked, hidden and cutouts are left out");
  assert.equal(gradesToReplace(layers, "a"), 1, "only b has a grade of its own to lose");
  const next = copyGrade(layers, "a", ["b", "c"]);
  const of = (id) => next.tracks.flatMap((t) => t.clips).find((clip) => clip.id === id).grade;
  assert.deepEqual(of("b"), { ...look, match: { gains: [1.5, 1, 1] } }, "b keeps its own matching");
  assert.deepEqual(of("c"), look);
  assert.deepEqual(of("a").match, { gains: [2, 2, 2] }, "the anchor is untouched");
  assert.deepEqual(of("b-cutout-0"), look, "a cutout graded like its footage follows it");
  assert.deepEqual(of("c-cutout-0"), { vibrance: 0.5 }, "a cutout graded apart keeps its own");
  assert.deepEqual(of("l"), { hue: 10 }, "locked tracks are never touched");
  assert.equal(gradesToReplace(next, "a"), 0, "nothing left to replace");
  assert.ok(layersSchema.safeParse(next).success);
});

test("analysis: colour conversions round trip", () => {
  for (const [r, g, b] of [[0.2, 0.5, 0.8], [1, 1, 1], [0, 0, 0], [0.9, 0.1, 0.1]]) {
    const back = oklabToLinear(...linearToOklab(r, g, b));
    [r, g, b].forEach((v, i) => assert.ok(Math.abs(v - back[i]) < 1e-4));
  }
  assert.ok(Math.abs(linearToSrgb(srgbToLinear(0.5)) - 0.5) < 1e-6);
});

test("analysis: reads exposure, clipping and crush", () => {
  const stats = analyzePixels(flat([[[255, 255, 255], 0.2], [[0, 0, 0], 0.3], [[128, 128, 128], 0.5]]));
  assert.ok(Math.abs(stats.clippedHighlights - 20) < 0.5);
  assert.ok(Math.abs(stats.crushedShadows - 30) < 0.5);
  assert.ok(Math.abs(stats.luma.p50 - 0.5) < 0.02);
  assert.ok(stats.luma.p02 < 0.01 && stats.luma.p98 > 0.99);
  const codes = colorIssues(stats).map((issue) => issue.code);
  assert.ok(codes.includes("clipped-highlights") && codes.includes("crushed-shadows"));
});

test("analysis: finds colour casts and stays quiet on neutral grey", () => {
  const warm = analyzePixels(flat([150, 128, 108]));
  assert.ok(warm.cast.b > 0.01, JSON.stringify(warm.cast));
  assert.ok(colorIssues(warm).some((issue) => issue.code === "color-cast" && /warm/.test(issue.message)));
  const cool = analyzePixels(flat([108, 128, 150]));
  assert.ok(cool.cast.b < -0.01);
  const neutral = analyzePixels(flat([128, 128, 128]));
  assert.ok(Math.hypot(neutral.cast.a, neutral.cast.b) < 0.002);
  assert.equal(colorIssues(neutral).some((issue) => issue.code === "color-cast"), false);
});

test("analysis: skin is measured against the skin line", () => {
  const skin = analyzePixels(flat([200, 144, 112]));
  assert.ok(skin.skin.coverage > 90, `coverage ${skin.skin.coverage}`);
  assert.ok(Math.abs(skin.skin.hueOffset) < 12, `offset ${skin.skin.hueOffset}`);
  const sick = analyzePixels(flat([170, 170, 90]));
  assert.ok(sick.skin.hueOffset === null || Math.abs(sick.skin.hueOffset) > 12);
  const none = analyzePixels(flat([30, 60, 200]));
  assert.equal(none.skin.hueOffset, null);
});

test("analysis: ignores transparent pixels and survives empty frames", () => {
  const data = flat([[[255, 0, 0], 0.5], [[0, 255, 0], 0.5]]);
  for (let i = 0; i < data.length / 2; i += 4) data[i + 3] = 0;
  const stats = analyzePixels(data);
  assert.ok(stats.pixels > 1900 && stats.pixels < 2100);
  const empty = analyzePixels(new Uint8ClampedArray(16));
  assert.equal(empty.pixels, 0);
  assert.ok(Number.isFinite(empty.luma.mean));
});

test("scopes: place pixels where they belong", () => {
  const data = flat([128, 128, 128], 100);
  const wave = waveform(data, 10, 10, 64, 64);
  const row = Math.round((1 - 128 / 255) * 63);
  const rowHas = (image, y) => { for (let x = 0; x < image.width; x += 1) if (image.data[(y * image.width + x) * 4 + 3]) return true; return false; };
  assert.ok(rowHas(wave, row), "grey is half way up");
  assert.equal(rowHas(wave, 5), false, "and nowhere else");
  const lanes = parade(flat([255, 0, 0], 100), 10, 10, 90, 64);
  const laneHas = (y, from, to, channel) => { for (let x = from; x < to; x += 1) if (lanes.data[(y * 90 + x) * 4 + channel] > 0) return true; return false; };
  assert.ok(laneHas(0, 0, 30, 0), "red channel at the top of its lane");
  assert.ok(laneHas(63, 30, 60, 1), "green channel at the bottom of its lane");
  const vector = vectorscopeImage(flat([128, 128, 128], 100), 10, 10, 65);
  assert.ok(vector.data[(32 * 65 + 32) * 4 + 3] === 255, "grey sits in the middle");
  const red = vectorscopeImage(flat([255, 0, 0], 100), 10, 10, 65);
  assert.equal(red.data[(32 * 65 + 32) * 4 + 3], 0, "colour moves off the middle");
  const histogram = histogramImage(flat([255, 255, 255], 100), 64, 32);
  assert.ok(histogram.data[(31 * 64 + 63) * 4] > 0);
});

test("matching: moves a dark, warm shot to the anchor, and leaves a matching shot alone", () => {
  const anchor = analyzePixels(flat([[[60, 60, 60], 0.2], [[128, 128, 128], 0.6], [[200, 200, 200], 0.2]]));
  const shot = analyzePixels(flat([[[40, 30, 25], 0.2], [[90, 76, 66], 0.6], [[140, 125, 115], 0.2]]));
  const match = computeShotMatch(shot, anchor);
  assert.ok(match.gains[1] > 1.5, "brightens");
  assert.ok(match.gains[2] > match.gains[0], "pulls out the warm cast");
  const same = computeShotMatch(anchor, anchor);
  same.gains.forEach((gain) => assert.ok(Math.abs(gain - 1) < 0.01));
  assert.equal(same.contrast, 1);
  assert.equal(same.saturation, 1);
  const half = computeShotMatch(shot, anchor, { strength: 0.5 });
  assert.ok(half.gains[1] < match.gains[1] && half.gains[1] > 1);
  const none = computeShotMatch(shot, anchor, { strength: 0 });
  none.gains.forEach((gain) => assert.ok(Math.abs(gain - 1) < 0.01));
});

test("matching: never over-corrects a shot that simply shows something else", () => {
  const grass = analyzePixels(flat([40, 170, 50]));
  const grey = analyzePixels(flat([128, 128, 128]));
  const match = computeShotMatch(grass, grey);
  const [r, g, b] = match.gains;
  assert.ok(Math.max(r, b) / g < 2.5, `gains ${match.gains}`);
  assert.ok(match.saturation >= 0.75 && match.contrast <= 1.25);
  const black = analyzePixels(flat([0, 0, 0]));
  computeShotMatch(black, grey).gains.forEach((gain) => assert.ok(Number.isFinite(gain) && gain <= 8, "stays in the format's limits"));
});

test("matching: every result fits the format, however extreme the shots", () => {
  const shots = [[0, 0, 0], [1, 1, 1], [3, 2, 1], [8, 8, 8], [12, 2, 2], [2, 2, 40], [128, 128, 128], [255, 255, 255], [250, 10, 10]].map((c) => analyzePixels(flat(c)));
  const stored = (m) => {
    m.gains.forEach((g) => assert.ok(Number.isFinite(g) && g > 0 && g <= 8, `gains ${m.gains}`));
    assert.ok(m.contrast >= 0.25 && m.contrast <= 4 && m.saturation >= 0 && m.saturation <= 3, JSON.stringify(m));
  };
  for (const shot of shots) {
    for (const anchor of shots) {
      const first = computeShotMatch(shot, anchor);
      stored(first);
      // The refining step multiplies, which is how real footage once went past the limit of 8.
      let combined = first;
      for (let i = 0; i < 4; i += 1) combined = combineMatches(combined, computeShotMatch(shot, anchor));
      stored(combined);
      const layers = { version: 1, markers: [], tracks: [{ id: "v", name: "V", kind: "video", clips: [{ id: "c", from: 0, duration: 1, src: "a.mp4", grade: { match: combined } }] }] };
      assert.ok(layersSchema.safeParse(layers).success, JSON.stringify(combined));
    }
  }
});

test("matching: black shots are left out", () => {
  assert.equal(canMatchShot(analyzePixels(flat([3, 3, 3]))), false);
  assert.equal(canMatchShot(analyzePixels(new Uint8ClampedArray(16))), false);
  assert.equal(canMatchShot(analyzePixels(flat([60, 60, 60]))), true);
});

test("matching: corrections combine", () => {
  const out = combineMatches({ gains: [1.1, 1, 1], contrast: 1.1, saturation: 1 }, { gains: [1, 1, 1.1], contrast: 1, saturation: 1.2, anchor: "a" });
  out.gains.forEach((gain, i) => assert.ok(Math.abs(gain - [1.1, 1, 1.1][i]) < 0.001, `${out.gains}`));
  assert.equal(out.saturation, 1.2);
  assert.equal(out.anchor, "a");
});

test("look transfer: moves the source to the target, measurably", () => {
  const source = lookProfile([flat([[[50, 50, 50], 0.3], [[128, 128, 128], 0.4], [[210, 210, 210], 0.3]])]);
  const target = lookProfile([flat([[[20, 50, 70], 0.3], [[120, 125, 120], 0.4], [[240, 215, 170], 0.3]])]);
  const transfer = lookTransfer(source, target);
  const shadow = transfer(50 / 255, 50 / 255, 50 / 255);
  const highlight = transfer(210 / 255, 210 / 255, 210 / 255);
  assert.ok(shadow[2] > shadow[0], `teal shadows, ${shadow}`);
  assert.ok(highlight[0] > highlight[2], `warm highlights, ${highlight}`);

  const moved = new Uint8ClampedArray(flat([[[50, 50, 50], 0.3], [[128, 128, 128], 0.4], [[210, 210, 210], 0.3]]));
  for (let i = 0; i < moved.length; i += 4) {
    const [r, g, b] = transfer(moved[i] / 255, moved[i + 1] / 255, moved[i + 2] / 255);
    moved.set([r * 255, g * 255, b * 255], i);
  }
  const before = lookDistance(source, target);
  const after = lookDistance(lookProfile([moved]), target);
  assert.ok(after.chroma < before.chroma * 0.5, `chroma ${before.chroma} → ${after.chroma}`);
  assert.ok(after.tone < before.tone, `tone ${before.tone} → ${after.tone}`);
});

test("look transfer: matching a look to itself barely changes anything, outputs stay valid", () => {
  const pixels = flat([[[30, 40, 60], 0.25], [[120, 110, 100], 0.25], [[200, 150, 120], 0.25], [[230, 230, 235], 0.25]]);
  const profile = lookProfile([pixels]);
  const transfer = lookTransfer(profile, profile);
  for (const color of [[120, 110, 100], [200, 150, 120]]) {
    const out = transfer(...color.map((v) => v / 255));
    out.forEach((v, i) => assert.ok(Math.abs(v * 255 - color[i]) < 30, `${color} → ${out.map((c) => Math.round(c * 255))}`));
  }
  const grey = lookProfile([flat([128, 128, 128])]);
  const wild = lookTransfer(grey, lookProfile([flat([250, 10, 200])]));
  for (const color of [[0, 0, 0], [1, 1, 1], [0.5, 0.5, 0.5], [1, 0, 0]])
    wild(...color).forEach((v) => assert.ok(v >= 0 && v <= 1 && Number.isFinite(v)));
  const tone = lookTransfer(grey, grey);
  let previous = -1;
  for (let i = 0; i <= 32; i += 1) {
    const [v] = tone(i / 32, i / 32, i / 32);
    assert.ok(v >= previous - 0.01, "brightness order is kept");
    previous = v;
  }
});

test("shot comparison flags a jump and not a match", () => {
  const a = analyzePixels(flat([128, 128, 128]));
  const dark = analyzePixels(flat([70, 70, 70]));
  assert.ok(shotsClash(shotDifference(dark, a)));
  assert.ok(shotDifference(dark, a).exposure < -1);
  assert.equal(shotsClash(shotDifference(a, a)), false);
});
