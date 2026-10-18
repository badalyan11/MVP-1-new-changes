import type { CSSProperties, ReactNode } from "react";
import { getContrastText } from "../lib/color";

/** Subtle shading in the valley where the two pages meet the binding. */
export function Gutter({ hidden = false }: { hidden?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 transition-opacity duration-200"
      style={{
        width: "9%",
        zIndex: 1000,
        opacity: hidden ? 0 : 1,
        background:
          "linear-gradient(to right, rgba(40,28,10,0) 0%, rgba(40,28,10,0.07) 22%, rgba(40,28,10,0.20) 42%, rgba(40,28,10,0.38) 49.4%, rgba(255,255,255,0.18) 50%, rgba(40,28,10,0.30) 50.8%, rgba(40,28,10,0.16) 58%, rgba(40,28,10,0.06) 78%, rgba(40,28,10,0) 100%)",
      }}
    />
  );
}

/** The edge of the stacked pages, thicker on the side that has more pages. */
export function PageStack({ side, thickness }: { side: "left" | "right"; thickness: number }) {
  const style: CSSProperties = {
    width: thickness,
    top: 2,
    bottom: 2,
    [side]: -thickness,
    background: "repeating-linear-gradient(to right, #E4DCCB 0 1px, #FBF8F0 1px 2px)",
    boxShadow: side === "left" ? "inset 2px 0 3px rgba(0,0,0,0.10)" : "inset -2px 0 3px rgba(0,0,0,0.10)",
    borderRadius: side === "left" ? "2px 0 0 2px" : "0 2px 2px 0",
  };
  return <div className="pointer-events-none absolute z-0" style={style} />;
}

/**
 * Gives an open album its physical presence: the hard-cover board around the
 * pages, a drop shadow, and the visible thickness of the page block on each side.
 */
export function BookDepth({
  coverColor,
  open,
  leftThickness,
  rightThickness,
  children,
  padding = 14,
}: {
  coverColor: string;
  open: boolean;
  leftThickness: number;
  rightThickness: number;
  children: ReactNode;
  padding?: number;
}) {
  const edge = getContrastText(coverColor) === "#3B362F" ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.14)";
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute z-0 rounded-md transition-opacity duration-500"
        style={{
          inset: -padding,
          opacity: open ? 1 : 0,
          background: `linear-gradient(135deg, rgba(255,255,255,0.10), rgba(0,0,0,0.12)), ${coverColor}`,
          boxShadow: `0 28px 50px -18px rgba(40,28,10,0.45), 0 10px 18px -6px rgba(40,28,10,0.25), inset 0 0 0 1px ${edge}`,
        }}
      />
      <div className="transition-opacity duration-500" style={{ opacity: open ? 1 : 0 }}>
        <PageStack side="left" thickness={leftThickness} />
        <PageStack side="right" thickness={rightThickness} />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
