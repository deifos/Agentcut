import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import {
  APPLE_MARK_SVG,
  createRoundedExtrudedGeometry,
  createRoundedPlaneGeometry,
} from "./iphone-model";

/**
 * Procedural 27-inch desktop display on an aluminium stand, in the spirit of
 * a Studio Display. Same millimetre scale as the laptop so the two read as
 * the same family. The foot rests on y = 0; the screen faces +z.
 */
const MM = 2 / 312.6;
const mm = (value: number) => value * MM;

const BODY = { w: 623, h: 361.4, t: 21, corner: 13, bezel: 12.6, glassInset: 1.1 };
const STAND = {
  width: 152,
  thickness: 9.5,
  lift: 100,
  attach: 40,
  lean: 15,
  foot: 150,
  corner: 3.2,
};

export const DISPLAY_SCREEN_ASPECT =
  (BODY.w - BODY.bezel * 2) / (BODY.h - BODY.bezel * 2);

function createLogoGeometry(width: number) {
  const svg = new SVGLoader().parse(APPLE_MARK_SVG);
  const shapes = svg.paths.flatMap((path) => SVGLoader.createShapes(path));
  const geometry = new THREE.ShapeGeometry(shapes, 32);
  geometry.center();
  const scale = width / 814;
  geometry.scale(scale, -scale, 1);
  return geometry;
}

export interface DisplayModelOptions {
  screenMaterial?: THREE.Material;
  finishColor?: THREE.ColorRepresentation;
}

export function createDisplayModel(options: DisplayModelOptions = {}) {
  const root = new THREE.Group();
  root.name = "procedural-display";
  const finish = new THREE.Color(options.finishColor ?? 0xcfd1d3);
  const isDark = finish.getHSL({ h: 0, s: 0, l: 0 }).l < 0.35;
  const aluminum = new THREE.MeshPhysicalMaterial({
    color: finish,
    metalness: 0.92,
    roughness: 0.38,
    clearcoat: 0.1,
    clearcoatRoughness: 0.5,
  });
  const glass = new THREE.MeshBasicMaterial({ color: 0x030405 });
  const lens = new THREE.MeshPhysicalMaterial({
    color: 0x10162a,
    roughness: 0.05,
    metalness: 0.3,
    clearcoat: 1,
  });
  const logoMaterial = new THREE.MeshPhysicalMaterial({
    color: finish
      .clone()
      .lerp(new THREE.Color(isDark ? 0xffffff : 0x000000), isDark ? 0.2 : 0.45),
    metalness: 1,
    roughness: 0.05,
    side: THREE.DoubleSide,
  });
  const screenOff = new THREE.MeshBasicMaterial({ color: 0x050608 });

  const add = (name: string, mesh: THREE.Mesh, parent: THREE.Object3D = root) => {
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // ── Stand: a leaning neck that folds into a flat foot ──────────────
  const lean = THREE.MathUtils.degToRad(STAND.lean);
  const centerY = STAND.lift + BODY.h / 2;
  const attachY = centerY - STAND.attach;
  const neckLength = attachY / Math.cos(lean);
  const attachZ = -BODY.t + 2;
  const bottomZ = attachZ - attachY * Math.tan(lean);

  const neck = add(
    "display-neck",
    new THREE.Mesh(
      new RoundedBoxGeometry(
        mm(STAND.width),
        mm(neckLength),
        mm(STAND.thickness),
        3,
        mm(STAND.corner),
      ),
      aluminum,
    ),
  );
  neck.position.set(0, mm(attachY / 2), mm((attachZ + bottomZ) / 2 - STAND.thickness / 2));
  neck.rotation.x = lean;

  const foot = add(
    "display-foot",
    new THREE.Mesh(
      new RoundedBoxGeometry(
        mm(STAND.width),
        mm(STAND.thickness * 0.8),
        mm(STAND.foot),
        3,
        mm(STAND.corner),
      ),
      aluminum,
    ),
  );
  foot.position.set(
    0,
    mm((STAND.thickness * 0.8) / 2),
    mm(bottomZ - STAND.thickness + STAND.foot / 2 - 18),
  );

  // ── Body ───────────────────────────────────────────────────────────
  const bevel = mm(0.8);
  const body = add(
    "display-body",
    new THREE.Mesh(
      createRoundedExtrudedGeometry(
        mm(BODY.w),
        mm(BODY.h),
        mm(BODY.corner),
        mm(BODY.t) - bevel * 2,
        bevel,
        bevel,
      ),
      aluminum,
    ),
  );
  body.position.set(0, mm(centerY), -mm(BODY.t / 2));

  const front = add(
    "display-glass",
    new THREE.Mesh(
      createRoundedPlaneGeometry(
        mm(BODY.w - BODY.glassInset * 2),
        mm(BODY.h - BODY.glassInset * 2),
        mm(BODY.corner - BODY.glassInset),
      ),
      glass,
    ),
  );
  front.position.set(0, mm(centerY), mm(0.3));

  const screenWidth = BODY.w - BODY.bezel * 2;
  const screenHeight = BODY.h - BODY.bezel * 2;
  const screen = add(
    "display-surface",
    new THREE.Mesh(
      createRoundedPlaneGeometry(mm(screenWidth), mm(screenHeight), mm(3.2)),
      options.screenMaterial ?? screenOff,
    ),
  );
  screen.position.set(0, mm(centerY), mm(0.6));
  screen.castShadow = false;

  const camera = add(
    "display-camera",
    new THREE.Mesh(new THREE.CircleGeometry(mm(1.6), 24), lens),
  );
  camera.position.set(0, mm(centerY + BODY.h / 2 - BODY.bezel / 2), mm(0.7));

  const logo = add(
    "display-logo",
    new THREE.Mesh(createLogoGeometry(mm(34)), logoMaterial),
  );
  logo.rotation.y = Math.PI;
  logo.position.set(0, mm(centerY + 30), -mm(BODY.t) - mm(0.4));

  return root;
}
