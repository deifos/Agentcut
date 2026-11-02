// The grade on the GPU: one shader for the colour, one optional pass for halation and bloom. A Remotion
// effect, so the live preview, captures and exports all draw exactly the same pixels.
import { createEffect, type EffectDescriptor } from "remotion";
import { bakeCurve, gradePasses, gradeUniforms, hasCurves, scaleGrade, type ColorGrade, type CubeLut, type GradeFields, type GradeUniforms } from "./grade";
import { gradeLook } from "./looks";

const VERTEX = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
out vec2 vUv;
void main() { vUv = aUv; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const COMMON = `
const vec3 REC709 = vec3(0.2126, 0.7152, 0.0722);
vec3 toLinear(vec3 c) {
  vec3 s = sign(c); c = abs(c);
  return s * mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 toGamma(vec3 c) {
  vec3 s = sign(c); c = abs(c);
  return s * mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p, float seed) {
  vec3 q = fract(vec3(p.xyx) * 0.1031 + seed * 0.1173);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
// Half a step of triangular noise, so smooth gradients survive the 8-bit output without banding.
vec3 dither(vec3 c, vec2 p) {
  float n = hash(p, 1.0) + hash(p, 2.0) - 1.0;
  return c + n / 255.0;
}
`;

const COLOR_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform sampler2D uCurves;
uniform sampler3D uLut;
uniform float uBrightness, uContrast, uPivot;
uniform mat3 uMatrix;
uniform vec3 uGains;
uniform float uMatchContrast, uMatchSaturation;
uniform float uShadows, uHighlights, uWhites, uBlacks;
uniform float uBlackPoint, uWhitePoint, uGamma;
uniform vec3 uLift, uWheelGamma, uGain;
uniform float uVibrance, uSkinProtect, uLutStrength;
uniform bool uHasCurves, uHasHsl, uHasLut, uDither;
uniform vec3 uHsl[8];
uniform vec3 uDomainMin, uDomainMax;
${COMMON}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-6)), d / (q.x + 1e-6), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
// Band centres in turns: red, orange, yellow, green, aqua, blue, purple, magenta.
const float CENTERS[9] = float[9](0.0, 0.0833, 0.1667, 0.3333, 0.5, 0.6667, 0.7778, 0.8889, 1.0);
vec3 mixer(vec3 c) {
  vec3 hsv = rgb2hsv(clamp(c, 0.0, 1.0));
  float h = fract(hsv.x);
  int i = 0;
  for (int n = 0; n < 8; n++) if (h >= CENTERS[n]) i = n;
  float t = smoothstep(0.0, 1.0, (h - CENTERS[i]) / (CENTERS[i + 1] - CENTERS[i]));
  vec3 band = mix(uHsl[i], uHsl[(i + 1) % 8], t);
  float colorful = smoothstep(0.0, 0.25, hsv.y);
  hsv.x = fract(h + band.x * 0.083);
  vec3 shifted = hsv2rgb(hsv);
  // Saturation around brightness: a desaturated blue goes dark grey, not light grey.
  shifted = mix(vec3(dot(shifted, REC709)), shifted, 1.0 + band.y);
  return shifted * (1.0 + band.z * 0.6 * colorful);
}
float skinMask(vec3 c) {
  // Skin of every complexion sits near one hue on the vectorscope (the I line, about 123 degrees).
  float y = dot(c, REC709);
  float cb = (c.b - y) * 0.5389;
  float cr = (c.r - y) * 0.635;
  float chroma = length(vec2(cb, cr));
  if (chroma < 1e-4) return 0.0;
  float angle = atan(cr, cb);
  float distance = abs(angle - 2.147);
  float hue = 1.0 - smoothstep(0.14, 0.4, distance);
  return hue * smoothstep(0.012, 0.04, chroma) * (1.0 - smoothstep(0.26, 0.4, chroma)) * smoothstep(0.06, 0.18, y);
}
vec3 sampleLut(vec3 c) {
  vec3 n = clamp((c - uDomainMin) / (uDomainMax - uDomainMin), 0.0, 1.0);
  vec3 size = vec3(textureSize(uLut, 0));
  return texture(uLut, (n * (size - 1.0) + 0.5) / size).rgb;
}
void main() {
  vec4 source = texture(uSource, vUv);
  if (source.a <= 0.0) { fragColor = vec4(0.0); return; }
  vec3 original = source.rgb / source.a;
  vec3 c = original;

  // The original controls, in the order and space CSS filters use.
  c = clamp(c * uBrightness, 0.0, 1.0);
  c = clamp((c - uPivot) * uContrast + uPivot, 0.0, 1.0);
  c = clamp(uMatrix * c, 0.0, 1.0);

  // Light: exposure, white balance and shot matching are gains on linear light.
  c = toGamma(toLinear(c) * uGains);
  if (uMatchContrast != 1.0) c = (c - 0.45) * uMatchContrast + 0.45;
  if (uMatchSaturation != 1.0) c = mix(vec3(dot(c, REC709)), c, uMatchSaturation);

  // Tone regions, picked by brightness.
  float y = dot(c, REC709);
  c += uShadows * 0.32 * pow(clamp(1.0 - y, 0.0, 1.0), 2.0) * smoothstep(0.0, 0.08, y);
  c += uHighlights * 0.32 * pow(smoothstep(0.35, 1.0, y), 2.0);
  c += uWhites * 0.18 * smoothstep(0.7, 1.0, y);
  c += uBlacks * 0.14 * (1.0 - smoothstep(0.0, 0.28, y));

  c = (c - uBlackPoint) / (uWhitePoint - uBlackPoint);
  if (uGamma != 1.0) c = pow(max(c, 0.0), vec3(1.0 / uGamma));

  // Colour wheels: lift, gamma, gain.
  c = c + uLift * (1.0 - clamp(c, 0.0, 1.0));
  c = pow(max(c, 0.0), 1.0 / uWheelGamma);
  c *= uGain;

  if (uHasCurves) {
    c = clamp(c, 0.0, 1.0);
    c = vec3(texture(uCurves, vec2(c.r, 0.5)).r, texture(uCurves, vec2(c.g, 0.5)).g, texture(uCurves, vec2(c.b, 0.5)).b);
    c = vec3(texture(uCurves, vec2(c.r, 0.5)).a, texture(uCurves, vec2(c.g, 0.5)).a, texture(uCurves, vec2(c.b, 0.5)).a);
  }

  if (uVibrance != 0.0) {
    // Lifts quiet colours more than loud ones, and leaves skin alone.
    float top = max(c.r, max(c.g, c.b));
    float low = min(c.r, min(c.g, c.b));
    float amount = uVibrance * (1.0 - clamp(top - low, 0.0, 1.0)) * (1.0 - 0.6 * skinMask(original));
    c = mix(vec3(dot(c, REC709)), c, 1.0 + amount);
  }
  if (uHasHsl) c = mixer(c);

  if (uHasLut && uLutStrength > 0.0) {
    c = clamp(c, 0.0, 1.0);
    c = mix(c, sampleLut(c), uLutStrength);
  }

  if (uSkinProtect > 0.0) {
    // Keep the new brightness, bring back the skin's own colour.
    float newY = dot(c, REC709);
    vec3 skin = newY + (original - dot(original, REC709));
    c = mix(c, skin, uSkinProtect * skinMask(original));
  }

  c = clamp(c, 0.0, 1.0);
  if (uDither) c = dither(c, gl_FragCoord.xy);
  fragColor = vec4(clamp(c, 0.0, 1.0) * source.a, source.a);
}
`;

const BRIGHT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
${COMMON}
void main() {
  vec4 source = texture(uSource, vUv);
  vec3 c = source.a > 0.0 ? source.rgb / source.a : vec3(0.0);
  float y = dot(c, REC709);
  fragColor = vec4(c * smoothstep(0.62, 0.98, y) * source.a, source.a);
}
`;

