import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  APPLE_MARK_SVG,
  createRoundedExtrudedGeometry,
  createRoundedPlaneGeometry,
} from "./iphone-model";
const DEFAULT_LAPTOP_LID_ANGLE = 110;

/**
 * Procedural 13-inch laptop in the spirit of a MacBook Air. Built from real
 * millimetre proportions, then scaled so the deck is 2 scene units wide.
 *
 * Axes: +x right, +y up, +z toward the viewer. The deck's top surface sits at
 * y = 0 and the lid hinges along its back edge.
 */

const MM = 2 / 312.6;
const mm = (value: number) => value * MM;

const BASE = { w: 312.6, d: 221.2, t: 10.4, corner: 10.5 };
const LID = {
  h: 221.2,
  t: 4.8,
  corner: 10.5,
  glassInset: 1.1,
  bezelSide: 5.6,
  bezelTop: 5.6,
  bezelBottom: 7.6,
  notch: { w: 31, h: 6.4 },
};
const KEYBOARD = { pitch: 18.55, gap: 2.35, back: 13, corner: 1.6 };
const TRACKPAD = { w: 140, h: 82, gap: 10, corner: 7.5 };

export const MACBOOK_SCREEN_ASPECT =
  (BASE.w - LID.bezelSide * 2) / (LID.h - LID.bezelTop - LID.bezelBottom);


type KeySpec = [label: string, width: number, kind?: "mod" | "half"];

const U = 1;
const KEY_ROWS: KeySpec[][] = [
  [
    ["esc", 1.5, "mod"],
    ...Array.from(
      { length: 12 },
      (_, index): KeySpec => [`F${index + 1}`, U, "mod"],
    ),
    ["", U],
  ],
  [
    ...["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="].map(
      (label): KeySpec => [label, U],
    ),
    ["delete", 1.5, "mod"],
  ],
  [
    ["tab", 1.5, "mod"],
    ...[..."QWERTYUIOP", "[", "]", "\\"].map((label): KeySpec => [label, U]),
  ],
  [
    ["caps lock", 1.8, "mod"],
    ...[..."ASDFGHJKL", ";", "'"].map((label): KeySpec => [label, U]),
    ["return", 1.7, "mod"],
  ],
  [
    ["shift", 2.35, "mod"],
    ...[..."ZXCVBNM", ",", ".", "/"].map((label): KeySpec => [label, U]),
    ["shift", 2.15, "mod"],
  ],
  [
    ["fn", U, "mod"],
    ["control", U, "mod"],
    ["option", U, "mod"],
    ["command", 1.25, "mod"],
    ["", 5],
    ["command", 1.25, "mod"],
    ["option", U, "mod"],
    ["◀", U, "half"],
    ["▲▼", U, "half"],
    ["▶", U, "half"],
  ],
];

interface KeyRect {
  label: string;
  kind?: "mod" | "half";
  x: number;
  z: number;
  w: number;
  d: number;
}

function layoutKeys() {
  const { pitch, gap, back } = KEYBOARD;
  const rowWidth = 14.5 * pitch - gap;
  const keys: KeyRect[] = [];
  let z = -BASE.d / 2 + back;
  KEY_ROWS.forEach((row, rowIndex) => {
    const rowDepth = rowIndex === 0 ? pitch * 0.55 : pitch;
    let x = -rowWidth / 2;
    for (const [label, width, kind] of row) {
      const keyWidth = width * pitch - gap;
      const keyDepth = rowDepth - gap;
      if (kind === "half") {
        if (label === "▲▼") {
          const half = (keyDepth - gap * 0.5) / 2;
          keys.push({ label: "▲", kind, x, z, w: keyWidth, d: half });
          keys.push({
            label: "▼",
            kind,
            x,
            z: z + half + gap * 0.5,
            w: keyWidth,
            d: half,
          });
        } else {
          const half = (keyDepth - gap * 0.5) / 2;
          keys.push({
            label,
            kind,
            x,
            z: z + half + gap * 0.5,
            w: keyWidth,
            d: half,
          });
        }
      } else {
        keys.push({ label, kind, x, z, w: keyWidth, d: keyDepth });
      }
      x += width * pitch;
    }
    z += rowDepth;
  });
  return { keys, rowWidth, depth: z - (-BASE.d / 2 + back) };
}

