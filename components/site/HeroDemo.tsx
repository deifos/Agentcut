"use client";

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The studio's Simple view, recorded playing a real project. Loops silently; with reduced motion
 *  it waits on its poster and shows controls instead. */
export function HeroDemo() {
  return (
    <div className="landing-demo">
      <video
        ref={(video) => {
          if (!video) return;
          if (reducedMotion()) {
            video.controls = true;
            return;
          }
          video.play().catch(() => {
            video.controls = true;
          });
        }}
        src="/landing/studio-demo.mp4"
        poster="/landing/studio-demo.jpg"
        width={1920}
        height={1200}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="The Agentcut studio in Simple view: a chat on the left, a road trip montage with a title and captions playing on the right"
      />
    </div>
  );
}