const BLUR_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform vec2 uStep;
void main() {
  vec4 sum = texture(uSource, vUv) * 0.1964825501511404;
  sum += (texture(uSource, vUv + uStep * 1.411764705882353) + texture(uSource, vUv - uStep * 1.411764705882353)) * 0.2969069646728344;
  sum += (texture(uSource, vUv + uStep * 3.2941176470588234) + texture(uSource, vUv - uStep * 3.2941176470588234)) * 0.09447039785044732;
  sum += (texture(uSource, vUv + uStep * 5.176470588235294) + texture(uSource, vUv - uStep * 5.176470588235294)) * 0.010381362401148057;
  fragColor = sum;
}
`;

const FINISH_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource, uHalationTexture, uBloomTexture;
uniform float uHalation, uBloom, uVignette, uGrain, uGrainCell, uSeed, uAspect;
${COMMON}
vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - clamp(b, 0.0, 1.0)); }
void main() {
  vec4 source = texture(uSource, vUv);
  if (source.a <= 0.0) { fragColor = vec4(0.0); return; }
  vec3 c = source.rgb / source.a;
  // Halation: light scattering back through the film base shows as a red-orange rim on highlights.
  if (uHalation > 0.0) c = screen(c, texture(uHalationTexture, vUv).rgb * vec3(1.0, 0.32, 0.1) * uHalation * 2.2);
  if (uBloom > 0.0) c = screen(c, texture(uBloomTexture, vUv).rgb * uBloom * 1.6);
  if (uVignette != 0.0) {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) / sqrt(uAspect * uAspect + 1.0) * 2.0;
    float fall = smoothstep(0.3, 1.0, length(p));
    c = uVignette > 0.0 ? c * (1.0 - uVignette * 0.85 * fall) : screen(c, vec3(-uVignette * 0.5 * fall));
  }
  if (uGrain > 0.0) {
    vec2 cell = floor(gl_FragCoord.xy / uGrainCell);
    float y = dot(c, REC709);
    // Film grain is strongest in the midtones and fades out in pure black and white.
    float weight = 0.25 + 0.75 * (1.0 - pow(abs(2.0 * y - 1.0), 2.0));
    float mono = hash(cell, uSeed) + hash(cell, uSeed + 7.0) - 1.0;
    vec3 tint = vec3(hash(cell, uSeed + 13.0), hash(cell, uSeed + 19.0), hash(cell, uSeed + 23.0)) - 0.5;
    c += (mono + tint * 0.3) * uGrain * 0.2 * weight;
  }
  c = dither(clamp(c, 0.0, 1.0), gl_FragCoord.xy);
  fragColor = vec4(clamp(c, 0.0, 1.0) * source.a, source.a);
}
`;