function createCanvas(width: number, height: number) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
}

/** Key legends painted once into a texture laid over the keycaps. */
function createLegendTexture(
  keys: KeyRect[],
  bounds: { x: number; z: number; w: number; d: number },
) {
  // Dense enough that the legends stay crisp in close-ups.
  const pxPerMm = 14;
  const width = Math.ceil(bounds.w * pxPerMm);
  const height = Math.ceil(bounds.d * pxPerMm);
  const canvas = createCanvas(width, height);
  const context = canvas?.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
    | undefined;
  if (!canvas || !context) return null;
  context.clearRect(0, 0, width, height);
  // Bright, slightly bold legends: backlit-key white that reads against the black caps.
  context.fillStyle = "#ffffff";
  context.textBaseline = "middle";
  for (const key of keys) {
    if (!key.label) continue;
    const left = (key.x - bounds.x) * pxPerMm;
    const top = (key.z - bounds.z) * pxPerMm;
    const keyWidth = key.w * pxPerMm;
    const keyDepth = key.d * pxPerMm;
    if (key.kind === "mod") {
      context.font = `600 ${Math.round(2.5 * pxPerMm)}px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
      context.textAlign = "left";
      context.fillText(
        key.label,
        left + 1.6 * pxPerMm,
        top + keyDepth - 2.4 * pxPerMm,
        keyWidth - 3 * pxPerMm,
      );
    } else {
      const fontSize = key.kind === "half" ? 2.6 : 3.9;
      context.font = `600 ${Math.round(fontSize * pxPerMm)}px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
      context.textAlign = "center";
      context.fillText(
        key.label,
        left + keyWidth / 2,
        top + keyDepth / 2,
        keyWidth - 2 * pxPerMm,
      );
    }
  }
  const texture = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Speaker grille: a fine field of dark perforations on a transparent texture. */
function createGrilleTexture(widthMm: number, depthMm: number) {
  const pxPerMm = 12;
  const width = Math.ceil(widthMm * pxPerMm);
  const height = Math.ceil(depthMm * pxPerMm);
  const canvas = createCanvas(width, height);
  const context = canvas?.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined;
  if (!canvas || !context) return null;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(6, 6, 8, 0.85)";
  const pitch = 1.15 * pxPerMm;
  for (let y = pitch / 2, row = 0; y < height; y += pitch * 0.87, row++) {
    for (let x = pitch / 2 + (row % 2) * (pitch / 2); x < width; x += pitch) {
      context.beginPath();
      context.arc(x, y, 0.32 * pxPerMm, 0, Math.PI * 2);
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createFlatRoundedRect(width: number, depth: number, radius: number) {
  const geometry = createRoundedPlaneGeometry(width, depth, radius);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createLogoGeometry(width: number) {
  const svg = new SVGLoader().parse(APPLE_MARK_SVG);
  const shapes = svg.paths.flatMap((path) => SVGLoader.createShapes(path));
  const geometry = new THREE.ShapeGeometry(shapes, 32);
  geometry.center();
  const scale = width / 814;
  geometry.scale(scale, -scale, 1);
  return geometry;
}

function createMaterials(finishColor: THREE.ColorRepresentation) {
  const finish = new THREE.Color(finishColor);
  const { l: lightness } = finish.getHSL({ h: 0, s: 0, l: 0 });
  // Space black and darker finishes count as dark.
  const isDark = lightness < 0.4;
  return {
    // Bead-blasted anodised aluminium: soft, wide highlights, the finish's own colour in the shadows.
    // Dark finishes (space black) reflect much less of the studio, like real dark anodising: otherwise a
    // low camera facing the deck sees the bright environment and the black washes out to light grey.
    aluminum: new THREE.MeshPhysicalMaterial({
      color: finish,
      metalness: isDark ? 0.55 : 0.85,
      roughness: isDark ? 0.48 : 0.34,
      clearcoat: isDark ? 0.04 : 0.18,
      clearcoatRoughness: 0.4,
      envMapIntensity: isDark ? 0.3 : 0.75,
    }),
    edge: new THREE.MeshPhysicalMaterial({
      color: finish.clone().lerp(new THREE.Color(0xffffff), isDark ? 0.08 : 0.2),
      metalness: isDark ? 0.85 : 1,
      roughness: isDark ? 0.3 : 0.22,
      envMapIntensity: isDark ? 0.55 : 1,
    }),
    trackpad: new THREE.MeshPhysicalMaterial({
      color: finish.clone().lerp(new THREE.Color(0x000000), isDark ? 0.12 : 0.06),
      metalness: isDark ? 0.4 : 0.5,
      roughness: isDark ? 0.36 : 0.28,
      clearcoat: isDark ? 0.25 : 0.6,
      clearcoatRoughness: 0.18,
      envMapIntensity: isDark ? 0.28 : 0.6,
    }),
    well: new THREE.MeshStandardMaterial({
      color: 0x050506,
      roughness: 0.85,
      metalness: 0,
      envMapIntensity: 0.06,
    }),
    key: new THREE.MeshPhysicalMaterial({
      color: 0x0a0a0c,
      roughness: 0.7,
      metalness: 0.05,
      clearcoat: 0.05,
      envMapIntensity: 0.16,
    }),
    grille: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    legends: new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
    glass: new THREE.MeshBasicMaterial({ color: 0x030405 }),
    notch: new THREE.MeshBasicMaterial({ color: 0x030304 }),
    lens: new THREE.MeshPhysicalMaterial({
      color: 0x10162a,
      roughness: 0.05,
      metalness: 0.3,
      clearcoat: 1,
    }),
    hinge: new THREE.MeshPhysicalMaterial({
      color: finish.clone().lerp(new THREE.Color(0x000000), 0.45),
      metalness: 0.8,
      roughness: 0.35,
    }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.9, envMapIntensity: 0.2 }),
    logo: new THREE.MeshPhysicalMaterial({
      color: finish
        .clone()
        .lerp(new THREE.Color(isDark ? 0xffffff : 0x000000), isDark ? 0.2 : 0.45),
      metalness: 1,
      roughness: 0.05,
      side: THREE.DoubleSide,
    }),
    screenOff: new THREE.MeshBasicMaterial({ color: 0x050608 }),
  };
}

export interface MacbookModelOptions {
  screenMaterial?: THREE.Material;
  finishColor?: THREE.ColorRepresentation;
  lidAngle?: number;
}

export function createMacbookModel(options: MacbookModelOptions = {}) {
  const root = new THREE.Group();
  root.name = "procedural-macbook";
  const materials = createMaterials(options.finishColor ?? 0xcfd1d3);
  const add = (
    name: string,
    mesh: THREE.Mesh,
    parent: THREE.Object3D = root,
  ) => {
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // ── Deck ─────────────────────────────────────────────────────────────
  const baseGeometry = createRoundedExtrudedGeometry(
    mm(BASE.w),
    mm(BASE.d),
    mm(BASE.corner),
    mm(BASE.t - 1.2),
    mm(0.6),
    mm(0.6),
  );
  baseGeometry.rotateX(-Math.PI / 2);
  const base = add("laptop-base", new THREE.Mesh(baseGeometry, materials.aluminum));
  base.position.y = -mm(BASE.t) / 2;

  // Chamfered rim catching a bright highlight around the deck.
  const rim = add(
    "laptop-deck-rim",
    new THREE.Mesh(
      createFlatRoundedRect(mm(BASE.w - 0.8), mm(BASE.d - 0.8), mm(BASE.corner)),
      materials.edge,
    ),
  );
  rim.position.y = mm(0.12);
  const deckTop = add(
    "laptop-deck-top",
    new THREE.Mesh(
      createFlatRoundedRect(mm(BASE.w - 2.2), mm(BASE.d - 2.2), mm(BASE.corner - 1)),
      materials.aluminum,
    ),
  );
  deckTop.position.y = mm(0.24);

  // ── Keyboard ─────────────────────────────────────────────────────────
  const { keys, rowWidth, depth } = layoutKeys();
  const keyboardBounds = {
    x: -rowWidth / 2 - 1.2,
    z: -BASE.d / 2 + KEYBOARD.back - 1.2,
    w: rowWidth + 2.4,
    d: depth - KEYBOARD.gap + 2.4,
  };
  const well = add(
    "laptop-keyboard-well",
    new THREE.Mesh(
      createFlatRoundedRect(
        mm(keyboardBounds.w),
        mm(keyboardBounds.d),
        mm(2.4),
      ),
      materials.well,
    ),
  );
  well.position.set(
    mm(keyboardBounds.x + keyboardBounds.w / 2),
    mm(0.4),
    mm(keyboardBounds.z + keyboardBounds.d / 2),
  );

  const keyHeight = 0.9;
  const keyGeometries = keys.map((key) => {
    const geometry = new RoundedBoxGeometry(
      mm(key.w),
      mm(keyHeight),
      mm(key.d),
      2,
      mm(Math.min(KEYBOARD.corner, key.d / 2.2, key.w / 2.2)),
    );
    geometry.translate(
      mm(key.x + key.w / 2),
      mm(keyHeight / 2 + 0.45),
      mm(key.z + key.d / 2),
    );
    return geometry;
  });
  const keysGeometry = mergeGeometries(keyGeometries, false);
  keyGeometries.forEach((geometry) => geometry.dispose());
  if (keysGeometry) add("laptop-keys", new THREE.Mesh(keysGeometry, materials.key));

  const legendTexture = createLegendTexture(keys, keyboardBounds);
  if (legendTexture) {
    materials.legends.map = legendTexture;
    const legends = add(
      "laptop-key-legends",
      new THREE.Mesh(
        new THREE.PlaneGeometry(mm(keyboardBounds.w), mm(keyboardBounds.d)).rotateX(
          -Math.PI / 2,
        ),
        materials.legends,
      ),
    );
    legends.castShadow = false;
    legends.position.set(
      mm(keyboardBounds.x + keyboardBounds.w / 2),
      mm(keyHeight + 0.6),
      mm(keyboardBounds.z + keyboardBounds.d / 2),
    );
    legends.renderOrder = 2;
  }

  // ── Speaker grilles either side of the keyboard ─────────────────────
  const sideRoom = (BASE.w - keyboardBounds.w) / 2;
  const grilleW = Math.min(12, sideRoom - 6);
  const grilleTexture = grilleW > 3 ? createGrilleTexture(grilleW, keyboardBounds.d) : null;
  if (grilleTexture) {
    materials.grille.map = grilleTexture;
    for (const side of [-1, 1]) {
      const grille = add(
        "laptop-speaker-grille",
        new THREE.Mesh(new THREE.PlaneGeometry(mm(grilleW), mm(keyboardBounds.d)).rotateX(-Math.PI / 2), materials.grille),
      );
      grille.castShadow = false;
      grille.position.set(
        side * mm(keyboardBounds.w / 2 + sideRoom / 2),
        mm(0.3),
        mm(keyboardBounds.z + keyboardBounds.d / 2),
      );
      grille.renderOrder = 2;
    }
  }

  // ── Trackpad and front lip ──────────────────────────────────────────
  const trackpadCenterZ =
    keyboardBounds.z + keyboardBounds.d + TRACKPAD.gap + TRACKPAD.h / 2;
  const trackpad = add(
    "laptop-trackpad",
    new THREE.Mesh(
      createFlatRoundedRect(mm(TRACKPAD.w), mm(TRACKPAD.h), mm(TRACKPAD.corner)),
      materials.trackpad,
    ),
  );
  trackpad.position.set(0, mm(0.4), mm(trackpadCenterZ));

  const notchGeometry = new THREE.CylinderGeometry(
    mm(14),
    mm(14),
    mm(1.4),
    48,
    1,
    false,
    Math.PI / 2,
    Math.PI,
  );
  notchGeometry.scale(1, 1, 0.22);
  const thumbNotch = add(
    "laptop-thumb-notch",
    new THREE.Mesh(notchGeometry, materials.hinge),
  );
  thumbNotch.position.set(0, -mm(0.6), mm(BASE.d / 2 + 0.25));

  // ── Feet ─────────────────────────────────────────────────────────────
  const footGeometry = new THREE.CylinderGeometry(mm(6), mm(6.5), mm(1.3), 32);
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const foot = add("laptop-foot", new THREE.Mesh(footGeometry, materials.rubber));
      foot.position.set(
        x * mm(BASE.w / 2 - 24),
        -mm(BASE.t) - mm(0.5),
        z * mm(BASE.d / 2 - 24),
      );
    }
  }

  // ── Hinge and lid ───────────────────────────────────────────────────
  const hingeZ = -mm(BASE.d / 2) + mm(3.2);
  const hingeY = mm(1.2);
  const hinge = add(
    "laptop-hinge",
    new THREE.Mesh(
      new THREE.CylinderGeometry(mm(3.4), mm(3.4), mm(BASE.w - 72), 32).rotateZ(
        Math.PI / 2,
      ),
      materials.hinge,
    ),
  );
  hinge.position.set(0, -mm(1.8), hingeZ - mm(1.4));

  const lid = new THREE.Group();
  lid.name = "laptop-lid-pivot";
  lid.position.set(0, hingeY, hingeZ);
  root.add(lid);

  const lidBevel = mm(0.5);
  const lidGeometry = createRoundedExtrudedGeometry(
    mm(BASE.w),
    mm(LID.h),
    mm(LID.corner),
    mm(LID.t) - lidBevel * 2,
    lidBevel,
    lidBevel,
  );
  const lidShell = add(
    "laptop-lid",
    new THREE.Mesh(lidGeometry, materials.aluminum),
    lid,
  );
  lidShell.position.set(0, mm(LID.h / 2), -mm(LID.t / 2));

  const glass = add(
    "laptop-display-glass",
    new THREE.Mesh(
      createRoundedPlaneGeometry(
        mm(BASE.w - LID.glassInset * 2),
        mm(LID.h - LID.glassInset * 2),
        mm(LID.corner - LID.glassInset),
      ),
      materials.glass,
    ),
    lid,
  );
  glass.position.set(0, mm(LID.h / 2), mm(0.25));

  const screenWidth = BASE.w - LID.bezelSide * 2;
  const screenHeight = LID.h - LID.bezelTop - LID.bezelBottom;
  const screen = add(
    "display-surface",
    new THREE.Mesh(
      createRoundedPlaneGeometry(mm(screenWidth), mm(screenHeight), mm(4.2)),
      options.screenMaterial ?? materials.screenOff,
    ),
    lid,
  );
  screen.position.set(0, mm(LID.bezelBottom + screenHeight / 2), mm(0.5));
  screen.castShadow = false;

  const notch = add(
    "laptop-camera-notch",
    new THREE.Mesh(
      createRoundedPlaneGeometry(mm(LID.notch.w), mm(LID.notch.h + 4), mm(2.6)),
      materials.notch,
    ),
    lid,
  );
  notch.position.set(
    0,
    mm(LID.bezelBottom + screenHeight - LID.notch.h / 2 + 2),
    mm(0.75),
  );
  const lens = add(
    "laptop-camera-lens",
    new THREE.Mesh(new THREE.CircleGeometry(mm(1.1), 24), materials.lens),
    lid,
  );
  lens.position.set(0, mm(LID.bezelBottom + screenHeight + 2), mm(0.85));

  const logo = add(
    "laptop-lid-logo",
    new THREE.Mesh(createLogoGeometry(mm(26)), materials.logo),
    lid,
  );
  logo.rotation.y = Math.PI;
  logo.position.set(0, mm(LID.h * 0.53), -mm(LID.t) - mm(0.3));

  setMacbookLidAngle(root, options.lidAngle ?? DEFAULT_LAPTOP_LID_ANGLE);
  return root;
}

/** Works on clones too, since it looks the hinge up by name. */
export function setMacbookLidAngle(root: THREE.Object3D, degrees: number) {
  const lid = root.getObjectByName("laptop-lid-pivot");
  if (!lid) return;
  const clamped = THREE.MathUtils.clamp(degrees, 0, 140);
  lid.rotation.x = THREE.MathUtils.degToRad(90 - clamped);
}

export function isMacbookModel(root: THREE.Object3D) {
  return Boolean(root.getObjectByName("laptop-lid-pivot"));
}
