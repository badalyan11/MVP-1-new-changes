import type { Page, PageElement, Photo, PhotoElement, TextElement } from "../types";
import { boxAspect, clamp, defaultPan } from "./crop";
import { uid } from "./ids";

/**
 * Layouts are SUGGESTIONS. Each one turns "N photos (+ optional text)" into
 * rectangles; applying one never changes the photos or the words, only where
 * they sit. Units: a single page is 100 x 100, a spread canvas is 200 x 100.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BuildCtx {
  n: number;
  hasText: boolean;
  aspects: number[]; // width / height of each photo, in order
}

interface LayoutOutput {
  photos: Rect[];
  text: Rect | null;
  framed?: boolean;
  textAlign?: "left" | "center";
  textScale?: number;
}

export interface LayoutDef {
  id: string;
  label: string;
  span: 1 | 2;
  minPhotos: number;
  maxPhotos: number;
  /** none: never has text. optional: leaves room only if text exists. region: always has a text area. */
  text: "none" | "optional" | "region";
  build: (ctx: BuildCtx) => LayoutOutput;
}

/** Text size on a title page; leaving the title layout returns text to normal size. */
const TITLE_SCALE = 1.7;
const M = 6;
const G = 3;

function fit(area: Rect, aspect: number, vAlign: "center" | "top" = "center"): Rect {
  const areaAspect = area.w / area.h;
  let w: number;
  let h: number;
  if (aspect >= areaAspect) {
    w = area.w;
    h = w / aspect;
  } else {
    h = area.h;
    w = h * aspect;
  }
  return {
    x: area.x + (area.w - w) / 2,
    y: vAlign === "center" ? area.y + (area.h - h) / 2 : area.y,
    w,
    h,
  };
}

/** Rows of equal-height cells; each row's cells share the row's width evenly. */
function gridRects(area: Rect, n: number, cols: number): Rect[] {
  const rows = Math.ceil(n / cols);
  const rowCounts: number[] = [];
  let remaining = n;
  for (let r = 0; r < rows; r++) {
    const count = Math.min(cols, remaining);
    rowCounts.push(count);
    remaining -= count;
  }
  // Balance the last row so it never holds a lone photo when avoidable.
  if (rows > 1 && rowCounts[rows - 1] === 1 && rowCounts[rows - 2] > 2) {
    rowCounts[rows - 1] = 2;
    rowCounts[rows - 2] -= 1;
  }
  const cellH = (area.h - G * (rows - 1)) / rows;
  const out: Rect[] = [];
  rowCounts.forEach((count, r) => {
    const cellW = (area.w - G * (count - 1)) / count;
    for (let c = 0; c < count; c++) {
      out.push({ x: area.x + c * (cellW + G), y: area.y + r * (cellH + G), w: cellW, h: cellH });
    }
  });
  return out;
}

/** A small collage inside an area, for 1..N photos. */
function collage(area: Rect, n: number, aspects: number[]): Rect[] {
  if (n === 1) return [fit(area, aspects[0] ?? 1.5)];
  if (n === 2) {
    const bothWide = aspects.slice(0, 2).every((a) => a >= 1.15);
    return bothWide ? gridRects(area, 2, 1) : gridRects(area, 2, 2);
  }
  if (n === 3) {
    const bigW = (area.w - G) * 0.58;
    const smallW = area.w - G - bigW;
    const smallH = (area.h - G) / 2;
    return [
      { x: area.x, y: area.y, w: bigW, h: area.h },
      { x: area.x + bigW + G, y: area.y, w: smallW, h: smallH },
      { x: area.x + bigW + G, y: area.y + smallH + G, w: smallW, h: smallH },
    ];
  }
  return gridRects(area, n, n <= 4 ? 2 : n <= 9 ? 3 : 4);
}

const TEXT_BOTTOM: Rect = { x: M + 2, y: 75, w: 100 - 2 * (M + 2), h: 19 };