interface Program { handle: WebGLProgram; uniforms: Map<string, WebGLUniformLocation | null> }

interface RenderTarget { texture: WebGLTexture; framebuffer: WebGLFramebuffer; width: number; height: number }

export interface GradeRendererState {
  gl: WebGL2RenderingContext;
  color: Program;
  /** The finish's programs, compiled the first time a grade uses them: compiling is slow. */
  extra: { bright?: Program; blur?: Program; finish?: Program };
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  source: WebGLTexture;
  curves: WebGLTexture;
  lut: WebGLTexture;
  floatTargets: boolean;
  targets: Map<string, RenderTarget>;
  curveKey: string | null;
  lutKey: string | null;
}

function makeProgram(gl: WebGL2RenderingContext, fragment: string): Program {
  const compile = (type: number, text: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Grade shader failed to compile: ${log ?? "(no log)"}`);
    }
    return shader;
  };
  const vertexShader = compile(gl.VERTEX_SHADER, VERTEX);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, fragment);
  const handle = gl.createProgram()!;
  gl.attachShader(handle, vertexShader);
  gl.attachShader(handle, fragmentShader);
  gl.linkProgram(handle);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(handle);
    gl.deleteProgram(handle);
    throw new Error(`Grade shader failed to link: ${log ?? "(no log)"}`);
  }
  return { handle, uniforms: new Map() };
}

function uniform(gl: WebGL2RenderingContext, program: Program, name: string) {
  if (!program.uniforms.has(name)) program.uniforms.set(name, gl.getUniformLocation(program.handle, name));
  return program.uniforms.get(name) ?? null;
}

function texture2d(gl: WebGL2RenderingContext) {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

export function setupGradeRenderer(canvas: HTMLCanvasElement | OffscreenCanvas): GradeRendererState {
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error("The color grade needs WebGL2, which this browser could not provide.");
  const vao = gl.createVertexArray()!;
  const vbo = gl.createBuffer()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  gl.bindVertexArray(null);
  const lut = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_3D, lut);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_3D, null);
  return {
    gl,
    color: makeProgram(gl, COLOR_FRAGMENT),
    extra: {},
    vao,
    vbo,
    source: texture2d(gl),
    curves: texture2d(gl),
    lut,
    floatTargets: Boolean(gl.getExtension("EXT_color_buffer_float")),
    targets: new Map(),
    curveKey: null,
    lutKey: null,
  };
}

export function cleanupGradeRenderer(state: GradeRendererState) {
  const { gl } = state;
  for (const program of [state.color, ...Object.values(state.extra)]) gl.deleteProgram(program.handle);
  for (const target of state.targets.values()) {
    gl.deleteTexture(target.texture);
    gl.deleteFramebuffer(target.framebuffer);
  }
  state.targets.clear();
  gl.deleteTexture(state.source);
  gl.deleteTexture(state.curves);
  gl.deleteTexture(state.lut);
  gl.deleteBuffer(state.vbo);
  gl.deleteVertexArray(state.vao);
}

const EXTRA_FRAGMENTS = { bright: BRIGHT_FRAGMENT, blur: BLUR_FRAGMENT, finish: FINISH_FRAGMENT };

function extraProgram(state: GradeRendererState, name: keyof typeof EXTRA_FRAGMENTS) {
  return (state.extra[name] ??= makeProgram(state.gl, EXTRA_FRAGMENTS[name]));
}

function renderTarget(state: GradeRendererState, name: string, width: number, height: number): RenderTarget {
  const { gl } = state;
  const existing = state.targets.get(name);
  if (existing && existing.width === width && existing.height === height) return existing;
  if (existing) {
    gl.deleteTexture(existing.texture);
    gl.deleteFramebuffer(existing.framebuffer);
  }
  // Creating a texture binds it to the active unit: keep that away from the units the shaders read.
  gl.activeTexture(gl.TEXTURE7);
  const texture = texture2d(gl);
  // Float targets keep the extra precision between passes when the GPU can render to them.
  if (state.floatTargets) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const framebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  const target = { texture, framebuffer, width, height };
  state.targets.set(name, target);
  return target;
}

function uploadCurves(state: GradeRendererState, fields: GradeFields) {
  const key = JSON.stringify(fields.curves ?? null);
  if (state.curveKey === key) return;
  const { gl } = state;
  const size = 1024;
  const r = bakeCurve(fields.curves?.r, size);
  const g = bakeCurve(fields.curves?.g, size);
  const b = bakeCurve(fields.curves?.b, size);
  const master = bakeCurve(fields.curves?.master, size);
  const data = new Float32Array(size * 4);
  for (let i = 0; i < size; i += 1) data.set([r[i], g[i], b[i], master[i]], i * 4);
  gl.bindTexture(gl.TEXTURE_2D, state.curves);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, size, 1, 0, gl.RGBA, gl.FLOAT, data);
  state.curveKey = key;
}

function uploadLut(state: GradeRendererState, lut: CubeLut, key: string) {
  if (state.lutKey === key) return;
  const { gl } = state;
  const max = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE) as number;
  if (lut.size > max) throw new Error(`This LUT (size ${lut.size}) is larger than this GPU's limit of ${max}.`);
  gl.bindTexture(gl.TEXTURE_3D, state.lut);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, lut.size, lut.size, lut.size, 0, gl.RGBA, gl.FLOAT, lut.data);
  gl.bindTexture(gl.TEXTURE_3D, null);
  state.lutKey = key;
}

