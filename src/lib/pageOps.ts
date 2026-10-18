import type { Page, PageElement } from "../types";
import { uid } from "./ids";
import { LAYOUT_BY_ID, applyLayout, newTextElement, type PhotoLookup } from "./pageLayouts";

export function makePage(opts: {
  journalId: string;
  userId: string;
  position?: number;
  span?: 1 | 2;
  elements?: PageElement[];
  layoutId?: string | null;
  autoLayout?: boolean;
  meta?: Page["meta"];
}): Page {
  const now = new Date().toISOString();
  return {
    id: uid(),
    journalId: opts.journalId,
    position: opts.position ?? 0,
    span: opts.span ?? 1,
    style: null,
    autoLayout: opts.autoLayout ?? true,
    layoutId: opts.layoutId ?? null,
    elements: opts.elements ?? [],
    meta: opts.meta ?? {},
    createdBy: opts.userId,
    createdAt: now,
    updatedAt: now,
  };
}

/** The first page of every new album: its title, laid out as a title page. */
export function makeTitlePage(opts: { journalId: string; userId: string; title: string; subtitle: string }): Page {
  const text = { ...newTextElement({ x: 12, y: 28, w: 76, h: 44 }, "center"), title: opts.title, story: opts.subtitle, scale: 1.7 };
  const page = makePage({ journalId: opts.journalId, userId: opts.userId, position: 1, elements: [text], layoutId: "title" });
  return applyLayout(page, LAYOUT_BY_ID.title, () => undefined);
}

export function renumber(pages: Page[]): Page[] {
  return pages.map((p, i) => (p.position === i + 1 ? p : { ...p, position: i + 1 }));
}

export function sortPages(pages: Page[]): Page[] {
  return [...pages].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

/** Adds a page after another (owners), or at the end (everyone else, and when no anchor is given). */
export function insertPage(pages: Page[], page: Page, afterId: string | null, isOwner: boolean): Page[] {
  if (isOwner && afterId) {
    const idx = pages.findIndex((p) => p.id === afterId);
    if (idx >= 0) {
      const next = [...pages.slice(0, idx + 1), page, ...pages.slice(idx + 1)];
      return renumber(next);
    }
  }
  const last = pages.reduce((m, p) => Math.max(m, p.position), 0);
  return [...pages, { ...page, position: last + 1 }];
}

export function removePage(pages: Page[], id: string): Page[] {
  return pages.filter((p) => p.id !== id);
}

export function duplicatePage(pages: Page[], id: string, userId: string): Page[] {
  const idx = pages.findIndex((p) => p.id === id);
  if (idx < 0) return pages;
  const src = pages[idx];
  const now = new Date().toISOString();
  const copy: Page = {
    ...src,
    id: uid(),
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    elements: src.elements.map((e) => ({ ...e, id: uid() })),
  };
  return renumber([...pages.slice(0, idx + 1), copy, ...pages.slice(idx + 1)]);
}

export function reorderPages(pages: Page[], orderedIds: string[]): Page[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as Page[];
  const missing = pages.filter((p) => !orderedIds.includes(p.id));
  return renumber([...ordered, ...missing]);
}

export function replacePage(pages: Page[], next: Page): Page[] {
  return pages.map((p) => (p.id === next.id ? next : p));
}

export type { PhotoLookup };
