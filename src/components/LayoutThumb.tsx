import type { LayoutDef } from "../lib/pageLayouts";

/** A tiny drawing of what a layout looks like, built from the layout itself. */
export function LayoutThumb({ def, photoCount, hasText }: { def: LayoutDef; photoCount: number; hasText: boolean }) {
  const n = Math.min(Math.max(photoCount, def.minPhotos), def.maxPhotos);
  const out = def.build({ n, hasText: hasText || def.text === "region", aspects: Array.from({ length: n }, () => 1.5) });
  const w = 100 * def.span;
  return (
    <svg viewBox={`0 0 ${w} 100`} className={def.span === 2 ? "h-9 w-[4.5rem]" : "h-9 w-9"} aria-hidden>
      <rect x="0.5" y="0.5" width={w - 1} height="99" rx="3" fill="#FFFEFB" stroke="#D9D0BD" strokeWidth="2" />
      {out.photos.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#9DA992" opacity="0.85" rx="1.5" />
      ))}
      {out.text &&
        [0.18, 0.4, 0.62].map((f, i) => (
          <rect key={i} x={out.text!.x + 2} y={out.text!.y + out.text!.h * f} width={out.text!.w * (i === 2 ? 0.55 : 0.9)} height="4" rx="2" fill="#B9B09C" />
        ))}
      {def.span === 2 && <line x1="100" y1="0" x2="100" y2="100" stroke="#D9D0BD" strokeWidth="2" />}
    </svg>
  );
}
