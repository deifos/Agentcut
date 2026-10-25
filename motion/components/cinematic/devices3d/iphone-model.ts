import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

export interface IphoneVideoMockupOptions {
  screenMaterial?: THREE.Material;
  finishColor?: THREE.ColorRepresentation;
}

export interface IphoneVideoMockupRuntime {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
}

type IphoneVideoMockupGroup = THREE.Group & {
  userData: THREE.Group["userData"] & {
    sculptRuntime: IphoneVideoMockupRuntime;
  };
};

const PHONE_WIDTH = 0.695;
const PHONE_HEIGHT = 1.455;
// 149.6 × 71.5 × 7.95 mm, normalized to the model's 1.455-unit height.
const PHONE_DEPTH = 0.065;
const BODY_BEVEL_SIZE = 0.005;
const BODY_BEVEL_THICKNESS = 0.006;
const FRONT_Z = PHONE_DEPTH / 2 + BODY_BEVEL_THICKNESS + 0.003;
const BACK_Z = -PHONE_DEPTH / 2 - BODY_BEVEL_THICKNESS - 0.003;
const SIDE_RAIL_X = PHONE_WIDTH / 2 + BODY_BEVEL_SIZE;
const SIDE_BUTTON_X = SIDE_RAIL_X + 0.0035;

export function roundedRectPath(
  target: THREE.Shape | THREE.Path,
  width: number,
  height: number,
  radius: number,
) {
  const x = -width / 2;
  const y = -height / 2;
  const clampedRadius = Math.min(radius, width / 2, height / 2);

  target.moveTo(x + clampedRadius, y);
  target.lineTo(x + width - clampedRadius, y);
  target.quadraticCurveTo(x + width, y, x + width, y + clampedRadius);
  target.lineTo(x + width, y + height - clampedRadius);
  target.quadraticCurveTo(
    x + width,
    y + height,
    x + width - clampedRadius,
    y + height,
  );
  target.lineTo(x + clampedRadius, y + height);
  target.quadraticCurveTo(x, y + height, x, y + height - clampedRadius);
  target.lineTo(x, y + clampedRadius);
  target.quadraticCurveTo(x, y, x + clampedRadius, y);
  target.closePath();
}

export function createRoundedPlaneGeometry(
  width: number,
  height: number,
  radius: number,
) {
  const shape = new THREE.Shape();
  roundedRectPath(shape, width, height, radius);
  const geometry = new THREE.ShapeGeometry(shape, 48);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  if (bounds && position && uv) {
    const spanX = Math.max(0.0001, bounds.max.x - bounds.min.x);
    const spanY = Math.max(0.0001, bounds.max.y - bounds.min.y);
    for (let index = 0; index < position.count; index += 1) {
      uv.setXY(
        index,
        (position.getX(index) - bounds.min.x) / spanX,
        (position.getY(index) - bounds.min.y) / spanY,
      );
    }
    uv.needsUpdate = true;
  }
  return geometry;
}

