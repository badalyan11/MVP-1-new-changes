import type { CSSProperties, ReactNode } from "react";
import { getPageStyle } from "../lib/pageStyles";

const LEAF = "M0 0 C 5 -5 12 -5 17 0 C 12 5 5 5 0 0Z";

function Flower({ x, y, s = 1, petal, center }: { x: number; y: number; s?: number; petal: string; center: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy="-6.5" rx="3.8" ry="6.5" transform={`rotate(${a})`} fill={petal} opacity="0.8" />
      ))}
      <circle r="2.8" fill={center} />
    </g>
  );
}

function FloralCorner({ color }: { color: string }) {
  const leaf = "#7E9272";
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <g fill="none" stroke={leaf} strokeWidth="1" strokeLinecap="round" opacity="0.7">
        <path d="M3 3 C 22 10, 40 26, 56 52" />
        <path d="M3 3 C 12 24, 18 46, 16 74" />
      </g>
      <g fill={leaf} opacity="0.5">
        <path d={LEAF} transform="translate(20 12) rotate(15)" />
        <path d={LEAF} transform="translate(34 24) rotate(40)" />
        <path d={LEAF} transform="translate(46 40) rotate(62)" />
        <path d={LEAF} transform="translate(10 30) rotate(80)" />
        <path d={LEAF} transform="translate(14 54) rotate(95)" />
      </g>
      <Flower x={30} y={22} s={1.1} petal={color} center="#E9C46A" />
      <Flower x={13} y={50} s={0.85} petal={color} center="#E9C46A" />
      <Flower x={54} y={50} s={0.7} petal={color} center="#E9C46A" />
    </svg>
  );
}

function BotanicalSprig({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <path d="M6 94 C 20 70, 36 44, 60 10" fill="none" stroke={color} strokeWidth="1" opacity="0.65" strokeLinecap="round" />
      <g fill={color} opacity="0.5">
        <path d={LEAF} transform="translate(12 84) rotate(-35)" />
        <path d={LEAF} transform="translate(16 82) rotate(30) scale(0.9)" />
        <path d={LEAF} transform="translate(24 68) rotate(-45)" />
        <path d={LEAF} transform="translate(28 66) rotate(15) scale(0.95)" />
        <path d={LEAF} transform="translate(36 52) rotate(-55)" />
        <path d={LEAF} transform="translate(40 50) rotate(5)" />
        <path d={LEAF} transform="translate(48 34) rotate(-62) scale(0.9)" />
        <path d={LEAF} transform="translate(52 30) rotate(-5) scale(0.85)" />
        <path d={LEAF} transform="translate(58 14) rotate(-75) scale(0.8)" />
      </g>
    </svg>
  );
}

function Corner({ pos, children, size = 26 }: { pos: "tl" | "tr" | "bl" | "br"; children: ReactNode; size?: number }) {
  const flipX = pos === "tr" || pos === "br" ? -1 : 1;
  const flipY = pos === "bl" || pos === "br" ? -1 : 1;
  const style: CSSProperties = {
    position: "absolute",
    width: `${size}%`,
    height: `${size}%`,
    top: pos[0] === "t" ? 0 : undefined,
    bottom: pos[0] === "b" ? 0 : undefined,
    left: pos[1] === "l" ? 0 : undefined,
    right: pos[1] === "r" ? 0 : undefined,
    transform: `scale(${flipX}, ${flipY})`,
  };
  return <div style={style}>{children}</div>;
}

function Decoration({ kind, accent }: { kind: string; accent: string }) {
  switch (kind) {
    case "hairline":
      return (
        <>
          <div className="absolute inset-x-[7%] top-[5%] border-t border-black/10" />
          <div className="absolute inset-x-[7%] bottom-[5%] border-b border-black/10" />
        </>
      );
    case "keepsake":
      return (
        <>
          <div className="absolute inset-[3.5%] border" style={{ borderColor: `${accent}55` }} />
          <div className="absolute inset-[4.6%] border" style={{ borderColor: `${accent}33` }} />
        </>
      );
    case "stitch":
      return <div className="absolute inset-[3%] border border-dashed" style={{ borderColor: `${accent}55` }} />;
    case "floral":
      return (
        <>
          <Corner pos="tl">
            <FloralCorner color="#E8B4B8" />
          </Corner>
          <Corner pos="br">
            <FloralCorner color="#E8B4B8" />
          </Corner>
        </>
      );
    case "botanical":
      return (
        <>
          <Corner pos="bl" size={30}>
            <BotanicalSprig color="#6F8A63" />
          </Corner>
          <Corner pos="tr" size={22}>
            <BotanicalSprig color="#6F8A63" />
          </Corner>
        </>
      );
    default:
      return null;
  }
}

/**
 * The paper and decoration behind a page. `span` is how many pages wide the
 * canvas is (2 for a one-design-across-the-spread page); decorations repeat per page.
 */
export function PageBackground({
  styleId,
  accent,
  span = 1,
}: {
  styleId: string | null | undefined;
  accent: string;
  span?: 1 | 2;
}) {
  const def = getPageStyle(styleId);
  return (
    <div className="absolute inset-0" style={{ background: def.paper }}>
      {Array.from({ length: span }, (_, i) => (
        <div key={i} className="absolute top-0 h-full" style={{ left: `${(i * 100) / span}%`, width: `${100 / span}%` }}>
          <Decoration kind={def.decoration} accent={accent} />
        </div>
      ))}
    </div>
  );
}