export const LAYOUTS: LayoutDef[] = [
  // ----- single pages -----
  {
    id: "single",
    label: "One photo",
    span: 1,
    minPhotos: 1,
    maxPhotos: 1,
    text: "optional",
    build: ({ hasText, aspects }) => {
      const area: Rect = { x: M, y: M, w: 100 - 2 * M, h: hasText ? 64 : 100 - 2 * M };
      return { photos: [fit(area, aspects[0] ?? 1.5)], text: hasText ? TEXT_BOTTOM : null };
    },
  },
  {
    id: "full-bleed",
    label: "Full page photo",
    span: 1,
    minPhotos: 1,
    maxPhotos: 1,
    text: "none",
    build: () => ({ photos: [{ x: 0, y: 0, w: 100, h: 100 }], text: null }),
  },
  {
    id: "photo-story",
    label: "Photo and story",
    span: 1,
    minPhotos: 1,
    maxPhotos: 1,
    text: "region",
    build: ({ aspects }) => ({
      photos: [fit({ x: M, y: M, w: 100 - 2 * M, h: 60 }, aspects[0] ?? 1.5)],
      text: { x: M + 2, y: 70, w: 100 - 2 * (M + 2), h: 24 },
    }),
  },
  {
    id: "duo-stack",
    label: "Two photos stacked",
    span: 1,
    minPhotos: 2,
    maxPhotos: 2,
    text: "optional",
    build: ({ hasText }) => ({
      photos: gridRects({ x: M, y: M, w: 100 - 2 * M, h: hasText ? 64 : 100 - 2 * M }, 2, 1),
      text: hasText ? TEXT_BOTTOM : null,
    }),
  },
  {
    id: "duo-side",
    label: "Two photos side by side",
    span: 1,
    minPhotos: 2,
    maxPhotos: 2,
    text: "optional",
    build: ({ hasText }) => ({
      photos: gridRects({ x: M, y: M, w: 100 - 2 * M, h: hasText ? 64 : 100 - 2 * M }, 2, 2),
      text: hasText ? TEXT_BOTTOM : null,
    }),
  },
  {
    id: "large-small",
    label: "Large and small",
    span: 1,
    minPhotos: 2,
    maxPhotos: 2,
    text: "optional",
    build: ({ hasText }) => ({
      photos: [
        { x: M, y: M, w: 58, h: 100 - 2 * M },
        hasText ? { x: 67, y: M, w: 27, h: 38 } : { x: 67, y: 28, w: 27, h: 44 },
      ],
      text: hasText ? { x: 67, y: 48, w: 27, h: 46 } : null,
    }),
  },
  {
    id: "trio",
    label: "Three-photo collage",
    span: 1,
    minPhotos: 3,
    maxPhotos: 3,
    text: "optional",
    build: ({ hasText, aspects }) => ({
      photos: collage({ x: M, y: M, w: 100 - 2 * M, h: hasText ? 64 : 100 - 2 * M }, 3, aspects),
      text: hasText ? TEXT_BOTTOM : null,
    }),
  },
  {
    id: "quad",
    label: "Four-photo grid",
    span: 1,
    minPhotos: 4,
    maxPhotos: 4,
    text: "optional",
    build: ({ hasText }) => ({
      photos: gridRects({ x: M, y: M, w: 100 - 2 * M, h: hasText ? 64 : 100 - 2 * M }, 4, 2),
      text: hasText ? TEXT_BOTTOM : null,
    }),
  },
  {
    id: "grid",
    label: "Photo grid",
    span: 1,
    minPhotos: 5,
    maxPhotos: 12,
    text: "optional",
    build: ({ n, hasText }) => ({
      photos: gridRects({ x: M, y: M, w: 100 - 2 * M, h: hasText ? 64 : 100 - 2 * M }, n, n <= 6 ? 3 : n <= 9 ? 3 : 4),
      text: hasText ? TEXT_BOTTOM : null,
    }),
  },
  {
    id: "scrapbook",
    label: "Scrapbook",
    span: 1,
    minPhotos: 2,
    maxPhotos: 4,
    text: "optional",
    build: ({ n, hasText }) => {
      const area: Rect = { x: M, y: M, w: 100 - 2 * M, h: hasText ? 66 : 100 - 2 * M };
      const sets: Record<number, Rect[]> = {
        2: [
          { x: 0, y: 0.04, w: 0.58, h: 0.52 },
          { x: 0.36, y: 0.44, w: 0.62, h: 0.54 },
        ],
        3: [
          { x: 0, y: 0, w: 0.5, h: 0.5 },
          { x: 0.45, y: 0.12, w: 0.55, h: 0.46 },
          { x: 0.14, y: 0.52, w: 0.6, h: 0.48 },
        ],
        4: [
          { x: 0, y: 0, w: 0.46, h: 0.44 },
          { x: 0.5, y: 0.04, w: 0.5, h: 0.4 },
          { x: 0.04, y: 0.5, w: 0.5, h: 0.46 },
          { x: 0.56, y: 0.5, w: 0.44, h: 0.5 },
        ],
      };
      const photos = (sets[n] ?? sets[2]).map((r) => ({
        x: area.x + r.x * area.w,
        y: area.y + r.y * area.h,
        w: r.w * area.w,
        h: r.h * area.h,
      }));
      return { photos, text: hasText ? { x: M + 2, y: 76, w: 100 - 2 * (M + 2), h: 18 } : null, framed: true };
    },
  },
  {
    id: "story-only",
    label: "Story only",
    span: 1,
    minPhotos: 0,
    maxPhotos: 0,
    text: "region",
    build: () => ({ photos: [], text: { x: 10, y: 12, w: 80, h: 76 } }),
  },
  {
    id: "title",
    label: "Title page",
    span: 1,
    minPhotos: 0,
    maxPhotos: 0,
    text: "region",
    build: () => ({ photos: [], text: { x: 12, y: 28, w: 76, h: 44 }, textAlign: "center", textScale: TITLE_SCALE }),
  },

  // ----- two-page spreads -----
  {
    id: "spread-full",
    label: "Photo across both pages",
    span: 2,
    minPhotos: 1,
    maxPhotos: 1,
    text: "none",
    build: () => ({ photos: [{ x: 0, y: 0, w: 200, h: 100 }], text: null }),
  },
  {
    id: "spread-photo-story",
    label: "Photo left, story right",
    span: 2,
    minPhotos: 1,
    maxPhotos: 1,
    text: "region",
    build: () => ({
      photos: [{ x: 0, y: 0, w: 100, h: 100 }],
      text: { x: 112, y: 16, w: 76, h: 68 },
    }),
  },
  {
    id: "spread-story-photo",
    label: "Story left, photo right",
    span: 2,
    minPhotos: 1,
    maxPhotos: 1,
    text: "region",
    build: () => ({
      photos: [{ x: 100, y: 0, w: 100, h: 100 }],
      text: { x: 12, y: 16, w: 76, h: 68 },
    }),
  },
  {
    id: "spread-story-photos",
    label: "Story left, photos right",
    span: 2,
    minPhotos: 1,
    maxPhotos: 6,
    text: "region",
    build: ({ n, aspects }) => ({
      photos: collage({ x: 106, y: M, w: 100 - 2 * M, h: 100 - 2 * M }, n, aspects),
      text: { x: 12, y: 16, w: 76, h: 68 },
    }),
  },
  {
    id: "spread-photos-story",
    label: "Photos left, story right",
    span: 2,
    minPhotos: 1,
    maxPhotos: 6,
    text: "region",
    build: ({ n, aspects }) => ({
      photos: collage({ x: M, y: M, w: 100 - 2 * M, h: 100 - 2 * M }, n, aspects),
      text: { x: 112, y: 16, w: 76, h: 68 },
    }),
  },
  {
    id: "spread-pair",
    label: "One photo on each page",
    span: 2,
    minPhotos: 2,
    maxPhotos: 2,
    text: "none",
    build: ({ aspects }) => ({
      photos: [
        fit({ x: M, y: M, w: 100 - 2 * M, h: 100 - 2 * M }, aspects[0] ?? 1.5),
        fit({ x: 100 + M, y: M, w: 100 - 2 * M, h: 100 - 2 * M }, aspects[1] ?? 1.5),
      ],
      text: null,
    }),
  },
  {
    id: "spread-hero",
    label: "Large photo and two small",
    span: 2,
    minPhotos: 3,
    maxPhotos: 3,
    text: "none",
    build: () => ({
      photos: [
        { x: M, y: M, w: 100 - 2 * M, h: 100 - 2 * M },
        { x: 100 + M, y: M, w: 100 - 2 * M, h: 43 },
        { x: 100 + M, y: 51, w: 100 - 2 * M, h: 43 },
      ],
      text: null,
    }),
  },
  {
    id: "spread-grid",
    label: "Photo grid across the spread",
    span: 2,
    minPhotos: 2,
    maxPhotos: 16,
    text: "optional",
    build: ({ n, hasText }) => ({
      photos: gridRects(
        { x: M, y: M, w: 200 - 2 * M, h: hasText ? 68 : 100 - 2 * M },
        n,
        n <= 3 ? n : n <= 6 ? 3 : n <= 8 ? 4 : n <= 10 ? 5 : 6
      ),
      text: hasText ? { x: 20, y: 78, w: 160, h: 16 } : null,
    }),
  },
  {
    id: "spread-text",
    label: "Story across the spread",
    span: 2,
    minPhotos: 0,
    maxPhotos: 0,
    text: "region",
    build: () => ({ photos: [], text: { x: 30, y: 14, w: 140, h: 72 } }),
  },
];

