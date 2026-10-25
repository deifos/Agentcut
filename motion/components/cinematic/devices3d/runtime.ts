// three.js side of <Device3D>: one renderer per device, lit like ScreenSlick's device stage, drawn
// through the cinematic Stage's camera. Loaded on demand so pages without 3D devices don't pay for three.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  disposeVideoDeviceModel,
  loadVideoDeviceModel,
  type LoadedVideoDeviceModel,
  type VideoDeviceModelId,
} from "./models";
import { setMacbookLidAngle } from "./macbook-model";

const SCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vViewNormal;
varying vec3 vViewDir;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewNormal = normalize(normalMatrix * normal);
  vViewDir = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const SCREEN_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform mat3 uvTransform;
uniform float brightness;
uniform float hasMap;
uniform vec3 offColor;
varying vec2 vUv;
varying vec3 vViewNormal;
varying vec3 vViewDir;
void main() {
  vec2 uv = (uvTransform * vec3(vUv, 1.0)).xy;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  vec3 color = offColor;
  if (hasMap > 0.5) color = texture2D(map, clamp(uv, 0.0, 1.0)).rgb * inside;
  // Real displays go dark edge-on.
  float facing = abs(dot(normalize(vViewNormal), normalize(vViewDir)));
  float grazing = smoothstep(0.06, 0.32, facing);
  gl_FragColor = vec4(mix(offColor, color, brightness * grazing), 1.0);
  #include <colorspace_fragment>
}
`;

export interface DeviceFrameParams {
  width: number;
  height: number;
  /** Viewer distance of the Stage projection (px). */
  D: number;
  fov: number;
  /** Screen-space shift of the Stage's target (px). */
  shiftX: number;
  shiftY: number;
  /** Stage camera-space placement (row-major 4×4, CSS axes, px): view × model. */
  matrix: number[];
  /** Largest dimension of the device in camera-space px at scale 1. */
  size: number;
  exposure: number;
  lidAngle: number;
  /** Where the screenshot sits when it's taller than the screen: 0 top … 1 bottom. */
  scroll: number;
  pixelRatio: number;
}

export interface DeviceRenderer {
  readonly screenAspect: number;
  readonly targetSize: number;
  /**
   * Where a point of the screenshot (fractions, y down) sits on the device, in model units (y up),
   * relative to the device center, for the given scroll and lid angle. Lifts start from these points.
   */
  imagePoint(x: number, y: number, scroll: number, lidAngle: number): [number, number, number];
  setImage(image: HTMLImageElement | null): void;
  render(params: DeviceFrameParams): void;
  dispose(): void;
}

export async function createDeviceRenderer(
  canvas: HTMLCanvasElement,
  id: VideoDeviceModelId,
  finishColor?: string,
  /** A GLB the user brings (in place of the bundled model, or required for external models). */
  modelSrc?: string,
): Promise<DeviceRenderer> {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  room.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
  });
  pmrem.dispose();
  scene.environment = environment;
  // Laptops and displays are big flat aluminium and black keys: a softer, darker studio keeps the
  // anodised finish and the keyboard from washing out. Phones keep the brighter rig.
  const studio = id === "procedural-macbook" || id === "macbook-pro-14" || id === "procedural-display";
  scene.environmentIntensity = studio ? 0.6 : 1;
  const baseExposure = studio ? 0.98 : 1.12;

  const camera = new THREE.PerspectiveCamera(24, 16 / 9, 1, 100000);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xf1f5ff, 0x14161b, studio ? 0.35 : 1.4));
  // Lights ride with the camera so every angle stays product-lit (ScreenSlick's rig).
  for (const [color, intensity, position] of [
    [0xfff4e7, studio ? 3.4 : 5.2, [-2.8, 3.4, 4.4]],
    [0x86aaff, studio ? 2.4 : 3.1, [3.5, 1.5, -3.2]],
    [0xffffff, studio ? 0.6 : 1.4, [1.8, -1.4, 3.2]],
  ] as const) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(position[0], position[1], position[2]);
    camera.add(light);
    camera.add(light.target);
    light.target.position.set(0, 0, -3);
  }

  const screenMaterial = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
      uvTransform: { value: new THREE.Matrix3() },
      brightness: { value: 1 },
      hasMap: { value: 0 },
      offColor: { value: new THREE.Color(0x07080b) },
    },
    vertexShader: SCREEN_VERTEX,
    fragmentShader: SCREEN_FRAGMENT,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  let model: LoadedVideoDeviceModel | null = null;
  try {
    model = await loadVideoDeviceModel(id, screenMaterial, finishColor, modelSrc);
    if (!model) throw new Error(`Couldn't load the ${id} device model.`);
  } catch (error) {
    // Free the GPU side before giving up: a failed load must not keep a WebGL context alive.
    screenMaterial.dispose();
    environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
  const holder = new THREE.Group();
  holder.matrixAutoUpdate = false;
  holder.add(model.root);
  scene.add(holder);

  let texture: THREE.Texture | null = null;
  let imageAspect = model.config.screenAspect;
  let lastScroll = -1;

  // Cover the screen; a taller screenshot shows its top (or scrolls), a wider one is centered.
  // Screen uv → image uv: (tx + sx·u, ty + sy·v).
  const uvFit = (scroll: number) => {
    const screenAspect = model.config.screenAspect;
    let repeatX = 1;
    let repeatY = 1;
    if (imageAspect > screenAspect) repeatX = screenAspect / imageAspect;
    else repeatY = imageAspect / screenAspect;
    const offsetX = (1 - repeatX) / 2;
    const s = Math.min(1, Math.max(0, scroll));
    // flipY puts the image's top at v = 1; without it (glTF UVs) the top is at v = 0.
    const offsetY = (1 - repeatY) * (model.config.textureFlipY ? 1 - s : s);
    const mirror = model.config.textureMirrorX;
    return { tx: mirror ? 1 - offsetX : offsetX, ty: offsetY, sx: mirror ? -repeatX : repeatX, sy: repeatY };
  };

  const fitTexture = (scroll: number) => {
    const f = uvFit(scroll);
    (screenMaterial.uniforms.uvTransform.value as THREE.Matrix3).setUvTransform(f.tx, f.ty, f.sx, f.sy, 0, 0, 0);
    lastScroll = scroll;
  };

  const relative = new THREE.Matrix4();
  const point = new THREE.Vector3();

  // CSS camera space (y down) ↔ three (y up): conjugate by a y flip.
  const flip = new THREE.Matrix4().makeScale(1, -1, 1);
  const placement = new THREE.Matrix4();
  const scale = new THREE.Matrix4();

  return {
    screenAspect: model.config.screenAspect,
    targetSize: model.config.targetSize,
    imagePoint(x, y, scroll, lidAngle) {
      if (id === "procedural-macbook") setMacbookLidAngle(model.root, lidAngle);
      model.root.updateMatrixWorld(true);
      holder.updateMatrixWorld(true);
      relative.copy(holder.matrixWorld).invert().multiply(model.screen.matrixWorld);
      const f = uvFit(scroll);
      // With flipY image v runs up (the top of the screenshot is v = 1); without it, v runs down.
      const u = (x - f.tx) / f.sx;
      const v = ((model.config.textureFlipY ? 1 - y : y) - f.ty) / f.sy;
      const frame = model.screenFrame;
      point.copy(frame.origin).addScaledVector(frame.du, u).addScaledVector(frame.dv, v).applyMatrix4(relative);
      return [point.x, point.y, point.z];
    },
    setImage(image) {
      texture?.dispose();
      texture = null;
      if (!image) {
        screenMaterial.uniforms.map.value = null;
        screenMaterial.uniforms.hasMap.value = 0;
        return;
      }
      texture = new THREE.Texture(image);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = model.config.textureFlipY;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
      imageAspect = image.naturalWidth / Math.max(1, image.naturalHeight);
      screenMaterial.uniforms.map.value = texture;
      screenMaterial.uniforms.hasMap.value = 1;
      lastScroll = -1;
    },
    render(p) {
      if (canvas.width !== Math.round(p.width * p.pixelRatio) || canvas.height !== Math.round(p.height * p.pixelRatio)) {
        renderer.setPixelRatio(p.pixelRatio);
        renderer.setSize(p.width, p.height, false);
      }
      renderer.toneMappingExposure = baseExposure * p.exposure;
      if (p.scroll !== lastScroll) fitTexture(p.scroll);
      if (id === "procedural-macbook") setMacbookLidAngle(model.root, p.lidAngle);

      camera.fov = p.fov;
      camera.aspect = p.width / p.height;
      camera.near = Math.max(1, p.D * 0.02);
      camera.far = p.D * 40;
      camera.position.set(0, 0, p.D);
      camera.lookAt(0, 0, 0);
      camera.setViewOffset(p.width, p.height, -p.shiftX, -p.shiftY, p.width, p.height);
      camera.updateProjectionMatrix();

      // Row-major (CSS) → three's column-major set().
      const m = p.matrix;
      placement.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11], m[12], m[13], m[14], m[15]);
      const k = p.size / model.config.targetSize;
      scale.makeScale(k, k, k);
      holder.matrix.copy(flip).multiply(placement).multiply(flip).multiply(scale);
      holder.matrixWorldNeedsUpdate = true;
      renderer.render(scene, camera);
    },
    dispose() {
      texture?.dispose();
      disposeVideoDeviceModel(model);
      screenMaterial.dispose();
      environment.dispose();
      renderer.dispose();
      // Browsers keep only ~16 WebGL contexts; release this one now instead of at garbage collection.
      renderer.forceContextLoss();
    },
  };
}

export type { VideoDeviceModelId };
