import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createIphoneVideoMockupModel } from "./iphone-model";
import {
  createMacbookModel,
  MACBOOK_SCREEN_ASPECT,
} from "./macbook-model";
import {
  createDisplayModel,
  DISPLAY_SCREEN_ASPECT,
} from "./display-model";
export type DeviceCategory = "phone" | "laptop" | "desktop";

export type VideoDeviceModelId =
  | "procedural-iphone"
  | "iphone-16-pro-max"
  | "procedural-macbook"
  | "macbook-pro-14"
  | "procedural-display";

export interface VideoDeviceModelConfig {
  id: VideoDeviceModelId;
  name: string;
  category: DeviceCategory;
  source?: string;
  screenAspect: number;
  screenFit: "contain" | "cover";
  screenMeshName?: string;
  screenMaterialName?: string;
  screenUvMirrorX: boolean;
  /** Keep the screen mesh's own UVs (they already map a full screen image) instead of reprojecting. */
  keepScreenUvs?: boolean;
  /** Not bundled (its licence forbids redistribution): the scene must pass its own copy as modelSrc. */
  external?: boolean;
  shadowMode: "silhouette" | "base";
  shadowSilhouetteMeshNames?: string[];
  mappingVersion: number;
  textureFlipY: boolean;
  textureMirrorX: boolean;
  targetSize: number;
  rotation: [number, number, number];
  cameraZ: number;
  cameraY: number;
  credit: string;
}

/**
 * Affine map from the screen mesh's UVs to its local positions:
 * position = origin + du * uv.x + dv * uv.y.
 */
export interface VideoDeviceScreenFrame {
  origin: THREE.Vector3;
  du: THREE.Vector3;
  dv: THREE.Vector3;
}

export interface LoadedVideoDeviceModel {
  root: THREE.Group;
  screen: THREE.Mesh;
  screenFrame: VideoDeviceScreenFrame;
  config: VideoDeviceModelConfig;
  ownsGeometries: boolean;
}

/** Least-squares fit of the (planar) screen's UV → position mapping. */
export function computeScreenFrame(screen: THREE.Mesh): VideoDeviceScreenFrame {
  const position = screen.geometry.getAttribute("position");
  const uv = screen.geometry.getAttribute("uv");
  const fallback = () => {
    screen.geometry.computeBoundingBox();
    const box = screen.geometry.boundingBox ?? new THREE.Box3();
    return {
      origin: new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      du: new THREE.Vector3(box.max.x - box.min.x, 0, 0),
      dv: new THREE.Vector3(0, box.max.y - box.min.y, 0),
    };
  };
  if (!position || !uv || uv.count < 3) return fallback();
  // Normal equations for [u v 1] · [du dv o]ᵀ = p
  let suu = 0, suv = 0, su = 0, svv = 0, sv = 0, n = 0;
  const pu = new THREE.Vector3();
  const pv = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const point = new THREE.Vector3();
  const step = Math.max(1, Math.floor(uv.count / 400));
  for (let index = 0; index < uv.count; index += step) {
    const u = uv.getX(index);
    const v = uv.getY(index);
    point.fromBufferAttribute(position as THREE.BufferAttribute, index);
    suu += u * u;
    suv += u * v;
    su += u;
    svv += v * v;
    sv += v;
    n += 1;
    pu.addScaledVector(point, u);
    pv.addScaledVector(point, v);
    p1.add(point);
  }
  const matrix = new THREE.Matrix3().set(suu, suv, su, suv, svv, sv, su, sv, n);
  if (Math.abs(matrix.determinant()) < 1e-12) return fallback();
  const inverse = matrix.clone().invert();
  const e = inverse.elements; // column-major
  const solve = (row: number) =>
    new THREE.Vector3()
      .addScaledVector(pu, e[row])
      .addScaledVector(pv, e[row + 3])
      .addScaledVector(p1, e[row + 6]);
  return { du: solve(0), dv: solve(1), origin: solve(2) };
}

export interface DeviceSilhouettePoint {
  x: number;
  y: number;
}

