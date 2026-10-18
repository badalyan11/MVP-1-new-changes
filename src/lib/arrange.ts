import type { Page, Photo } from "../types";
import { makePage } from "./pageOps";
import { LAYOUT_BY_ID, applyLayout, newPhotoElement, relayout, suggestLayouts, type PhotoLookup } from "./pageLayouts";

const GROUP_PATTERN = [1, 3, 2, 4, 2, 1, 3, 4];

/**
 * "Arrange for me": a starting arrangement for photos that haven't been placed.
 * Photos keep their order (by when they were taken), groups vary in size, and
 * big landscape photos get a full spread now and then. It only suggests; every
 * page it makes is an ordinary page the person can change.
 */
export function arrangePhotos(opts: { photos: Photo[]; journalId: string; userId: string; lookup: PhotoLookup }): Page[] {
  const sorted = [...opts.photos].sort((a, b) => {
    const ta = a.takenAt ?? a.createdAt;
    const tb = b.takenAt ?? b.createdAt;
    return ta.localeCompare(tb) || a.filename.localeCompare(b.filename);
  });

  const pages: Page[] = [];
  let i = 0;
  let pattern = 0;
  let sinceSpread = 3;
  let trioCount = 0;

  while (i < sorted.length) {
    const photo = sorted[i];
    const aspect = photo.width / photo.height;

    if (aspect >= 1.55 && photo.width >= 2400 && sinceSpread >= 3) {
      const rect = { x: 0, y: 0, w: 200, h: 100 };
      let page = makePage({ journalId: opts.journalId, userId: opts.userId, span: 2, elements: [newPhotoElement(photo, rect)] });
      page = applyLayout(page, LAYOUT_BY_ID["spread-full"], opts.lookup);
      pages.push(page);
      i += 1;
      sinceSpread = 0;
      continue;
    }

    const n = Math.min(GROUP_PATTERN[pattern++ % GROUP_PATTERN.length], sorted.length - i);
    const group = sorted.slice(i, i + n);
    i += n;
    sinceSpread += 1;

    let page = makePage({
      journalId: opts.journalId,
      userId: opts.userId,
      elements: group.map((p) => newPhotoElement(p, { x: 10, y: 10, w: 40, h: 40 })),
    });
    const lookup: PhotoLookup = (id) => opts.lookup(id) ?? group.find((g) => g.id === id);
    const options = suggestLayouts(page, lookup);
    let chosen = options[0];
    if (n === 1) chosen = LAYOUT_BY_ID.single;
    if (n === 3) {
      chosen = trioCount++ % 2 === 0 ? LAYOUT_BY_ID.trio : LAYOUT_BY_ID.scrapbook;
    }
    page = chosen ? applyLayout(page, chosen, lookup) : relayout(page, lookup);
    pages.push(page);
  }
  return pages;
}
