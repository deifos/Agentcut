import { FilePlus2 } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";

/** A quiet invitation to turn an idea into a video. All artwork is decorative. */
export function CreativeStart({ onNew }: { onNew(): void }) {
  return <div className="creative-start flex h-full flex-col items-center justify-center gap-4 px-5 text-center">
    <CreativeIdeas />
    <div className="flex flex-col gap-2">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">A little idea. A whole new video.</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">Start with a thought, a product, or a moment you captured.<br className="hidden sm:block" /> Give it a place to become something.</p>
    </div>
    <Button onClick={onNew} className="mt-2 gap-2"><FilePlus2 /> New project</Button>
  </div>;
}

export function CreativeIdeas({ scene = false }: { scene?: boolean }) {
  const artId = useId().replaceAll(":", "");
  return (
    <svg className={scene ? "creative-box creative-box-scene" : "creative-box"} viewBox="0 0 360 260" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${artId}-wing`} x1="-26" y1="-24" x2="22" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE0A8" /><stop offset=".45" stopColor="#DE8D5C" /><stop offset="1" stopColor="#803E2C" />
        </linearGradient>
        <radialGradient id={`${artId}-planet`} cx=".28" cy=".22" r=".85">
          <stop stopColor="#FFE9BC" /><stop offset=".45" stopColor="#DFA06A" /><stop offset="1" stopColor="#633229" />
        </radialGradient>
        <linearGradient id={`${artId}-ring`} x1="-16" y1="0" x2="16" y2="3" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A65B3D" /><stop offset=".5" stopColor="#FFE1AE" /><stop offset="1" stopColor="#D99666" />
        </linearGradient>
        <linearGradient id={`${artId}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FFE4B5" /><stop offset=".45" stopColor="#D99A64" /><stop offset="1" stopColor="#84503A" />
        </linearGradient>
        <linearGradient id={`${artId}-box`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#563225" /><stop offset="1" stopColor="#1B120E" />
        </linearGradient>
      </defs>
      <ellipse cx="180" cy="227" rx="86" ry="9" fill="currentColor" opacity=".035" />
      <circle cx="180" cy="133" r="96" stroke="currentColor" strokeDasharray="2 10" opacity=".09" />
      <ellipse cx="180" cy="133" rx="130" ry="54" transform="rotate(-24 180 133)" stroke="currentColor" opacity=".07" />
      {scene ? <g className="creative-orbit" stroke="var(--brand)" strokeWidth=".6" opacity=".45">
        <ellipse cx="180" cy="120" rx="147" ry="80" transform="rotate(18 180 120)" strokeDasharray="1 9" />
        <circle cx="38" cy="95" r="2" fill="var(--brand)" />
        <circle cx="310" cy="156" r="2.5" fill="currentColor" />
      </g> : null}
      <path d="m124 159 56-27 56 27-56 29-56-29Z" fill="#120C09" stroke="#D99A64" strokeOpacity=".65" />
      <g transform={scene ? "translate(0 16)" : undefined}><g className="creative-idea creative-bulb">
        <path d="M168 73a12 12 0 1 1 24 0c0 7-7 10-7 16h-10c0-6-7-9-7-16Z" fill={`url(#${artId}-planet)`} stroke="#F3C18C" strokeWidth=".7" />
        <path d="M176 91h8m-8 3h8m-6 3h4m-2-8V77m-4-4 4 4 4-4" stroke="#FFE1AD" strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M180 55v-5m-18 13-4-2m40 2 4-2" stroke="#F3C18C" strokeWidth=".8" strokeLinecap="round" />
      </g></g>
      <g transform="translate(111 106) rotate(-18)">
        <g className="creative-idea creative-butterfly" stroke="#F3C18C" strokeWidth=".65" strokeLinecap="round" strokeLinejoin="round">
          <path d="M-1 5C-10-15-28-24-26-9-25 3-14 8-1 8ZM1 5C10-15 28-24 26-9 25 3 14 8 1 8ZM-1 8C-15 3-23 18-13 23-5 26-2 16-1 8ZM1 8C15 3 23 18 13 23 5 26 2 16 1 8Z" fill={`url(#${artId}-wing)`} />
          <path d="M-3 5Q-13-6-21-10M3 5Q13-6 21-10M-3 10-12 19M3 10 12 19" stroke="#FFE8C4" strokeOpacity=".45" strokeWidth=".55" />
          <path d="M0 2C-2 5-2 11 0 16 2 11 2 5 0 2Z" fill="#FFE1AC" stroke="none" />
          <path d="M0 3Q-1-4-5-5M0 3Q1-4 5-5" />
          <circle cy="1" r="1.3" fill="#FFE1AC" stroke="none" />
        </g>
      </g>
      <g className="creative-idea creative-star" stroke="#F3C18C" strokeWidth=".65" strokeLinejoin="round">
        <path d="M246 88C249 99 251 102 262 105C251 108 249 111 246 122C243 111 241 108 230 105C241 102 243 99 246 88Z" fill={`url(#${artId}-gold)`} />
        <path d="m246 97 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" stroke="#FFE9C3" strokeWidth=".4" strokeOpacity=".65" />
      </g>
      <g className="creative-idea creative-spark" stroke="#F3C18C" strokeWidth=".65" strokeLinecap="round">
        <path d="M227 49v12m-6-6h12M84 144v8m-4-4h8M276 145v8m-4-4h8" />
        <circle cx="139" cy="54" r="2" fill="currentColor" stroke="none" /><circle cx="282" cy="83" r="2" fill="var(--brand)" stroke="none" />
      </g>
      {scene ? <>
        <g transform="translate(276 83) rotate(12)"><g className="creative-idea creative-film" stroke="#F3C18C" strokeWidth=".65" strokeLinejoin="round">
          <rect x="-12" y="-11" width="25" height="25" rx="7" fill="#23140F" stroke="none" />
          <rect x="-13" y="-13" width="25" height="25" rx="7" fill={`url(#${artId}-gold)`} />
          <path d="M-3-5.3Q-4-5.9-4-4.6V4.6Q-4 5.9-3 5.3L5 .7Q6 0 5-.7L-3-5.3Z" fill="#FFF0D1" stroke="#84503A" strokeOpacity=".5" strokeWidth=".45" />
          <path d="M-9-8Q-8-10-5-10H4" stroke="#FFEFD1" strokeOpacity=".55" strokeWidth=".5" strokeLinecap="round" />
        </g></g>
        <g transform="translate(80 86) rotate(-24)"><g className="creative-idea creative-planet">
          <ellipse rx="17" ry="5" stroke={`url(#${artId}-ring)`} strokeWidth="1.6" opacity=".6" />
          <circle r="8.5" fill={`url(#${artId}-planet)`} stroke="#F3C18C" strokeWidth=".55" />
          <path d="M-7-3Q0 0 8-2M-8 1Q0 4 7 2" stroke="#FFE4B9" strokeOpacity=".22" strokeWidth=".7" />
          <path d="M-17 0C-17 6.7 17 6.7 17 0" stroke={`url(#${artId}-ring)`} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M-15 2.2C-9 5.6 9 5.6 15 2.2" stroke="#FFE5BA" strokeOpacity=".55" strokeWidth=".45" />
        </g></g>
      </> : null}
      <path d="m124 159 56 29v44l-56-29v-44Z" fill={`url(#${artId}-box)`} stroke="#D99A64" strokeOpacity=".7" strokeWidth=".7" />
      <path d="m180 188 56-29v44l-56 29v-44Z" fill="#21150F" stroke="#D99A64" strokeOpacity=".7" strokeWidth=".7" />
      {/* Both hinge vertices stay fixed in every animation pose. */}
      <path className="creative-flap creative-flap-left" d="M124 159 106 122 162 95 180 132Z" fill={`url(#${artId}-box)`} stroke="#D99A64" strokeOpacity=".8" strokeWidth=".7" />
      <path className="creative-flap creative-flap-right" d="M236 159 254 122 198 95 180 132Z" fill={`url(#${artId}-box)`} stroke="#D99A64" strokeOpacity=".8" strokeWidth=".7" />
      <path d="m180 188 22 11 12-6-22-11-12 6Z" fill="var(--brand)" fillOpacity=".7" />
    </svg>
  );
}