function collectVideoDeviceMeshPoints(
  model: LoadedVideoDeviceModel,
  meshNames?: ReadonlySet<string>,
) {
  model.root.updateMatrixWorld(true);
  const inverseRoot = model.root.matrixWorld.clone().invert();
  const points: THREE.Vector3[] = [];
  model.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (meshNames && !meshNames.has(object.name)) return;
    const position = object.geometry.getAttribute("position");
    if (!(position instanceof THREE.BufferAttribute)) return;
    object.updateWorldMatrix(true, false);
    const step = Math.max(1, Math.ceil(position.count / 96));
    for (let index = 0; index < position.count; index += step) {
      points.push(
        new THREE.Vector3()
          .fromBufferAttribute(position, index)
          .applyMatrix4(object.matrixWorld)
          .applyMatrix4(inverseRoot),
      );
    }
  });
  return points;
}

export function collectVideoDeviceSilhouettePoints(
  model: LoadedVideoDeviceModel,
) {
  return collectVideoDeviceMeshPoints(model);
}

export function collectVideoDeviceShadowSilhouettePoints(
  model: LoadedVideoDeviceModel,
) {
  const meshNames = model.config.shadowSilhouetteMeshNames;
  if (!meshNames?.length) return collectVideoDeviceMeshPoints(model);

  const points = collectVideoDeviceMeshPoints(model, new Set(meshNames));
  return points.length >= 3 ? points : collectVideoDeviceMeshPoints(model);
}

function cross(
  origin: DeviceSilhouettePoint,
  a: DeviceSilhouettePoint,
  b: DeviceSilhouettePoint,
) {
  return (
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x)
  );
}

