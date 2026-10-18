import { useLayoutEffect, type RefObject } from "react";

/**
 * Shrinks text (via the --fit CSS variable, 1 down to 0.45) until it fits its
 * box, and flags the box with data-overflow when even the smallest size doesn't fit.
 */
export function useFitText(ref: RefObject<HTMLElement>, deps: unknown[]): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let scale = 1;
      el.style.setProperty("--fit", "1");
      while (el.scrollHeight > el.clientHeight + 1 && scale > 0.45) {
        scale = Math.round((scale - 0.05) * 100) / 100;
        el.style.setProperty("--fit", String(scale));
      }
      el.dataset.overflow = el.scrollHeight > el.clientHeight + 1 ? "true" : "false";
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
