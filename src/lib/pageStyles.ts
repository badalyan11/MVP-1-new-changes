import type { PageStyleId } from "../types";

/**
 * A page style is just data: a paper treatment plus an optional decoration
 * name. Adding a new style (e.g. from Figma designs later) means adding an
 * entry here and, if it needs artwork, a decoration in PageBackground.tsx.
 */
export interface PageStyleDef {
  id: PageStyleId;
  label: string;
  paper: string; // CSS background (color + optional texture layers)
  decoration: "none" | "hairline" | "keepsake" | "floral" | "botanical" | "stitch";
}

export const PAGE_STYLE_DEFS: PageStyleDef[] = [
  {
    id: "minimal-album",
    label: "Minimal album",
    paper: "#FFFEFB",
    decoration: "none",
  },
  {
    id: "clean-editorial",
    label: "Clean editorial",
    paper: "#FBFAF6",
    decoration: "hairline",
  },
  {
    id: "warm-paper",
    label: "Warm paper",
    paper:
      "radial-gradient(rgba(120,90,50,0.05) 1px, transparent 1px) 0 0 / 5px 5px, radial-gradient(ellipse at center, #F6ECD8 55%, #EBDDC2 100%)",
    decoration: "none",
  },
  {
    id: "classic-keepsake",
    label: "Classic keepsake",
    paper: "#FBF6EA",
    decoration: "keepsake",
  },
  {
    id: "floral",
    label: "Floral",
    paper: "#FFFCF8",
    decoration: "floral",
  },
  {
    id: "botanical",
    label: "Botanical",
    paper: "#FAFBF5",
    decoration: "botanical",
  },
  {
    id: "subtle-scrapbook",
    label: "Subtle scrapbook",
    paper:
      "radial-gradient(rgba(90,70,40,0.045) 1px, transparent 1px) 0 0 / 4px 4px, linear-gradient(#F5EEE0, #F1E8D6)",
    decoration: "stitch",
  },
];

export const DEFAULT_PAGE_STYLE: PageStyleId = "minimal-album";

const LEGACY_STYLE_MAP: Record<string, PageStyleId> = {
  plain: "minimal-album",
  lined: "clean-editorial",
  dotted: "subtle-scrapbook",
  vintage: "warm-paper",
};

/** Accepts any stored value (including the old plain/lined/dotted/vintage ids). */
export function normalizePageStyle(value: string | null | undefined): PageStyleId {
  if (!value) return DEFAULT_PAGE_STYLE;
  if (PAGE_STYLE_DEFS.some((s) => s.id === value)) return value as PageStyleId;
  return LEGACY_STYLE_MAP[value] ?? DEFAULT_PAGE_STYLE;
}

export function getPageStyle(id: string | null | undefined): PageStyleDef {
  const normalized = normalizePageStyle(id);
  return PAGE_STYLE_DEFS.find((s) => s.id === normalized)!;
}