function getConvexHull(points: DeviceSilhouettePoint[]) {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: DeviceSilhouettePoint[] = [];
  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: DeviceSilhouettePoint[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export function projectVideoDeviceSilhouette(
  localPoints: THREE.Vector3[],
  root: THREE.Object3D,
  camera: THREE.Camera,
  width: number,
  height: number,
  shadowMode: "silhouette" | "base" = "silhouette",
) {
  root.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const projected = localPoints
    .map((localPoint) => {
      const point = localPoint
        .clone()
        .applyMatrix4(root.matrixWorld)
        .project(camera);
      return {
        x: (point.x * 0.5 + 0.5) * width,
        y: (-point.y * 0.5 + 0.5) * height,
        z: point.z,
      };
    })
    .filter(
      (point) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        point.z >= -1 &&
        point.z <= 1,
    )
    .map(({ x, y }) => ({ x, y }));
  const hull = getConvexHull(projected);
  if (shadowMode !== "base" || hull.length < 3) return hull;
  const minX = Math.min(...hull.map((point) => point.x));
  const maxX = Math.max(...hull.map((point) => point.x));
  const minY = Math.min(...hull.map((point) => point.y));
  const maxY = Math.max(...hull.map((point) => point.y));
  const spanWidth = maxX - minX;
  const contactHeight = Math.max(4, (maxY - minY) * 0.035);
  return [
    { x: minX + spanWidth * 0.08, y: maxY - contactHeight },
    { x: maxX - spanWidth * 0.08, y: maxY - contactHeight },
    { x: maxX - spanWidth * 0.02, y: maxY },
    { x: minX + spanWidth * 0.02, y: maxY },
  ];
}

/**
 * Prevent a requested camera distance from pushing any part of a rotated
 * device outside the render viewport. The returned distance preserves the
 * user's zoom whenever it fits and only backs the camera off enough to keep a
 * small safety margin around the hardware.
 */
export function getVideoDeviceCameraZToFit(
  localPoints: THREE.Vector3[],
  root: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  requestedCameraZ: number,
  visibleFraction = 0.94,
) {
  if (localPoints.length === 0 || camera.aspect <= 0) return requestedCameraZ;

  root.updateMatrixWorld(true);
  const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const horizontalTangent = verticalTangent * camera.aspect;
  const safeVerticalTangent = verticalTangent * visibleFraction;
  const safeHorizontalTangent = horizontalTangent * visibleFraction;
  let minimumCameraZ = requestedCameraZ;

  for (const localPoint of localPoints) {
    const point = localPoint.clone().applyMatrix4(root.matrixWorld);
    minimumCameraZ = Math.max(
      minimumCameraZ,
      point.z + Math.abs(point.x - camera.position.x) / safeHorizontalTangent,
      point.z + Math.abs(point.y - camera.position.y) / safeVerticalTangent,
      point.z + camera.near * 2,
    );
  }

  return minimumCameraZ;
}

export const VIDEO_DEVICE_MODEL_CONFIGS: Record<
  VideoDeviceModelId,
  VideoDeviceModelConfig
> = {
  "procedural-iphone": {
    id: "procedural-iphone",
    name: "iPhone",
    category: "phone",
    screenAspect: 0.655 / 1.395,
    screenFit: "cover",
    screenUvMirrorX: false,
    shadowMode: "silhouette",
    shadowSilhouetteMeshNames: ["phone-body"],
    mappingVersion: 12,
    textureFlipY: true,
    textureMirrorX: false,
    targetSize: 1.47,
    rotation: [0, 0, 0],
    cameraZ: 3.05,
    cameraY: 0.02,
    credit: "Original ScreenSlick procedural model",
  },
  "iphone-16-pro-max": {
    id: "iphone-16-pro-max",
    name: "iPhone 16 Pro Max",
    category: "phone",
    source: "/models/iphone-16-pro-max.glb",
    screenAspect: 1320 / 2868,
    screenFit: "cover",
    screenMeshName: "Cube.014_screen.001_0",
    screenMaterialName: "screen.001",
    screenUvMirrorX: true,
    shadowMode: "silhouette",
    mappingVersion: 3,
    textureFlipY: true,
    textureMirrorX: false,
    targetSize: 1.52,
    rotation: [0, Math.PI / 2, 0],
    cameraZ: 3.15,
    cameraY: 0.02,
    credit: "MajdyModels · CC BY 4.0",
  },
  "procedural-macbook": {
    id: "procedural-macbook",
    name: "MacBook",
    category: "laptop",
    screenAspect: MACBOOK_SCREEN_ASPECT,
    screenFit: "contain",
    screenUvMirrorX: false,
    shadowMode: "silhouette",
    shadowSilhouetteMeshNames: ["laptop-base"],
    mappingVersion: 1,
    textureFlipY: true,
    textureMirrorX: false,
    targetSize: 2,
    rotation: [0, 0, 0],
    cameraZ: 4.2,
    cameraY: 0.05,
    credit: "Original ScreenSlick procedural model",
  },
  "macbook-pro-14": {
    id: "macbook-pro-14",
    name: "MacBook Pro 14-inch",
    category: "laptop",
    // Sketchfab "MacBook Pro 14-inch M5" (Standard licence): users bring their own copy (modelSrc).
    external: true,
    // 3024 × 1964 Liquid Retina XDR.
    screenAspect: 3024 / 1964,
    screenFit: "cover",
    screenMaterialName: "HlQwFCAPWzetDQy",
    screenUvMirrorX: false,
    keepScreenUvs: true,
    shadowMode: "silhouette",
    mappingVersion: 1,
    // glTF UVs put the image's top at v = 0.
    textureFlipY: false,
    textureMirrorX: false,
    targetSize: 2,
    rotation: [0, 0, 0],
    cameraZ: 4.2,
    cameraY: 0.05,
    credit: "MacBook Pro 14-inch (M5) model",
  },
  "procedural-display": {
    id: "procedural-display",
    name: "Studio Display",
    category: "desktop",
    screenAspect: DISPLAY_SCREEN_ASPECT,
    screenFit: "contain",
    screenUvMirrorX: false,
    shadowMode: "silhouette",
    shadowSilhouetteMeshNames: ["display-foot"],
    mappingVersion: 1,
    textureFlipY: true,
    textureMirrorX: false,
    targetSize: 4,
    rotation: [0, 0, 0],
    cameraZ: 6,
    cameraY: 0.05,
    credit: "Original ScreenSlick procedural model",
  },
};

const MODEL_FALLBACK_ORIGIN = "https://agentcut.synteq.app";

const templatePromises = new Map<string, Promise<THREE.Group>>();
const templates = new Map<string, THREE.Group>();

function cloneModelTemplate(template: THREE.Group) {
  const clone = template.clone(true);
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone();
  });
  return clone;
}