function setColorUniforms(state: GradeRendererState, u: GradeUniforms, useCurves: boolean, useLut: boolean, lut: CubeLut | null, dither: boolean) {
  const { gl, color } = state;
  const at = (name: string) => uniform(gl, color, name);
  gl.uniform1i(at("uSource"), 0);
  gl.uniform1i(at("uCurves"), 1);
  gl.uniform1i(at("uLut"), 2);
  gl.uniform1f(at("uBrightness"), u.brightness);
  gl.uniform1f(at("uContrast"), u.contrast);
  gl.uniform1f(at("uPivot"), u.pivot);
  // Our rows, GL's columns.
  gl.uniformMatrix3fv(at("uMatrix"), true, u.matrix.flat());
  gl.uniform3fv(at("uGains"), u.gains);
  gl.uniform1f(at("uMatchContrast"), u.matchContrast);
  gl.uniform1f(at("uMatchSaturation"), u.matchSaturation);
  gl.uniform1f(at("uShadows"), u.shadows);
  gl.uniform1f(at("uHighlights"), u.highlights);
  gl.uniform1f(at("uWhites"), u.whites);
  gl.uniform1f(at("uBlacks"), u.blacks);
  gl.uniform1f(at("uBlackPoint"), u.blackPoint);
  gl.uniform1f(at("uWhitePoint"), u.whitePoint);
  gl.uniform1f(at("uGamma"), u.gamma);
  gl.uniform3fv(at("uLift"), u.lift);
  gl.uniform3fv(at("uWheelGamma"), u.wheelGamma);
  gl.uniform3fv(at("uGain"), u.gain);
  gl.uniform1f(at("uVibrance"), u.vibrance);
  gl.uniform1f(at("uSkinProtect"), u.skinProtect);
  gl.uniform1f(at("uLutStrength"), u.lutStrength);
  gl.uniform1i(at("uHasCurves"), useCurves ? 1 : 0);
  gl.uniform1i(at("uHasHsl"), u.hasHsl ? 1 : 0);
  gl.uniform1i(at("uHasLut"), useLut ? 1 : 0);
  gl.uniform1i(at("uDither"), dither ? 1 : 0);
  gl.uniform3fv(at("uHsl"), u.hsl);
  gl.uniform3fv(at("uDomainMin"), lut?.domainMin ?? [0, 0, 0]);
  gl.uniform3fv(at("uDomainMax"), lut?.domainMax ?? [1, 1, 1]);
}

