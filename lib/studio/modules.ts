// Packages the page provides to project bundles. One copy of React and
// Remotion on the page; bundles mark these as external.
// Must match packages/agentcut/src/studio/bundler.ts (SHARED_MODULES).
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as JsxRuntime from "react/jsx-runtime";
import * as JsxDevRuntime from "react/jsx-dev-runtime";
import * as Remotion from "remotion";
import * as RemotionMedia from "@remotion/media";
import * as Transitions from "@remotion/transitions";
import * as BlurSlide from "@remotion/transitions/blur-slide";
import * as BookFlip from "@remotion/transitions/book-flip";
import * as ClockWipe from "@remotion/transitions/clock-wipe";
import * as CrossZoom from "@remotion/transitions/cross-zoom";
import * as Crosswarp from "@remotion/transitions/crosswarp";
import * as Dissolve from "@remotion/transitions/dissolve";
import * as DreamyZoom from "@remotion/transitions/dreamy-zoom";
import * as Fade from "@remotion/transitions/fade";
import * as FilmBurn from "@remotion/transitions/film-burn";
import * as Flip from "@remotion/transitions/flip";
import * as Iris from "@remotion/transitions/iris";
import * as LinearBlur from "@remotion/transitions/linear-blur";
import * as NoneTransition from "@remotion/transitions/none";
import * as PushCut from "@remotion/transitions/push-cut";
import * as Ripple from "@remotion/transitions/ripple";
import * as Slide from "@remotion/transitions/slide";
import * as Swap from "@remotion/transitions/swap";
import * as Wipe from "@remotion/transitions/wipe";
import * as ZoomBlur from "@remotion/transitions/zoom-blur";
import * as ZoomInOut from "@remotion/transitions/zoom-in-out";
import * as Shapes from "@remotion/shapes";
import * as Paths from "@remotion/paths";
import * as Noise from "@remotion/noise";
import * as MotionComponents from "@/motion/components";

export const STUDIO_SHARED_MODULES: Record<string, unknown> = {
  react: React,
  "react-dom": ReactDOM,
  "react/jsx-runtime": JsxRuntime,
  "react/jsx-dev-runtime": JsxDevRuntime,
  remotion: Remotion,
  "@remotion/media": RemotionMedia,
  "@remotion/transitions": Transitions,
  "@remotion/transitions/blur-slide": BlurSlide,
  "@remotion/transitions/book-flip": BookFlip,
  "@remotion/transitions/clock-wipe": ClockWipe,
  "@remotion/transitions/cross-zoom": CrossZoom,
  "@remotion/transitions/crosswarp": Crosswarp,
  "@remotion/transitions/dissolve": Dissolve,
  "@remotion/transitions/dreamy-zoom": DreamyZoom,
  "@remotion/transitions/fade": Fade,
  "@remotion/transitions/film-burn": FilmBurn,
  "@remotion/transitions/flip": Flip,
  "@remotion/transitions/iris": Iris,
  "@remotion/transitions/linear-blur": LinearBlur,
  "@remotion/transitions/none": NoneTransition,
  "@remotion/transitions/push-cut": PushCut,
  "@remotion/transitions/ripple": Ripple,
  "@remotion/transitions/slide": Slide,
  "@remotion/transitions/swap": Swap,
  "@remotion/transitions/wipe": Wipe,
  "@remotion/transitions/zoom-blur": ZoomBlur,
  "@remotion/transitions/zoom-in-out": ZoomInOut,
  "@remotion/shapes": Shapes,
  "@remotion/paths": Paths,
  "@remotion/noise": Noise,
  // The Agentcut component library (motion/components): new components ship with the site.
  "agentcut/components": MotionComponents,
};
