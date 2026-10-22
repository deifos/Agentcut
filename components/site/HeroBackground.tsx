import Image from "next/image";

/** Motion-design posters leave a clear paper surface behind the headline. */
export function HeroBackground() {
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
          src="/hero/motion-ribbons-sharp.webp"
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
