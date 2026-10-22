// Metadata only (no React, no Remotion): safe for server components, the sitemap and metadata.
import type { ComponentMeta } from "./types";
import lightLeak from "./light-leak/meta.json";
import lowerThird from "./lower-third/meta.json";
import promptBox from "./prompt-box/meta.json";
import slideZoomMessage from "./slide-zoom-message/meta.json";
import statCounter from "./stat-counter/meta.json";
import textReveal from "./text-reveal/meta.json";
import blurInTitle from "./blur-in-title/meta.json";
import letterCascade from "./letter-cascade/meta.json";
import typewriter from "./typewriter/meta.json";
import wordSwap from "./word-swap/meta.json";
import barWipeTitle from "./bar-wipe-title/meta.json";
import kineticPunch from "./kinetic-punch/meta.json";
import decodeText from "./decode-text/meta.json";
import outlineFill from "./outline-fill/meta.json";
import editorialQuote from "./editorial-quote/meta.json";
import highlighter from "./highlighter/meta.json";
import logoSting from "./logo-sting/meta.json";
import marquee from "./marquee/meta.json";
import aurora from "./aurora/meta.json";
import lavaLamp from "./lava-lamp/meta.json";
import spotlightGrid from "./spotlight-grid/meta.json";
import irisWipe from "./iris-wipe/meta.json";
import panelSweep from "./panel-sweep/meta.json";
import tileWipe from "./tile-wipe/meta.json";
import notification from "./notification/meta.json";
import chatThread from "./chat-thread/meta.json";
import stickerSlam from "./sticker-slam/meta.json";
import glitchTitle from "./glitch-title/meta.json";
import splitFlap from "./split-flap/meta.json";
import countdown from "./countdown/meta.json";
import wordStack from "./word-stack/meta.json";
import typeZoom from "./type-zoom/meta.json";
import halftoneWave from "./halftone-wave/meta.json";
import bentoGrid from "./bento-grid/meta.json";
import socialPost from "./social-post/meta.json";
import checklist from "./checklist/meta.json";
import confetti from "./confetti/meta.json";
import kineticPoster from "./kinetic-poster/meta.json";
import arcadeTitle from "./arcade-title/meta.json";
import cutAndPaste from "./cut-and-paste/meta.json";
import targetLock from "./target-lock/meta.json";
import shapeShift from "./shape-shift/meta.json";
import hookCard from "./hook-card/meta.json";
import wordPop from "./word-pop/meta.json";
import stickerBadge from "./sticker-badge/meta.json";
import listCard from "./list-card/meta.json";
import quoteCard from "./quote-card/meta.json";
import beforeAfter from "./before-after/meta.json";
import lineDiagram from "./line-diagram/meta.json";

export const COMPONENT_METAS: Record<string, ComponentMeta> = {
  "text-reveal": textReveal as unknown as ComponentMeta,
  "slide-zoom-message": slideZoomMessage as unknown as ComponentMeta,
  "lower-third": lowerThird as unknown as ComponentMeta,
  "stat-counter": statCounter as unknown as ComponentMeta,
  "prompt-box": promptBox as unknown as ComponentMeta,
  "light-leak": lightLeak as unknown as ComponentMeta,
  "blur-in-title": blurInTitle as unknown as ComponentMeta,
  "letter-cascade": letterCascade as unknown as ComponentMeta,
  "typewriter": typewriter as unknown as ComponentMeta,
  "word-swap": wordSwap as unknown as ComponentMeta,
  "bar-wipe-title": barWipeTitle as unknown as ComponentMeta,
  "kinetic-punch": kineticPunch as unknown as ComponentMeta,
  "decode-text": decodeText as unknown as ComponentMeta,
  "outline-fill": outlineFill as unknown as ComponentMeta,
  "editorial-quote": editorialQuote as unknown as ComponentMeta,
  "highlighter": highlighter as unknown as ComponentMeta,
  "logo-sting": logoSting as unknown as ComponentMeta,
  "marquee": marquee as unknown as ComponentMeta,
  "aurora": aurora as unknown as ComponentMeta,
  "lava-lamp": lavaLamp as unknown as ComponentMeta,
  "spotlight-grid": spotlightGrid as unknown as ComponentMeta,
  "iris-wipe": irisWipe as unknown as ComponentMeta,
  "panel-sweep": panelSweep as unknown as ComponentMeta,
  "tile-wipe": tileWipe as unknown as ComponentMeta,
  "notification": notification as unknown as ComponentMeta,
  "chat-thread": chatThread as unknown as ComponentMeta,
  "sticker-slam": stickerSlam as unknown as ComponentMeta,
  "glitch-title": glitchTitle as unknown as ComponentMeta,
  "split-flap": splitFlap as unknown as ComponentMeta,
  "countdown": countdown as unknown as ComponentMeta,
  "word-stack": wordStack as unknown as ComponentMeta,
  "type-zoom": typeZoom as unknown as ComponentMeta,
  "halftone-wave": halftoneWave as unknown as ComponentMeta,
  "bento-grid": bentoGrid as unknown as ComponentMeta,
  "social-post": socialPost as unknown as ComponentMeta,
  "checklist": checklist as unknown as ComponentMeta,
  "confetti": confetti as unknown as ComponentMeta,
  "kinetic-poster": kineticPoster as unknown as ComponentMeta,
  "arcade-title": arcadeTitle as unknown as ComponentMeta,
  "cut-and-paste": cutAndPaste as unknown as ComponentMeta,
  "target-lock": targetLock as unknown as ComponentMeta,
  "shape-shift": shapeShift as unknown as ComponentMeta,
  "hook-card": hookCard as unknown as ComponentMeta,
  "word-pop": wordPop as unknown as ComponentMeta,
  "sticker-badge": stickerBadge as unknown as ComponentMeta,
  "list-card": listCard as unknown as ComponentMeta,
  "quote-card": quoteCard as unknown as ComponentMeta,
  "before-after": beforeAfter as unknown as ComponentMeta,
  "line-diagram": lineDiagram as unknown as ComponentMeta,
};