function normalizeModel(root: THREE.Group, config: VideoDeviceModelConfig) {
  root.rotation.set(...config.rotation);
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 0.0001);
  root.scale.multiplyScalar(config.targetSize / maxDimension);
  root.updateMatrixWorld(true);
  const normalizedBounds = new THREE.Box3().setFromObject(root);
  const center = normalizedBounds.getCenter(new THREE.Vector3());
  root.position.sub(center);
}

function findScreenMesh(root: THREE.Group, config: VideoDeviceModelConfig) {
  const named = config.screenMeshName
    ? root.getObjectByName(config.screenMeshName)
    : null;
  if (named instanceof THREE.Mesh) return named;

  const matches: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (matches.length > 0 || !(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    if (
      materials.some((material) => material.name === config.screenMaterialName)
    ) {
      matches.push(object);
    }
  });
  return matches[0] ?? null;
}

type PositionAxis = "x" | "y" | "z";

function projectScreenUvs(screen: THREE.Mesh, config: VideoDeviceModelConfig) {
  const geometry = screen.geometry.clone();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  if (
    !bounds ||
    !(position instanceof THREE.BufferAttribute) ||
    !(uv instanceof THREE.BufferAttribute) ||
    uv.count === 0
  ) {
    screen.geometry = geometry;
    screen.userData.ownsVideoScreenGeometry = true;
    return;
  }

  screen.updateWorldMatrix(true, false);
  const worldBasis = new THREE.Matrix3().setFromMatrix4(screen.matrixWorld);
  const axes = (["x", "y", "z"] as const)
    .map((axis) => {
      const localSpan = Math.max(0.0001, bounds.max[axis] - bounds.min[axis]);
      const basis =
        axis === "x"
          ? new THREE.Vector3(1, 0, 0)
          : axis === "y"
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(0, 0, 1);
      const worldSpan = basis.applyMatrix3(worldBasis).length() * localSpan;
      return { axis, localSpan, worldSpan };
    })
    .sort((a, b) => b.worldSpan - a.worldSpan)
    .slice(0, 2);
  const [longAxis, shortAxis] = axes;
  const uAxis = config.screenAspect >= 1 ? longAxis : shortAxis;
  const vAxis = config.screenAspect >= 1 ? shortAxis : longAxis;
  const readPosition = (axis: PositionAxis, index: number) =>
    axis === "x"
      ? position.getX(index)
      : axis === "y"
        ? position.getY(index)
        : position.getZ(index);

  for (let index = 0; index < uv.count; index += 1) {
    const projectedU =
      (readPosition(uAxis.axis, index) - bounds.min[uAxis.axis]) /
      uAxis.localSpan;
    uv.setXY(
      index,
      config.screenUvMirrorX ? 1 - projectedU : projectedU,
      (readPosition(vAxis.axis, index) - bounds.min[vAxis.axis]) /
        vAxis.localSpan,
    );
  }
  uv.needsUpdate = true;
  screen.geometry = geometry;
  screen.userData.ownsVideoScreenGeometry = true;
}

/** Cache key: a model id, plus the file when the caller brings its own (modelSrc). */
const templateKey = (id: VideoDeviceModelId, source?: string) => (source ? `${id}|${source}` : id);

/** The GLB a model loads: the caller's own file (bring-your-own models), else the bundled one. */
function modelSource(id: VideoDeviceModelId, sourceOverride?: string) {
  return sourceOverride || VIDEO_DEVICE_MODEL_CONFIGS[id]?.source || "";
}

