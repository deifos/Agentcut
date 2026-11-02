// A RAM preview for scenes too heavy to draw during a drag: small pictures of the finished composition,
// rendered one at a time while the preview sits idle, and shown over the player while dragging. Letting
// go always draws the real frame. Only clips measured as slow to scrub get any, and exports never see this.
import { variantSize } from "@/lib/studio/composition-props";
import { queueStill } from "@/lib/studio/scene-stills";
import { MAX_PICTURES, warmOrder, type ScrubFrames } from "@/lib/studio/scrub";
import type { LoadedModule, StudioCompositionProps } from "@/lib/studio/types";

const PICTURE_HEIGHT = 480;
const PICTURES_PER_SECOND = 8;

const nextIdle = () =>
  new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolve(), { timeout: 500 });
    else setTimeout(resolve, 50);
  });

export class ScrubFrameCache implements ScrubFrames {
  private readonly pictures = new Map<number, ImageBitmap>();
  private canvas: HTMLCanvasElement | null = null;
  private step = 1;

  attach(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
  }

  get size() {
    return this.pictures.size;
  }

  show(frame: number) {
    const canvas = this.canvas;
    if (!canvas) return false;
    let picture: ImageBitmap | undefined;
    for (let offset = 0; offset < this.step && !picture; offset += 1) {
      picture = this.pictures.get(frame - offset) ?? this.pictures.get(frame + offset);
    }
    if (!picture) return false;
    if (canvas.width !== picture.width) canvas.width = picture.width;
    if (canvas.height !== picture.height) canvas.height = picture.height;
    canvas.getContext("2d")?.drawImage(picture, 0, 0);
    canvas.style.visibility = "visible";
    return true;
  }

  hide() {
    if (this.canvas) this.canvas.style.visibility = "hidden";
  }

  clear() {
    this.hide();
    for (const picture of this.pictures.values()) picture.close();
    this.pictures.clear();
  }

  /** Fill in pictures for `from..to`, nearest to `around` first, until `signal` aborts. */
  async warm(
    loaded: LoadedModule,
    props: StudioCompositionProps,
    range: { around: number; from: number; to: number },
    signal: AbortSignal,
    busy: () => boolean,
  ) {
    const step = Math.max(1, Math.round(props.project.fps / PICTURES_PER_SECOND));
    this.step = step;
    const size = variantSize(props.project, props.variant);
    const { renderStillOnWeb } = await import("@remotion/web-renderer");
    for (const frame of warmOrder(range.around, range.from, range.to, step)) {
      if (this.pictures.has(frame)) continue;
      if (this.pictures.size >= MAX_PICTURES) return;
      await nextIdle();
      if (signal.aborted || busy()) return;
      const picture = await queueStill(async () => {
        if (signal.aborted) return null;
        const result = await renderStillOnWeb({
          composition: {
            component: loaded.module.StudioComposition,
            id: "scrub-picture",
            ...size,
            fps: props.project.fps,
            durationInFrames: props.project.durationInFrames,
            defaultProps: props,
          },
          inputProps: props,
          frame,
          signal,
          scale: Math.min(1, PICTURE_HEIGHT / size.height),
          licenseKey: "free-license",
          delayRenderTimeoutInMilliseconds: 10_000,
        });
        return createImageBitmap(await result.blob({ format: "jpeg", quality: 0.8 }));
      }).catch(() => null);
      // A frame that can't be rendered here is drawn the normal way; stop rather than retry each one.
      if (!picture) return;
      if (signal.aborted) {
        picture.close();
        return;
      }
      this.pictures.set(frame, picture);
    }
  }
}