export interface GradeDrawParams {
  fields: GradeFields;
  /** Parsed file for fields.lut, when it has loaded. */
  lut: CubeLut | null;
  /** Grain changes every frame by this number. */
  seed: number;
}

/** Draw `source` through the grade to the canvas this renderer was set up on. */
export function drawGrade(
  state: GradeRendererState,
  { source, width, height, flipSourceY, params }: { source: TexImageSource; width: number; height: number; flipSourceY: boolean; params: GradeDrawParams },
) {
  const { gl, vao } = state;
  const { fields, lut, seed } = params;
  const u = gradeUniforms(fields);
  const useCurves = hasCurves(fields);
  const useLut = Boolean(lut && fields.lut);
  const useFinish = u.halation > 0 || u.bloom > 0 || u.vignette !== 0 || u.grain > 0;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.source);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

  if (useCurves) {
    gl.activeTexture(gl.TEXTURE1);
    uploadCurves(state, fields);
    gl.bindTexture(gl.TEXTURE_2D, state.curves);
  }
  if (useLut) {
    gl.activeTexture(gl.TEXTURE2);
    uploadLut(state, lut!, fields.lut!);
    gl.bindTexture(gl.TEXTURE_3D, state.lut);
  }

  gl.bindVertexArray(vao);
  gl.disable(gl.BLEND);
  const quad = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Colour: straight to the canvas, or to a float target when the finish still has to run.
  const graded = useFinish ? renderTarget(state, "graded", width, height) : null;
  gl.bindFramebuffer(gl.FRAMEBUFFER, graded?.framebuffer ?? null);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(state.color.handle);
  setColorUniforms(state, u, useCurves, useLut, lut, !useFinish);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.source);
  quad();

  if (graded) {
    let halation: RenderTarget | null = null;
    let bloom: RenderTarget | null = null;
    if (u.halation > 0 || u.bloom > 0) {
      const small = (name: string, divisor: number) =>
        renderTarget(state, name, Math.max(2, Math.round(width / divisor)), Math.max(2, Math.round(height / divisor)));
      const run = (program: Program, input: WebGLTexture, output: RenderTarget, step?: [number, number]) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, output.framebuffer);
        gl.viewport(0, 0, output.width, output.height);
        gl.useProgram(program.handle);
        gl.uniform1i(uniform(gl, program, "uSource"), 0);
        if (step) gl.uniform2f(uniform(gl, program, "uStep"), step[0], step[1]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, input);
        quad();
      };
      // Radii are fractions of the frame's height, so a 4K source and its preview look the same.
      const aspect = height / width;
      const bright = small("bright", 4);
      const blur = extraProgram(state, "blur");
      run(extraProgram(state, "bright"), graded.texture, bright);
      const halationH = small("halation-h", 4);
      halation = small("halation", 4);
      run(blur, bright.texture, halationH, [0.0022 * aspect, 0]);
      run(blur, halationH.texture, halation, [0, 0.0022]);
      if (u.bloom > 0) {
        const bloomH = small("bloom-h", 8);
        bloom = small("bloom", 8);
        run(blur, halation.texture, bloomH, [0.008 * aspect, 0]);
        run(blur, bloomH.texture, bloom, [0, 0.008]);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const finish = extraProgram(state, "finish");
    gl.useProgram(finish.handle);
    const at = (name: string) => uniform(gl, finish, name);
    gl.uniform1i(at("uSource"), 0);
    gl.uniform1i(at("uHalationTexture"), 3);
    gl.uniform1i(at("uBloomTexture"), 4);
    gl.uniform1f(at("uHalation"), u.halation);
    gl.uniform1f(at("uBloom"), u.bloom);
    gl.uniform1f(at("uVignette"), u.vignette);
    gl.uniform1f(at("uGrain"), u.grain);
    // Grain is sized against 1080p, so it stays visible once a 4K frame is scaled down.
    gl.uniform1f(at("uGrainCell"), Math.max(1, (u.grainSize * height) / 1080));
    gl.uniform1f(at("uSeed"), seed % 1024);
    gl.uniform1f(at("uAspect"), width / height);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, halation?.texture ?? graded.texture);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, bloom?.texture ?? graded.texture);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, graded.texture);
    quad();
  }

  gl.bindVertexArray(null);
  gl.useProgram(null);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

