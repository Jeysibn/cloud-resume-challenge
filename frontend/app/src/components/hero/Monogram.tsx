import { useId } from "react";

/*
 * Sculptural JI monogram for the hero. Decorative only: the name is in the H1.
 *
 * Built as one inline SVG so it stays crisp and cheap: an arched metal window
 * frame with a faint glass opening, a JI ligature whose J and I hang from a shared lintel
 * (like columns under a beam), a faint brushed grain and a reflection band.
 * Every colour comes from --mono-* tokens, so each theme gets its own material
 * rather than an inversion. Motion lives in CSS and is off for reduced motion.
 */
// Arched window frame: an outer arch with the inner opening cut out (evenodd).
const OUTER = "M20 206V100a80 80 0 0 1 160 0v106a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4Z";
const OPENING = "M32 198V100a68 68 0 0 1 136 0v98Z";
// Lintel spanning both letters, I column with base, J column with a hook.
const LETTERS =
  "M68 96h68v10h-8v80h8v10h-34v-10h8v-80h-14v66a28 28 0 0 1-28 28h-6v-14h6a14 14 0 0 0 14-14v-66h-14Z";
// Centre the ligature in the opening and give it more presence.
const LETTER_PLACEMENT = "translate(100 134) scale(1.12) translate(-99 -148)";

export function Monogram() {
  const id = useId().replace(/:/g, "");
  const ref = (name: string) => `url(#${id}-${name})`;

  return (
    <div className="monogram" aria-hidden="true">
      <svg className="monogram-art" viewBox="0 0 200 220" focusable="false">
        <defs>
          <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="mono-stop-rim-hi" />
            <stop offset="0.45" className="mono-stop-rim-mid" />
            <stop offset="1" className="mono-stop-rim-lo" />
          </linearGradient>
          <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="mono-stop-face-hi" />
            <stop offset="1" className="mono-stop-face-lo" />
          </linearGradient>
          <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" className="mono-stop-metal-hi" />
            <stop offset="0.5" className="mono-stop-metal-mid" />
            <stop offset="1" className="mono-stop-metal-lo" />
          </linearGradient>
          <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="mono-stop-edge" />
            <stop offset="0.35" className="mono-stop-edge" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-sweep`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" className="mono-stop-sweep" stopOpacity="0" />
            <stop offset="0.5" className="mono-stop-sweep" />
            <stop offset="1" className="mono-stop-sweep" stopOpacity="0" />
          </linearGradient>
          <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9 0.025" numOctaves="2" seed="7" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.5" />
            </feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          <clipPath id={`${id}-clip`}>
            <path d={OUTER} />
          </clipPath>
        </defs>

        <ellipse className="monogram-contact" cx="100" cy="215" rx="74" ry="3" />
        <path className="monogram-glass" d={OPENING} fill={ref("face")} />
        <path d={OUTER + OPENING} fill={ref("rim")} fillRule="evenodd" />
        <path className="monogram-grain" d={OUTER + OPENING} fillRule="evenodd" filter={ref("grain")} />
        <path className="monogram-bevel" d={OPENING} />
        <g transform={LETTER_PLACEMENT}>
          <path d={LETTERS} className="monogram-depth" transform="translate(2.5 3.5)" />
          <path d={LETTERS} fill={ref("metal")} />
          <path d={LETTERS} fill={ref("edge")} />
          <path className="monogram-letter-edge" d={LETTERS} />
        </g>
        <g clipPath={ref("clip")}>
          <rect className="monogram-sweep" x="-70" y="-10" width="56" height="240" fill={ref("sweep")} />
        </g>
        <path className="monogram-rim-edge" d={OUTER} />
      </svg>
    </div>
  );
}