export const LAYOUT_BY_ID: Record<string, LayoutDef> = Object.fromEntries(LAYOUTS.map((l) => [l.id, l]));

export type PhotoLookup = (photoId: string) => Pick<Photo, "width" | "height"> | undefined;

function photoElements(page: Page): PhotoElement[] {
  return page.elements.filter((e): e is PhotoElement => e.type === "photo");
}

export function textElementOf(page: Page): TextElement | undefined {
  return page.elements.find((e): e is TextElement => e.type === "text");
}

function aspectOf(el: PhotoElement, lookup: PhotoLookup): number {
  const p = lookup(el.photoId);
  return p ? p.width / p.height : 1.5;
}

/** Layouts that suit this page's current content, best first. */
export function suggestLayouts(page: Page, lookup: PhotoLookup): LayoutDef[] {
  const photos = photoElements(page);
  const n = photos.length;
  const hasTextEl = Boolean(textElementOf(page));
  const aspects = photos.map((p) => aspectOf(p, lookup));

  const matches = LAYOUTS.filter(
    (l) => l.span === page.span && n >= l.minPhotos && n <= l.maxPhotos && !(hasTextEl && l.text === "none")
  );

  // Landscape pairs read best stacked; portrait pairs side by side.
  if (n === 2 && page.span === 1) {
    const wide = aspects.every((a) => a >= 1.15);
    const first = wide ? "duo-stack" : "duo-side";
    matches.sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : 0));
  }
  return matches;
}