const gradePass = createEffect<GradeDrawParams, GradeRendererState>({
  type: "agentcut/grade",
  label: "grade()",
  documentationLink: null,
  backend: "webgl2",
  calculateKey: ({ fields, lut, seed }) =>
    JSON.stringify([fields, lut ? lut.size : 0, fields.grain ? seed : 0]),
  setup: (target) => setupGradeRenderer(target),
  apply: ({ source, width, height, state, params, flipSourceY }) =>
    drawGrade(state, { source: source as TexImageSource, width, height, flipSourceY, params }),
  cleanup: cleanupGradeRenderer,
  schema: {},
  validateParams: () => {},
});

export interface GradeEffectOptions {
  /** Clip-local frame, for keys. */
  frame: number;
  /** Absolute frame, for grain. */
  seed: number;
  /** Loaded .cube files by project path. */
  luts?: ReadonlyMap<string, CubeLut>;
}

/** The effects that draw `grades`, first to last (a clip's own grade, then what sits on top of it). */
export function gradeEffects(grades: { grade: ColorGrade; frame: number; strength?: number }[], { seed, luts }: Omit<GradeEffectOptions, "frame">): EffectDescriptor<unknown>[] {
  const effects: EffectDescriptor<unknown>[] = [];
  for (const { grade, frame, strength } of grades) {
    if (strength !== undefined && strength <= 0) continue;
    for (const pass of gradePasses(grade, frame, gradeLook)) {
      const fields = strength === undefined ? pass : scaleGrade(pass, strength);
      const lut = fields.lut ? luts?.get(fields.lut) ?? null : null;
      effects.push(gradePass({ fields, lut, seed }));
    }
  }
  return effects;
}

/** The .cube files a grade needs, including ones only its keys use. */
export function gradeLutPaths(grade: ColorGrade | undefined | null): string[] {
  if (!grade) return [];
  const paths = new Set<string>();
  if (grade.lut) paths.add(grade.lut);
  for (const key of grade.keys ?? []) if (key.lut) paths.add(key.lut);
  return [...paths];
}

let warmed = false;

/**
 * Compile the shaders in the background once, so the browser has them cached before the first slider
 * moves. Without this, the first grade on a clip stalls the page while they compile.
 */
export function warmGradeShaders() {
  if (warmed || typeof document === "undefined") return;
  warmed = true;
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) return;
  const parallel = gl.getExtension("KHR_parallel_shader_compile") as { COMPLETION_STATUS_KHR: number } | null;
  const handles = [COLOR_FRAGMENT, BRIGHT_FRAGMENT, BLUR_FRAGMENT, FINISH_FRAGMENT].map((fragment) => {
    const handle = gl.createProgram()!;
    for (const [type, text] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      gl.attachShader(handle, shader);
    }
    gl.linkProgram(handle);
    return handle;
  });
  // Without the extension the driver still finishes on its own; just give it time before letting go.
  const release = () => gl.getExtension("WEBGL_lose_context")?.loseContext();
  if (!parallel) {
    window.setTimeout(release, 5000);
    return;
  }
  const poll = () => {
    if (handles.every((handle) => gl.getProgramParameter(handle, parallel.COMPLETION_STATUS_KHR))) release();
    else window.setTimeout(poll, 50);
  };
  poll();
}

let webgl2Available: boolean | null = null;
/** Pages and machines without WebGL2 keep the CSS part of a grade. */
export function canDrawGrade(): boolean {
  if (webgl2Available !== null) return webgl2Available;
  try {
    webgl2Available = typeof document !== "undefined" && Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    webgl2Available = false;
  }
  return webgl2Available;
}
