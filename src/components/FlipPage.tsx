import { forwardRef, type ReactNode } from "react";

/**
 * A single page inside the HTMLFlipBook. react-pageflip clones this element
 * and attaches a ref to it directly, so it must forward its ref to the root
 * DOM node (see react-pageflip's own README for this exact pattern).
 */
export const FlipPage = forwardRef<HTMLDivElement, { className?: string; hard?: boolean; children: ReactNode }>(
  ({ className = "", hard = false, children }, ref) => (
    <div ref={ref} className={`page h-full w-full overflow-hidden ${className}`} data-density={hard ? "hard" : "soft"}>
      {children}
    </div>
  )
);
FlipPage.displayName = "FlipPage";