/** Keeps the current layout if it still fits the content, otherwise picks the best suggestion. */
export function chooseLayout(page: Page, lookup: PhotoLookup): LayoutDef | null {
  const options = suggestLayouts(page, lookup);
  const current = page.layoutId ? options.find((l) => l.id === page.layoutId) : undefined;
  if (current) return current;
  return options[0] ?? null;
}

export function newPhotoElement(photo: Pick<Photo, "width" | "height"> & { id: string }, rect: Rect): PhotoElement {
  const pan = defaultPan(photo.width / photo.height, boxAspect(rect.w, rect.h));
  return {
    id: uid(),
    type: "photo",
    photoId: photo.id,
    ...rect,
    zoom: 1,
    panX: pan.panX,
    panY: pan.panY,
    frame: "none",
  };
}

export function newTextElement(rect: Rect, align: "left" | "center" = "left"): TextElement {
  return { id: uid(), type: "text", ...rect, title: "", story: "", date: "", showDate: false, align };
}

/** Rearranges a page into a layout without touching its photos or words. */
export function applyLayout(page: Page, def: LayoutDef, lookup: PhotoLookup): Page {
  const photos = photoElements(page);
  const text = textElementOf(page);
  const n = photos.length;
  const aspects = photos.map((p) => aspectOf(p, lookup));
  const out = def.build({ n, hasText: Boolean(text) || def.text === "region", aspects });

  const placed: PhotoElement[] = photos.map((el, i) => {
    const rect = out.photos[i] ?? out.photos[out.photos.length - 1] ?? { x: 10, y: 10, w: 40, h: 40 };
    const frameAspect = boxAspect(rect.w, rect.h);
    const pan = el.userCrop ? { panX: el.panX, panY: el.panY } : defaultPan(aspects[i], frameAspect);
    return {
      ...el,
      ...rect,
      zoom: el.userCrop ? el.zoom : 1,
      panX: pan.panX,
      panY: pan.panY,
      frame: out.framed ? "white" : "none",
    };
  });

  let nextText: TextElement | null = text ?? null;
  if (out.text) {
    nextText = text
      ? { ...text, ...out.text, align: out.textAlign ?? text.align, scale: out.textScale ?? (text.scale === TITLE_SCALE ? 1 : text.scale ?? 1) }
      
      : { ...newTextElement(out.text, out.textAlign ?? "left"), scale: out.textScale ?? 1 };
  }

  const elements: PageElement[] = [...placed, ...(nextText ? [nextText] : [])];
  return { ...page, elements, layoutId: def.id };
}

