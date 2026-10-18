import type { Page } from "../types";

/**
 * The album is a cover, then physical pages in pairs (left/right), then a back
 * cover. A "spread" page covers two facing slots; it must start on a left page,
 * so a blank filler is inserted when it would otherwise start on the right.
 */
export type Slot =
  | { kind: "cover" }
  | { kind: "page"; page: Page; half: 0 | 1 | null }
  | { kind: "filler" }
  | { kind: "back" };

export function buildSlots(pages: Page[]): Slot[] {
  const slots: Slot[] = [{ kind: "cover" }];
  for (const page of pages) {
    if (page.span === 2) {
      if (slots.length % 2 === 0) slots.push({ kind: "filler" });
      slots.push({ kind: "page", page, half: 0 });
      slots.push({ kind: "page", page, half: 1 });
    } else {
      slots.push({ kind: "page", page, half: null });
    }
  }
  // Content slots (everything after the cover) must pair up so the back cover stands alone.
  if ((slots.length - 1) % 2 === 1) slots.push({ kind: "filler" });
  slots.push({ kind: "back" });
  return slots;
}

export interface Spread {
  index: number;
  left: Slot;
  right: Slot;
  /** Slot index of the left page in the full slot list. */
  slotIndex: number;
}

export function buildSpreads(slots: Slot[]): Spread[] {
  const spreads: Spread[] = [];
  for (let i = 1; i + 1 < slots.length - 1; i += 2) {
    spreads.push({ index: spreads.length, left: slots[i], right: slots[i + 1], slotIndex: i });
  }
  return spreads;
}

/** Which slot index a given page starts at. */
export function slotIndexOfPage(slots: Slot[], pageId: string): number {
  return slots.findIndex((s) => s.kind === "page" && s.page.id === pageId);
}
