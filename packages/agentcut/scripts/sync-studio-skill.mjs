// Copies from the Agentcut repo root into this package:
//  - the Agentcut skill (skills/agentcut → template/skill)
//  - the motion component library (motion/components → template/components) plus a catalog
//    (catalog.json for the helper's checks, CATALOG.md for Claude to read).
// Both are written into every workspace when the studio starts.
// Usage: npm run sync:skill [-- <path to the repo root>]
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repo = resolve(process.argv[2] ?? join(root, "..", ".."));

const skillSource = join(repo, "skills", "agentcut");
const skillTarget = join(root, "template", "skill");
if (!existsSync(join(skillSource, "SKILL.md"))) {
  console.error(`No skill at ${skillSource}`);
  process.exit(1);
}
rmSync(skillTarget, { recursive: true, force: true });
cpSync(skillSource, skillTarget, { recursive: true });
console.log(`Synced ${skillSource} → ${skillTarget}`);

const componentsSource = join(repo, "motion", "components");
const componentsTarget = join(root, "template", "components");
if (existsSync(join(componentsSource, "index.ts"))) {
  rmSync(componentsTarget, { recursive: true, force: true });
  cpSync(componentsSource, componentsTarget, { recursive: true });
  const metas = readdirSync(componentsSource, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(componentsSource, entry.name, "meta.json")))
    .map((entry) => JSON.parse(readFileSync(join(componentsSource, entry.name, "meta.json"), "utf8")))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  writeFileSync(join(componentsTarget, "catalog.json"), `${JSON.stringify(metas, null, 2)}\n`);
  const lines = [
    "# Agentcut component library",
    "",
    "Generated from each component's meta.json. Use a component as a scene-track clip:",
    '`{ "component": "<id>", "props": { … } }` (props left out get their defaults).',
    "",
  ];
  for (const meta of metas) {
    lines.push(`## ${meta.name} (\`${meta.id}\`) · ${meta.category}`, "", meta.description, "", `Use when: ${meta.useWhen}`, "");
    lines.push(`Good length: ${meta.durationInFrames} frames at 30 fps · layer: ${meta.layer}`, "", "| prop | type | default | notes |", "|---|---|---|---|");
    for (const [key, spec] of Object.entries(meta.props)) {
      const extra = [
        spec.type === "number" ? `${spec.min}–${spec.max}${spec.unit ? ` ${spec.unit}` : ""}` : "",
        spec.type === "select" ? spec.options.map((o) => o.value).join(" / ") : "",
        spec.help ?? "",
      ]
        .filter(Boolean)
        .join(" · ");
      lines.push(`| ${key} | ${spec.type} | \`${JSON.stringify(spec.default)}\` | ${extra.replace(/\|/g, "\\|")} |`);
    }
    lines.push("", "Examples:", ...meta.examples.map((ex) => `- ${ex.name}: \`${JSON.stringify(ex.props)}\``), "");
  }
  writeFileSync(join(componentsTarget, "CATALOG.md"), `${lines.join("\n")}\n`);
  console.log(`Synced ${metas.length} components → ${componentsTarget}`);

  // Project styles (styles.json comes along with the folder): a readable guide for Claude.
  const stylesFile = join(componentsSource, "styles.json");
  if (existsSync(stylesFile)) {
    const styles = JSON.parse(readFileSync(stylesFile, "utf8"));
    const styled = metas
      .map((meta) => ({ meta, keys: Object.entries(meta.props).filter(([, spec]) => spec.style) }))
      .filter((entry) => entry.keys.length > 0);
    const out = [
      "# Project styles",
      "",
      'Generated from styles.json. A style is a whole editing preset; a project picks one in',
      'project.json: `"style": "<id>"`. Setting it already changes, with no other edit:',
      "- the look of the talking-head components (hook-card, word-pop, sticker-badge, list-card,",
      "  quote-card, before-after) and the fonts and colors of the props tagged below",
      "- captions clips: drawn in the style's look and position (unless the clip sets `style.preset`)",
      "- text clips: the style's font and colors",
      "- the camera on every video clip (punch-ins, drift, …; `\"camera\": \"none\"` on a clip turns it off)",
      "- a texture over the whole video (grain, scanlines, vignette)",
      "",
      "Leave the tagged props and caption/text fonts and colors out of clips so the video stays",
      "consistent and switches style in one edit. Set one only to break the style on purpose.",
      "",
      "## Applying a style (\"use the Voltrox style\", or the Restyle button)",
      "",
      "1. Read `references/style-editing.md`. Transcribe and review the source, then make the speech edit before graphics. Retiming must also update captions and audio.",
      "2. Set `style` in project.json. This changes visual defaults; it does not remove speech or create B-roll.",
      "3. Re-cut the graphics the style's way: follow its pacing and its \"Reach for\" list (component,",
      "   layout and position per job). Swap scene clips that do the same job for those components,",
      "   keep the words and timings, and drop color/font props they carried.",
      "4. Hooks frame the speaker the style's way (`hook-card` layout top, stack, collage, window, hud or",
      "   inset): split the speaker's video clip at the hook's end and give the first part the box (and",
      "   radius) listed for that layout in hook-card's useWhen, so the face shows through the hole.",
      "5. Captions: remove `style.preset`, colors and fonts from the captions clip so the style draws them.",
      "6. Capture frames across the video and fix overlaps (word pops vs. captions: keep one in the lower third).",
      "",
    ];
    for (const style of styles) {
      out.push(`## ${style.name} (\`${style.id}\`)`, "", style.description, "");
      out.push(...style.guide.map((line) => `- ${line}`), "");
      out.push(
        `Look: \`${style.look}\` · camera: ${style.camera.mode}${style.camera.mode === "still" ? "" : ` (zoom ${style.camera.zoom}, every ${style.camera.every} frames)`} · overlay: ${style.overlay.kind}` +
          ` · captions: ${style.captions.position}, ${style.captions.wordsPerLine} words per line.`,
        "",
        `Fallback captions (older pages): ${style.captions.fontFamily} ${style.captions.fontWeight}, ${style.captions.color}, highlight ${style.captions.highlight}, preset ${style.captions.preset}. ` +
          `Text clips: ${style.text.fontFamily} ${style.text.fontWeight}, ${style.text.color}.`,
        "",
        `Tokens: ${Object.entries(style.tokens).map(([key, value]) => `${key} \`${value}\``).join(" · ")}`,
        "",
        "Reach for:",
        ...style.shots.map((shot) => `- ${shot.job}: \`${shot.component}\`${shot.props ? ` ${JSON.stringify(shot.props)}` : ""}`),
        "",
      );
    }
    out.push("## Props that follow the style", "", "| component | props (token) |", "|---|---|");
    for (const { meta, keys } of styled)
      out.push(`| \`${meta.id}\` | ${keys.map(([key, spec]) => `${key} (${spec.style})`).join(", ")} |`);
    out.push("", "Components not listed keep their own look under every style.", "");
    writeFileSync(join(componentsTarget, "STYLES.md"), `${out.join("\n")}\n`);
    console.log(`Synced ${styles.length} styles → ${join(componentsTarget, "STYLES.md")}`);
  }
} else {
  console.log(`No component library at ${componentsSource} (skipped)`);
}

// Video style presets (motion/presets → template/presets): each workspace gets a copy in library/presets/
// the first time (never overwritten, so users can edit them).
const presetsSource = join(repo, "motion", "presets");
const presetsTarget = join(root, "template", "presets");
if (existsSync(presetsSource)) {
  rmSync(presetsTarget, { recursive: true, force: true });
  cpSync(presetsSource, presetsTarget, { recursive: true });
  const ids = readdirSync(presetsSource, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  console.log(`Synced ${ids.length} video style presets → ${presetsTarget}`);
}
