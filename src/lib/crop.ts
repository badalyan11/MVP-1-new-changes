import type { Photo, PhotoElement } from "../types";

/** Pages are square. Physical size is used only for the print-quality hint. */
export const PAGE_ASPECT = 1;
export const PRINT_PAGE_INCHES = 8;
/** Below this effective resolution a photo may look soft in print. */
export const MIN_PRINT_DPI = 150;

export interface CoverBox {
  /** All values are percentages of the element's box. */
  widthPct: number;
  heightPct: number;
  leftPct: number;
  topPct: number;
}

/** Aspect ratio (width / height) of a box given in page units. */
export function boxAspect(w: number, h: number): number {
  return (w / h) * PAGE_ASPECT;
}

/**
 * Where to draw the original inside its frame: cover-fit, then zoomed, then
 * shifted by the stored pan. Pure math, so the original image is never altered.
 */
export function coverBox(imgAspect: number, frameAspect: number, zoom: number, panX: number, panY: number): CoverBox {
  let widthPct: number;
  let heightPct: number;
  if (imgAspect > frameAspect) {
    heightPct = 100 * zoom;
    widthPct = (heightPct * imgAspect) / frameAspect;
  } else {
    widthPct = 100 * zoom;
    heightPct = (widthPct * frameAspect) / imgAspect;
  }
  return {
    widthPct,
    heightPct,
    leftPct: (100 - widthPct) * panX,
    topPct: (100 - heightPct) * panY,
  };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** A friendly default focus: keep heads (upper third) when a tall photo goes in a wide frame. */
export function defaultPan(imgAspect: number, frameAspect: number): { panX: number; panY: number } {
  if (imgAspect < frameAspect) return { panX: 0.5, panY: 0.3 };
  return { panX: 0.5, panY: 0.5 };
}

/** Effective print resolution of a placed photo, using the original's pixel size. */
export function effectiveDpi(el: PhotoElement, photo: Pick<Photo, "width" | "height">): number {
  const imgAspect = photo.width / photo.height;
  const frame = boxAspect(el.w, el.h);
  const box = coverBox(imgAspect, frame, el.zoom, el.panX, el.panY);
  const visibleSourceWidth = (photo.width * 100) / box.widthPct;
  const inches = (el.w / 100) * PRINT_PAGE_INCHES;
  return visibleSourceWidth / inches;
}

export function isLowResolution(el: PhotoElement, photo: Pick<Photo, "width" | "height">): boolean {
  return effectiveDpi(el, photo) < MIN_PRINT_DPI;
}
