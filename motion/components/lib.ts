// Small helpers shared by the components. Components import only react, remotion and this file,
// so they bundle the same way in the gallery, the studio preview, the browser export and a local render.
import { useEffect, useState } from "react";
import { Easing, interpolate, spring, useDelayRender } from "remotion";

/** Scale for the frame size: 1 at 1080 px on the short side. */
export const unit = (width: number, height: number) => Math.min(width, height) / 1080;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 0→1 over `frames` starting at `start`, eased. */
export function ramp(frame: number, start: number, frames: number, easing = Easing.bezier(0.22, 1, 0.36, 1)) {
  return interpolate(frame, [start, start + Math.max(1, frames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

/** A soft spring for entrances (no overshoot past ~4%). */
export function pop(frame: number, fps: number, delay = 0, stiffness = 170) {
  return spring({ frame: frame - delay, fps, config: { damping: 18, stiffness, mass: 0.9 } });
}

/** 1 while on screen, easing to 0 over the last `frames` of the clip (the shared exit). */
export function exitOut(frame: number, durationInFrames: number, frames = 12) {
  return 1 - ramp(frame, durationInFrames - frames, frames, Easing.bezier(0.55, 0, 0.75, 0.25));
}

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Split "Make videos with *Claude*" into words, marking *starred* ones as highlighted. */
export function splitHighlights(line: string) {
  return line
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const highlighted = /^\*.*\*[.,!?:;]*$/.test(word);
      return { text: highlighted ? word.replace(/\*/g, "") : word, highlighted };
    });
}

export const FONTS: Record<string, string> = {
  sans: 'Inter, "Geist", "Segoe UI", system-ui, -apple-system, sans-serif',
  display: '"Bricolage Grotesque", "Geist", Inter, system-ui, sans-serif',
  serif: '"Instrument Serif", Georgia, "Times New Roman", serif',
  mono: '"Geist Mono", "JetBrains Mono", ui-monospace, Menlo, monospace',
  grotesk: '"Space Grotesk", Inter, system-ui, sans-serif',
  syne: 'Syne, "Bricolage Grotesque", Inter, system-ui, sans-serif',
  fraunces: 'Fraunces, "Instrument Serif", Georgia, serif',
  wide: 'Unbounded, "Bricolage Grotesque", Inter, system-ui, sans-serif',
  condensed: 'Anton, "Bebas Neue", Impact, "Arial Narrow", sans-serif',
  archivo: '"Archivo Black", "Arial Black", Inter, system-ui, sans-serif',
  caveat: 'Caveat, "Segoe Print", "Comic Sans MS", cursive',
  pixel: 'VT323, "Geist Mono", ui-monospace, monospace',
  tech: 'Orbitron, Unbounded, "Space Grotesk", system-ui, sans-serif',
  heavy: 'Montserrat, "Arial Black", Inter, system-ui, sans-serif',
  retro: 'Bungee, "Arial Black", Impact, system-ui, sans-serif',
};

// Every family in FONTS, from Google Fonts (variable axes where the family has them).
const FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400..900&family=Bricolage+Grotesque:opsz,wght@12..96,400..800" +
  "&family=Instrument+Serif:ital@0;1&family=Geist+Mono:wght@400..700&family=Space+Grotesk:wght@400..700" +
  "&family=Syne:wght@400..800&family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900" +
  "&family=Unbounded:wght@400..900&family=Anton&family=Archivo+Black&family=Caveat:wght@400..700&family=VT323&family=Orbitron:wght@400..900&family=Montserrat:wght@500..900&family=Bungee" +
  "&display=block";
const FONT_FACES = [
  "700 40px Inter",
  '700 40px "Bricolage Grotesque"',
  '400 40px "Instrument Serif"',
  'italic 400 40px "Instrument Serif"',
  '500 40px "Geist Mono"',
  '700 40px "Space Grotesk"',
  "700 40px Syne",
  "500 40px Fraunces",
  "italic 500 40px Fraunces",
  "700 40px Unbounded",
  "400 40px Anton",
  '400 40px "Archivo Black"',
  "700 40px Caveat",
  "400 40px VT323",
  "800 40px Orbitron",
  "900 40px Montserrat",
  "400 40px Bungee",
];

let fontsLoaded = false;
let fontsLoading: Promise<void> | undefined;

/** Loads the library's fonts once per page (resolves even if the network fails: text falls back). */
export function loadMotionFonts() {
  if (typeof document === "undefined") return Promise.resolve();
  fontsLoading ??= new Promise<void>((resolve) => {
    const done = () => {
      fontsLoaded = true;
      resolve();
    };
    const timeout = setTimeout(done, 10000);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS_CSS;
    link.onload = () => {
      Promise.allSettled(FONT_FACES.map((face) => document.fonts.load(face))).then(() => {
        clearTimeout(timeout);
        done();
      });
    };
    link.onerror = () => {
      clearTimeout(timeout);
      done();
    };
    document.head.appendChild(link);
  });
  return fontsLoading;
}

/** Holds the render (export, still, local render) until the fonts are in, so frame 0 has the right type. */
export function useMotionFonts() {
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => (fontsLoaded ? null : delayRender("Loading motion component fonts")));
  useEffect(() => {
    if (handle === null) return;
    loadMotionFonts().then(() => continueRender(handle));
  }, [handle, continueRender]);
}

/** The `background` prop as a CSS value ("transparent" keeps an overlay see-through). */
export const fill = (background: string) => (background === "transparent" ? undefined : background);

/**
 * Blur that the browser export draws cleanly: it clips a filtered element to its own box, so the
 * box gets padding for the blur's spread (and a matching negative margin, so layout doesn't move).
 */
export function blurStyle(px: number) {
  if (px < 0.3) return {};
  const pad = Math.ceil(px * 2.5);
  return { filter: `blur(${px.toFixed(2)}px)`, padding: pad, margin: -pad };
}

/**
 * A hex color at an alpha, as rgba(). Fade gradients to the color at alpha 0 rather than to
 * "transparent" (transparent black), which greys the falloff in the browser export.
 */
export function alpha(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return a <= 0 ? "transparent" : hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * A soft radial glow centered at (x, y) px. The browser export only draws centered, unsized radial
 * gradients, so the glow is a box of the glow's size with a plain radial-gradient inside.
 */
export function glowStyle(x: number, y: number, w: number, h: number, color: string, opacity = 1, reach = 0.7) {
  return {
    position: "absolute",
    left: x - w / 2,
    top: y - h / 2,
    width: w,
    height: h,
    background: `radial-gradient(${color} 0%, ${alpha(color, 0)} ${Math.round(reach * 100)}%)`,
    opacity,
  } as const;
}

/** Out-expo: fast start, long soft landing (the "premium" ease). */
export const easeOutExpo = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Readable text on a color: near-black or white. */
export function onColor(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#0b0d10" : "#ffffff";
}
