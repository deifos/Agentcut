// The registry. Add a component: create its folder (Component.tsx + meta.json), add its meta to
// catalog.ts and its component to COMPONENTS below. The studio preview, the browser export, the
// gallery, the inspector form and Claude's catalog all read from here.
import { createElement, type ComponentType } from "react";
import type { MotionBaseProps, MotionComponent, PropValues } from "./types";

import { COMPONENT_METAS } from "./catalog";
import { useMotionFonts } from "./lib";
import { LightLeakTransition } from "./light-leak/LightLeakTransition";
import { LowerThird } from "./lower-third/LowerThird";
import { PromptBox } from "./prompt-box/PromptBox";
import { SlideZoomMessage } from "./slide-zoom-message/SlideZoomMessage";
import { StatCounter } from "./stat-counter/StatCounter";
import { TextReveal } from "./text-reveal/TextReveal";
import { BlurInTitle } from "./blur-in-title/BlurInTitle";
import { LetterCascade } from "./letter-cascade/LetterCascade";
import { Typewriter } from "./typewriter/Typewriter";
import { WordSwap } from "./word-swap/WordSwap";
import { BarWipeTitle } from "./bar-wipe-title/BarWipeTitle";
import { KineticPunch } from "./kinetic-punch/KineticPunch";
import { DecodeText } from "./decode-text/DecodeText";
import { OutlineFill } from "./outline-fill/OutlineFill";
import { EditorialQuote } from "./editorial-quote/EditorialQuote";
import { Highlighter } from "./highlighter/Highlighter";
import { LogoSting } from "./logo-sting/LogoSting";
import { Marquee } from "./marquee/Marquee";
import { Aurora } from "./aurora/Aurora";
import { LavaLamp } from "./lava-lamp/LavaLamp";
import { SpotlightGrid } from "./spotlight-grid/SpotlightGrid";
import { IrisWipe } from "./iris-wipe/IrisWipe";
import { PanelSweep } from "./panel-sweep/PanelSweep";
import { TileWipe } from "./tile-wipe/TileWipe";
import { Notification } from "./notification/Notification";
import { ChatThread } from "./chat-thread/ChatThread";
import { StickerSlam } from "./sticker-slam/StickerSlam";
import { GlitchTitle } from "./glitch-title/GlitchTitle";
import { SplitFlap } from "./split-flap/SplitFlap";
import { Countdown } from "./countdown/Countdown";
import { WordStack } from "./word-stack/WordStack";
import { TypeZoom } from "./type-zoom/TypeZoom";
import { HalftoneWave } from "./halftone-wave/HalftoneWave";
import { BentoGrid } from "./bento-grid/BentoGrid";
import { SocialPost } from "./social-post/SocialPost";
import { Checklist } from "./checklist/Checklist";
import { Confetti } from "./confetti/Confetti";
import { KineticPoster } from "./kinetic-poster/KineticPoster";
import { ArcadeTitle } from "./arcade-title/ArcadeTitle";
import { CutAndPaste } from "./cut-and-paste/CutAndPaste";
import { TargetLock } from "./target-lock/TargetLock";
import { ShapeShift } from "./shape-shift/ShapeShift";
import { HookCard } from "./hook-card/HookCard";
import { WordPop } from "./word-pop/WordPop";
import { StickerBadge } from "./sticker-badge/StickerBadge";
import { ListCard } from "./list-card/ListCard";
import { QuoteCard } from "./quote-card/QuoteCard";
import { BeforeAfter } from "./before-after/BeforeAfter";
import { LineDiagram } from "./line-diagram/LineDiagram";

type AnyComponent = ComponentType<MotionBaseProps & PropValues>;
const COMPONENTS: Record<string, unknown> = {
  "text-reveal": TextReveal,
  "slide-zoom-message": SlideZoomMessage,
  "lower-third": LowerThird,
  "stat-counter": StatCounter,
  "prompt-box": PromptBox,
  "light-leak": LightLeakTransition,
  "blur-in-title": BlurInTitle,
  "letter-cascade": LetterCascade,
  "typewriter": Typewriter,
  "word-swap": WordSwap,
  "bar-wipe-title": BarWipeTitle,
  "kinetic-punch": KineticPunch,
  "decode-text": DecodeText,
  "outline-fill": OutlineFill,
  "editorial-quote": EditorialQuote,
  "highlighter": Highlighter,
  "logo-sting": LogoSting,
  "marquee": Marquee,
  "aurora": Aurora,
  "lava-lamp": LavaLamp,
  "spotlight-grid": SpotlightGrid,
  "iris-wipe": IrisWipe,
  "panel-sweep": PanelSweep,
  "tile-wipe": TileWipe,
  "notification": Notification,
  "chat-thread": ChatThread,
  "sticker-slam": StickerSlam,
  "glitch-title": GlitchTitle,
  "split-flap": SplitFlap,
  "countdown": Countdown,
  "word-stack": WordStack,
  "type-zoom": TypeZoom,
  "halftone-wave": HalftoneWave,
  "bento-grid": BentoGrid,
  "social-post": SocialPost,
  "checklist": Checklist,
  "confetti": Confetti,
  "kinetic-poster": KineticPoster,
  "arcade-title": ArcadeTitle,
  "cut-and-paste": CutAndPaste,
  "target-lock": TargetLock,
  "shape-shift": ShapeShift,
  "hook-card": HookCard,
  "word-pop": WordPop,
  "sticker-badge": StickerBadge,
  "list-card": ListCard,
  "quote-card": QuoteCard,
  "before-after": BeforeAfter,
  "line-diagram": LineDiagram,
};

/** Every component waits for the library's fonts, so previews, stills and exports never use a fallback. */
function withFonts(Component: AnyComponent, name: string): AnyComponent {
  function WithFonts(props: MotionBaseProps & PropValues) {
    useMotionFonts();
    return createElement(Component, props);
  }
  WithFonts.displayName = `WithFonts(${name})`;
  return WithFonts;
}

export const MOTION_COMPONENTS: Record<string, MotionComponent> = Object.fromEntries(
  Object.entries(COMPONENT_METAS).map(([id, meta]) => [
    id,
    { meta, Component: withFonts(COMPONENTS[id] as AnyComponent, meta.name) },
  ]),
);

export const COMPONENT_CATEGORIES = [
  "Talking Head",
  "Text & Titles",
  "Overlays",
  "Charts & Stats",
  "AI & Product",
  "Backgrounds",
  "Transitions",
] as const;

export { checkComponentProps, resolveComponentProps, styledPropKeys } from "./props";
export { getMotionStyle, MOTION_STYLES, STYLE_TOKENS } from "./styles";
export type { MotionStyle, StyleToken } from "./styles";
// The runtime calls this when a project has a style, so caption and text clips get the style's fonts.
export { loadMotionFonts, useMotionFonts } from "./lib";
// Called by the studio runtime for a project with a style: camera on footage, texture, captions.
export { StyleOverlay, StyledCaptions, styleCamera, styleLookProps } from "./style-layer";
export { hookSpeakerBox, type SpeakerBox } from "./hook-card/HookCard";

export { COMPONENT_METAS } from "./catalog";
export type { ComponentMeta, MotionBaseProps, MotionComponent, PropSpec, PropValues } from "./types";
