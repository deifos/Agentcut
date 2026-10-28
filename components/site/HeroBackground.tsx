import Image from "next/image";
import { preload } from "react-dom";

const RIBBONS = "/hero/motion-ribbons-sharp.webp";

/** Motion-design posters leave a clear paper surface behind the headline. */
export function HeroBackground() {
  // The paper strip's CSS background is the page's largest paint: fetch it with the HTML instead
  // of after the stylesheet.
  preload(RIBBONS, { as: "image", fetchPriority: "high" });
  return (
    <div aria-hidden="true" className="hero-collage">
      <div className="hero-brush hero-brush-top" />
      <div className="hero-paper-strip" />
      <div className="hero-photo hero-photo-top">
        <Image
          src="/hero/kinetic-type.webp"
          alt=""
          fill
          sizes="420px"
          className="object-cover"
        />
      </div>
      <div className="hero-photo hero-photo-bottom">
        <Image
          src={RIBBONS}
          alt=""
          fill
          sizes="500px"
          unoptimized
          className="object-cover"
        />
      </div>
      <div className="hero-brush hero-brush-bottom" />
    </div>
  );
}