/** Re-runs the best-fitting layout (used while a page is still in automatic mode). */
export function relayout(page: Page, lookup: PhotoLookup): Page {
  const def = chooseLayout(page, lookup);
  return def ? applyLayout(page, def, lookup) : page;
}

/** Adds a photo from the library to a page. Automatic pages re-flow; hand-arranged pages place it where dropped. */
export function addPhotoToPage(
  page: Page,
  photo: Pick<Photo, "width" | "height"> & { id: string },
  lookup: PhotoLookup,
  at?: { x: number; y: number }
): Page {
  const canvasW = 100 * page.span;
  const aspect = photo.width / photo.height;
  const w = Math.min(page.span === 2 ? 56 : 52, 90);
  const h = clamp(w / aspect, 20, 70);
  const cx = at?.x ?? canvasW / 2;
  const cy = at?.y ?? 50;
  const rect: Rect = {
    x: clamp(cx - w / 2, 0, canvasW - w),
    y: clamp(cy - h / 2, 0, 100 - h),
    w,
    h,
  };
  const el = newPhotoElement(photo, rect);
  const next: Page = { ...page, elements: [...page.elements, el] };
  return page.autoLayout ? relayout(next, (id) => (id === photo.id ? photo : lookup(id))) : next;
}

export function removeElement(page: Page, elementId: string, lookup: PhotoLookup): Page {
  const next: Page = { ...page, elements: page.elements.filter((e) => e.id !== elementId) };
  return page.autoLayout ? relayout(next, lookup) : next;
}

export function addTextToPage(page: Page, lookup: PhotoLookup): Page {
  if (textElementOf(page)) return page;
  const text = newTextElement({ x: M + 2, y: 74, w: 100 * page.span - 2 * (M + 2), h: 20 });
  const next: Page = { ...page, elements: [...page.elements, text] };
  return page.autoLayout ? relayout(next, lookup) : next;
}

/** Switches a page between one page and a two-page spread, keeping its content. */
export function convertSpan(page: Page, span: 1 | 2, lookup: PhotoLookup): Page {
  if (page.span === span) return page;
  const next: Page = { ...page, span, layoutId: null };
  if (page.autoLayout) return relayout(next, lookup);
  if (span === 1) {
    // Squeeze a hand-made spread design onto one page.
    next.elements = page.elements.map((e) => ({ ...e, x: e.x / 2, w: e.w / 2 }));
  }
  return next;
}