export function createRoundedExtrudedGeometry(
  width: number,
  height: number,
  radius: number,
  depth: number,
  bevelSize = 0.005,
  bevelThickness = 0.005,
) {
  const shape = new THREE.Shape();
  roundedRectPath(shape, width, height, radius);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 48,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize,
    bevelThickness,
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

function createSideButtonGeometry(height: number) {
  const geometry = createRoundedExtrudedGeometry(
    0.03,
    height,
    0.015,
    0.007,
    0.0015,
    0.0015,
  );
  geometry.rotateY(Math.PI / 2);
  return geometry;
}

export function createRoundedRingGeometry(
  outerWidth: number,
  outerHeight: number,
  outerRadius: number,
  innerWidth: number,
  innerHeight: number,
  innerRadius: number,
) {
  const shape = new THREE.Shape();
  roundedRectPath(shape, outerWidth, outerHeight, outerRadius);
  const hole = new THREE.Path();
  roundedRectPath(hole, innerWidth, innerHeight, innerRadius);
  shape.holes.push(hole);
  return new THREE.ShapeGeometry(shape, 56);
}

export const APPLE_MARK_SVG = `<svg viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/></svg>`;

function createRearMarkGeometry() {
  const svg = new SVGLoader().parse(APPLE_MARK_SVG);
  const shapes = svg.paths.flatMap((path) => SVGLoader.createShapes(path));
  const geometry = new THREE.ShapeGeometry(shapes, 48);
  geometry.center();
  // SVG coordinates grow downward; invert Y so the leaf sits above the mark.
  geometry.scale(0.00019, -0.00019, 1);
  return geometry;
}

function createFinishPalette(finishColor: THREE.ColorRepresentation) {
  const base = new THREE.Color(finishColor);
  const black = new THREE.Color(0x000000);
  const { l: lightness, s: saturation } = base.getHSL({ h: 0, s: 0, l: 0 });
  const isDark = lightness < 0.48;
  const logoColorByFinish: Partial<Record<number, number>> = {
    0xc5a4df: 0xddcbe7,
    0x829dce: 0xa9b9d9,
    0xd9dad6: 0xc9cac6,
    0x6a6a6a: 0x555657,
  };
  const calibratedLogoColor = logoColorByFinish[base.getHex()];

  return {
    frame: base.clone().lerp(black, isDark ? 0.08 : 0.12),
    rearGlass: isDark
      ? base.clone().lerp(black, 0.58)
      : base.clone().offsetHSL(0, 0.12, -0.025),
    camera: base.clone().lerp(black, isDark ? 0.68 : 0.22),
    seam: base.clone().lerp(black, isDark ? 0.62 : 0.38),
    logo:
      calibratedLogoColor !== undefined
        ? new THREE.Color(calibratedLogoColor)
        : isDark
          ? base.clone().lerp(black, 0.35)
          : saturation < 0.08
            ? base.clone().lerp(black, 0.12)
            : base.clone().offsetHSL(0, -0.04, -0.04),
  };
}

function createPhysicalMaterials(finishColor: THREE.ColorRepresentation) {
  const finish = createFinishPalette(finishColor);

  return {
    frame: new THREE.MeshPhysicalMaterial({
      color: finish.frame,
      roughness: 0.27,
      metalness: 0.86,
      clearcoat: 0.18,
      clearcoatRoughness: 0.22,
    }),
    bezel: new THREE.MeshPhysicalMaterial({
      color: 0x07080a,
      roughness: 0.18,
      metalness: 0.06,
      clearcoat: 0.45,
      clearcoatRoughness: 0.12,
      side: THREE.DoubleSide,
    }),
    screen: new THREE.MeshPhysicalMaterial({
      color: 0x252b35,
      roughness: 0.1,
      metalness: 0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.06,
      side: THREE.DoubleSide,
    }),
    rearGlass: new THREE.MeshPhysicalMaterial({
      color: finish.rearGlass,
      roughness: 0.38,
      metalness: 0.08,
      clearcoat: 0.25,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide,
    }),
    camera: new THREE.MeshPhysicalMaterial({
      color: finish.camera,
      roughness: 0.2,
      metalness: 0.52,
      clearcoat: 0.32,
      clearcoatRoughness: 0.12,
    }),
    lensRing: new THREE.MeshPhysicalMaterial({
      color: 0x77787c,
      roughness: 0.2,
      metalness: 0.82,
      clearcoat: 0.22,
      clearcoatRoughness: 0.12,
    }),
    lensHousing: new THREE.MeshPhysicalMaterial({
      color: 0x0d0e11,
      roughness: 0.16,
      metalness: 0.28,
      clearcoat: 0.48,
      clearcoatRoughness: 0.08,
      side: THREE.DoubleSide,
    }),
    cameraShadow: new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    lens: new THREE.MeshPhysicalMaterial({
      color: 0x090d1a,
      roughness: 0.035,
      metalness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.025,
      iridescence: 0.32,
      iridescenceIOR: 1.45,
      side: THREE.DoubleSide,
    }),
    lensDome: new THREE.MeshPhysicalMaterial({
      color: 0x111a31,
      roughness: 0.025,
      metalness: 0,
      transmission: 0.32,
      thickness: 0.022,
      ior: 1.52,
      clearcoat: 1,
      clearcoatRoughness: 0.012,
      iridescence: 0.48,
      iridescenceIOR: 1.42,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
    opticalHighlight: new THREE.MeshBasicMaterial({
      color: 0xb7c9ff,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    flash: new THREE.MeshPhysicalMaterial({
      color: 0xd8d6d0,
      emissive: 0x55534f,
      emissiveIntensity: 0.015,
      roughness: 0.11,
      transmission: 0.25,
      thickness: 0.012,
      ior: 1.46,
      clearcoat: 1,
      clearcoatRoughness: 0.025,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
    flashHighlight: new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    seam: new THREE.MeshStandardMaterial({
      color: finish.seam,
      roughness: 0.6,
      metalness: 0.25,
    }),
    logo: new THREE.MeshBasicMaterial({
      color: finish.logo,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  };
}

export function createIphoneVideoMockupModel(
  options: IphoneVideoMockupOptions = {},
): IphoneVideoMockupGroup {
  const root = new THREE.Group() as IphoneVideoMockupGroup;
  root.name = "Blank-screen iPhone video mockup";

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const materials = createPhysicalMaterials(
    options.finishColor ?? new THREE.Color(0x6a6a6a),
  );

  const registerMesh = (
    id: string,
    mesh: THREE.Mesh,
    parent: THREE.Object3D = root,
  ) => {
    mesh.name = id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    meshes[id] = mesh;
    nodes[id] = mesh;
    return mesh;
  };

  const body = registerMesh(
    "phone-body",
    new THREE.Mesh(
      createRoundedExtrudedGeometry(
        PHONE_WIDTH,
        PHONE_HEIGHT,
        0.13,
        PHONE_DEPTH,
        BODY_BEVEL_SIZE,
        BODY_BEVEL_THICKNESS,
      ),
      materials.frame,
    ),
  );

  const rearPanel = registerMesh(
    "rear-glass-panel",
    new THREE.Mesh(
      createRoundedPlaneGeometry(0.688, 1.442, 0.125),
      materials.rearGlass,
    ),
  );
  rearPanel.position.z = BACK_Z;
  rearPanel.rotation.y = Math.PI;

  const screenSurface = registerMesh(
    "display-surface",
    new THREE.Mesh(
      createRoundedPlaneGeometry(0.655, 1.395, 0.096),
      options.screenMaterial ?? materials.screen,
    ),
  );
  screenSurface.position.z = FRONT_Z + 0.001;

  const screenSocket = new THREE.Object3D();
  screenSocket.name = "video-texture-socket";
  screenSocket.position.copy(screenSurface.position);
  root.add(screenSocket);
  sockets.videoSurface = screenSocket;
  nodes[screenSocket.name] = screenSocket;

  const bezel = registerMesh(
    "screen-bezel",
    new THREE.Mesh(
      createRoundedRingGeometry(0.683, 1.427, 0.112, 0.655, 1.395, 0.096),
      materials.bezel,
    ),
  );
  bezel.position.z = FRONT_Z + 0.004;

  const island = registerMesh(
    "sensor-island",
    new THREE.Mesh(
      createRoundedPlaneGeometry(0.17, 0.052, 0.026),
      materials.bezel,
    ),
  );
  island.position.set(0, 0.605, FRONT_Z + 0.006);

  const cameraAssembly = new THREE.Group();
  cameraAssembly.name = "camera-assembly";
  // Positive model X reads as the viewer's left when the phone is inspected
  // from behind, matching the reference camera placement.
  cameraAssembly.position.set(0.22, 0.529, BACK_Z - 0.004);
  root.add(cameraAssembly);
  nodes[cameraAssembly.name] = cameraAssembly;

  for (const [index, shadow] of [
    { width: 0.18, height: 0.324, opacity: 0.2 },
    { width: 0.19, height: 0.336, opacity: 0.09 },
  ].entries()) {
    const shadowMaterial = materials.cameraShadow.clone();
    shadowMaterial.opacity = shadow.opacity;
    const cameraHalo = registerMesh(
      `camera-module-shadow-${index + 1}`,
      new THREE.Mesh(
        createRoundedPlaneGeometry(
          shadow.width,
          shadow.height,
          shadow.width / 2,
        ),
        shadowMaterial,
      ),
      cameraAssembly,
    );
    cameraHalo.position.set(
      -0.009 - index * 0.007,
      -0.012 - index * 0.008,
      0.007 + index * 0.001,
    );
    cameraHalo.rotation.y = Math.PI;
    cameraHalo.renderOrder = -2 - index;
  }

  const cameraPlateau = registerMesh(
    "camera-plateau",
    new THREE.Mesh(
      createRoundedExtrudedGeometry(0.162, 0.31, 0.081, 0.012),
      materials.camera,
    ),
    cameraAssembly,
  );

  const lensRingGeometry = new THREE.TorusGeometry(0.0605, 0.0035, 24, 72);
  const lensHousingGeometry = new THREE.RingGeometry(0.0435, 0.057, 64);
  const lensGlassGeometry = new THREE.CircleGeometry(0.043, 64);
  const lensDomeGeometry = new THREE.SphereGeometry(0.042, 48, 24);
  lensDomeGeometry.scale(1, 1, 0.18);
  const lensHighlightGeometry = new THREE.TorusGeometry(
    0.031,
    0.0021,
    8,
    36,
    Math.PI * 0.62,
  );

  for (const [index, localY] of [0.076, -0.076].entries()) {
    const lensModule = new THREE.Group();
    lensModule.name = `lens-module-${index + 1}`;
    lensModule.position.set(0, localY, -0.017);
    cameraAssembly.add(lensModule);
    nodes[lensModule.name] = lensModule;

    const outerRing = registerMesh(
      `lens-${index + 1}-outer-ring`,
      new THREE.Mesh(lensRingGeometry, materials.lensRing),
      lensModule,
    );
    const innerRing = registerMesh(
      `lens-${index + 1}-inner-ring`,
      new THREE.Mesh(lensHousingGeometry, materials.lensHousing),
      lensModule,
    );
    innerRing.position.z = -0.003;
    const lensGlass = registerMesh(
      `lens-${index + 1}-glass`,
      new THREE.Mesh(lensGlassGeometry, materials.lens),
      lensModule,
    );
    lensGlass.position.z = -0.006;
    const lensDome = registerMesh(
      `lens-${index + 1}-glass-dome`,
      new THREE.Mesh(lensDomeGeometry, materials.lensDome),
      lensModule,
    );
    lensDome.position.z = -0.009;
    const lensHighlight = registerMesh(
      `lens-${index + 1}-reflection-arc`,
      new THREE.Mesh(lensHighlightGeometry, materials.opticalHighlight),
      lensModule,
    );
    lensHighlight.position.z = -0.014;
    lensHighlight.rotation.z = 2.18;
    lensHighlight.renderOrder = 4;
    outerRing.renderOrder = 2;
  }

  const flashAssembly = new THREE.Group();
  flashAssembly.name = "rear-flash-assembly";
  flashAssembly.position.set(0.055, 0.529, BACK_Z - 0.008);
  root.add(flashAssembly);
  nodes[flashAssembly.name] = flashAssembly;

  const flashShadow = registerMesh(
    "rear-flash-shadow",
    new THREE.Mesh(new THREE.CircleGeometry(0.03, 48), materials.cameraShadow),
    flashAssembly,
  );
  flashShadow.position.z = 0.004;
  flashShadow.rotation.y = Math.PI;

  const flash = registerMesh(
    "rear-flash",
    new THREE.Mesh(new THREE.CircleGeometry(0.027, 48), materials.flash),
    flashAssembly,
  );
  flash.position.z = -0.009;
  flash.rotation.y = Math.PI;

  const flashHighlight = registerMesh(
    "rear-flash-reflection",
    new THREE.Mesh(
      new THREE.CircleGeometry(0.008, 24),
      materials.flashHighlight,
    ),
    flashAssembly,
  );
  flashHighlight.position.set(0.008, 0.009, -0.012);
  flashHighlight.scale.set(0.58, 1, 1);
  flashHighlight.rotation.y = Math.PI;
  flashHighlight.renderOrder = 4;

  const rearMark = registerMesh(
    "rear-logo",
    new THREE.Mesh(createRearMarkGeometry(), materials.logo),
  );
  rearMark.position.set(0, -0.015, BACK_Z - 0.004);
  rearMark.rotation.y = Math.PI;

  const addButton = (
    id: string,
    side: "left" | "right",
    y: number,
    height: number,
  ) => {
    const button = registerMesh(
      id,
      new THREE.Mesh(createSideButtonGeometry(height), materials.frame),
    );
    button.position.set(side === "left" ? -SIDE_BUTTON_X : SIDE_BUTTON_X, y, 0);
    return button;
  };

  addButton("left-action-button", "left", 0.44, 0.052);
  addButton("left-volume-up", "left", 0.285, 0.082);
  addButton("left-volume-down", "left", 0.155, 0.082);
  addButton("right-power-button", "right", 0.34, 0.122);
  addButton("right-camera-control", "right", -0.125, 0.086);

  const bottomHardwareY = -PHONE_HEIGHT / 2 - BODY_BEVEL_SIZE - 0.001;
  const portRimGeometry = createRoundedRingGeometry(
    0.108,
    0.03,
    0.015,
    0.086,
    0.014,
    0.007,
  );
  portRimGeometry.rotateX(Math.PI / 2);
  const portRim = registerMesh(
    "bottom-usb-c-rim",
    new THREE.Mesh(portRimGeometry, materials.camera),
  );
  portRim.position.y = bottomHardwareY;

  const portCavityGeometry = createRoundedPlaneGeometry(0.086, 0.014, 0.007);
  portCavityGeometry.rotateX(Math.PI / 2);
  const portCavity = registerMesh(
    "bottom-usb-c-cavity",
    new THREE.Mesh(portCavityGeometry, materials.bezel),
  );
  portCavity.position.y = bottomHardwareY - 0.0005;

  const speakerHoleGeometry = new THREE.CircleGeometry(0.0052, 20);
  speakerHoleGeometry.rotateX(Math.PI / 2);
  const bottomHolePositions = [
    -0.22, -0.193, -0.166, -0.139, 0.105, 0.128, 0.151, 0.174, 0.197, 0.22,
  ];
  for (const [index, x] of bottomHolePositions.entries()) {
    const speakerHole = registerMesh(
      `bottom-speaker-hole-${index + 1}`,
      new THREE.Mesh(speakerHoleGeometry, materials.bezel),
    );
    speakerHole.position.set(x, bottomHardwareY - 0.0005, 0);
  }

  for (const [index, y] of [0.58, -0.61].entries()) {
    for (const side of [-1, 1]) {
      const seam = registerMesh(
        `antenna-seam-${index}-${side}`,
        new THREE.Mesh(
          new THREE.BoxGeometry(0.0015, 0.004, 0.054),
          materials.seam,
        ),
      );
      seam.position.set(side * (SIDE_RAIL_X - 0.0004), y, 0);
    }
  }

  root.userData.sculptRuntime = {
    nodes,
    meshes,
    sockets,
    colliders: {
      body: {
        type: "rounded-box",
        size: [PHONE_WIDTH, PHONE_HEIGHT, PHONE_DEPTH],
      },
      screen: {
        type: "rounded-plane",
        size: [0.655, 1.395],
      },
    },
    destructionGroups: {
      body: [body],
      frontGlass: [screenSurface, bezel, island],
      camera: [cameraAssembly, cameraPlateau],
    },
  };

  return root;
}

export function setIphoneVideoMockupScreenMaterial(
  model: THREE.Group,
  material: THREE.Material,
) {
  const runtime = model.userData.sculptRuntime as
    | IphoneVideoMockupRuntime
    | undefined;
  const screen = runtime?.meshes["display-surface"];
  if (screen) screen.material = material;
}