export async function preloadVideoDeviceModel(id: VideoDeviceModelId, sourceOverride?: string) {
  const config = VIDEO_DEVICE_MODEL_CONFIGS[id];
  if (!config) return;
  const source = modelSource(id, sourceOverride);
  if (!source) {
    if (config.external) {
      throw new Error(
        `The ${config.name} model isn't bundled with Agentcut (its licence doesn't allow redistribution): pass your own copy with modelSrc.`,
      );
    }
    return;
  }
  const key = templateKey(id, sourceOverride);
  if (templates.has(key)) return;
  const existing = templatePromises.get(key);
  if (existing) {
    await existing;
    return;
  }
  // The studio serves bundled models from its own origin; a local render (no /models there) fetches
  // them from the public site. A model the user brings is loaded only from where they put it.
  const first = new GLTFLoader().loadAsync(source);
  const promise = (sourceOverride ? first : first.catch(() => new GLTFLoader().loadAsync(`${MODEL_FALLBACK_ORIGIN}${source}`))).then(
    (gltf) => {
      templates.set(key, gltf.scene);
      return gltf.scene;
    },
    (error: unknown) => {
      // Forget the failure so the next device (or a retry) loads again instead of failing for good.
      templatePromises.delete(key);
      throw error;
    },
  );
  templatePromises.set(key, promise);
  await promise;
}

export function createPreloadedVideoDeviceModel(
  id: VideoDeviceModelId,
  screenMaterial: THREE.Material,
  finishColor?: THREE.ColorRepresentation,
  sourceOverride?: string,
): LoadedVideoDeviceModel | null {
  const config = VIDEO_DEVICE_MODEL_CONFIGS[id];
  if (!config) return null;
  if (!modelSource(id, sourceOverride) && !config.external) {
    const root =
      id === "procedural-iphone"
        ? createIphoneVideoMockupModel({ screenMaterial, finishColor })
        : id === "procedural-display"
          ? createDisplayModel({ screenMaterial, finishColor })
          : createMacbookModel({ screenMaterial, finishColor });
    const screen = root.getObjectByName("display-surface");
    if (!(screen instanceof THREE.Mesh)) {
      disposeVideoDeviceObjectMaterials(root);
      disposeVideoDeviceObjectGeometries(root);
      return null;
    }
    screen.renderOrder = 4;
    return {
      config,
      root,
      screen,
      screenFrame: computeScreenFrame(screen),
      ownsGeometries: true,
    };
  }

  const template = templates.get(templateKey(id, sourceOverride));
  if (!template) return null;
  const modelRoot = cloneModelTemplate(template);
  const screen = findScreenMesh(modelRoot, config);
  if (!screen) {
    disposeVideoDeviceObjectMaterials(modelRoot);
    return null;
  }
  modelRoot.updateMatrixWorld(true);
  if (!config.keepScreenUvs) projectScreenUvs(screen, config);
  const previousScreenMaterials = Array.isArray(screen.material)
    ? screen.material
    : [screen.material];
  previousScreenMaterials.forEach((material) => material.dispose());
  screen.material = screenMaterial;
  screen.renderOrder = 4;
  normalizeModel(modelRoot, config);
  const root = new THREE.Group();
  root.name = `${config.name} rotation root`;
  root.add(modelRoot);
  return {
    config,
    root,
    screen,
    screenFrame: computeScreenFrame(screen),
    ownsGeometries: false,
  };
}

export async function loadVideoDeviceModel(
  id: VideoDeviceModelId,
  screenMaterial: THREE.Material,
  finishColor?: THREE.ColorRepresentation,
  sourceOverride?: string,
) {
  await preloadVideoDeviceModel(id, sourceOverride);
  return createPreloadedVideoDeviceModel(id, screenMaterial, finishColor, sourceOverride);
}

export function disposeVideoDeviceModel(model: LoadedVideoDeviceModel) {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  model.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (
      (model.ownsGeometries || object.userData.ownsVideoScreenGeometry) &&
      !disposedGeometries.has(object.geometry)
    ) {
      disposedGeometries.add(object.geometry);
      object.geometry.dispose();
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.forEach((material) => {
      if (disposedMaterials.has(material)) return;
      disposedMaterials.add(material);
      material.dispose();
    });
  });
}

function disposeVideoDeviceObjectGeometries(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || geometries.has(object.geometry)) {
      return;
    }
    geometries.add(object.geometry);
    object.geometry.dispose();
  });
}

function disposeVideoDeviceObjectMaterials(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.forEach((material) => {
      if (materials.has(material)) return;
      materials.add(material);
      material.dispose();
    });
  });
}
