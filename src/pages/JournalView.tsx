import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import HTMLFlipBook from "react-pageflip";
import { useAlbum } from "../context/AlbumContext";
import { useRenderEnv } from "../hooks/useRenderEnv";
import { useElementSize } from "../hooks/useElementSize";
import { buildSlots, slotIndexOfPage, type Slot } from "../lib/slots";
import { FlipPage } from "../components/FlipPage";
import { JournalCover } from "../components/JournalCover";
import { BlankPage, PageRenderer } from "../components/PageRenderer";
import { BookDepth, Gutter } from "../components/AlbumBoard";
import { MoreMenu } from "../components/MoreMenu";
import { ShareModal } from "../components/ShareModal";
import { Modal } from "../components/Modal";
import { CoverModal } from "../components/CoverModal";
import { DeleteAlbumModal } from "../components/DeleteAlbumModal";
import { PhotoLibrary } from "../components/PhotoLibrary";
import { getContrastText } from "../lib/color";
import { fontClassFor } from "../lib/journalTypes";

interface PageFlipController {
  flipNext: () => void;
  flipPrev: () => void;
  update: () => void;
}
interface FlipBookHandle {
  pageFlip: () => PageFlipController;
}

/** Reading and preview mode: the album, as it will look when finished. No editing controls. */
export function JournalView() {
  const album = useAlbum();
  const { journal, pages, photoUrls, isOwner } = album;
  const env = useRenderEnv();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state ?? {}) as { startPageId?: string; fromEdit?: boolean; added?: string };

  const slots = useMemo(() => buildSlots(pages), [pages]);
  const lastIndex = slots.length - 1;

  const startIndex = useMemo(() => {
    if (!navState.startPageId) return 0;
    const idx = slotIndexOfPage(slots, navState.startPageId);
    if (idx < 1) return 0;
    return idx % 2 === 0 ? idx - 1 : idx;
    // Only the initial value matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flipRef = useRef<FlipBookHandle | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const { width: areaW, height: areaH } = useElementSize(areaRef);
  const [currentPage, setCurrentPage] = useState(startIndex);
  const currentRef = useRef(startIndex);
  const [flipping, setFlipping] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(navState.added ?? null);

  const portrait = areaW > 0 && areaW < 560;
  const pad = 30;
  const availW = Math.max(0, areaW - 2 * pad - (portrait ? 0 : 56));
  const availH = Math.max(0, areaH - 2 * pad);
  const bookW = Math.floor(portrait ? Math.min(availW, availH) : Math.min(availW, availH * 2));

  // Make sure the pictures on the visible pages are loaded at full quality.
  useEffect(() => {
    const ids = new Set<string>();
    for (const p of pages) for (const e of p.elements) if (e.type === "photo") ids.add(e.photoId);
    album.ensureUrls([...ids], "display");
    if (journal.design.coverPhotoId) album.ensureUrls([journal.design.coverPhotoId], "display");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, journal.design.coverPhotoId]);

  useEffect(() => {
    flipRef.current?.pageFlip()?.update();
  }, [bookW]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 9000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const goPrev = () => flipRef.current?.pageFlip().flipPrev();
  const goNext = () => flipRef.current?.pageFlip().flipNext();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sharing || addingPhotos || coverOpen || deleting) return;
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const isOpen = currentPage > 0 && currentPage < lastIndex;
  const progress = lastIndex > 0 ? currentPage / lastIndex : 0;
  const leftThickness = 2 + progress * 9;
  const rightThickness = 2 + (1 - progress) * 9;
  const shiftX = !portrait && bookW > 0 ? (currentPage === 0 ? -bookW / 4 : currentPage === lastIndex ? bookW / 4 : 0) : 0;
  const coverUrl = journal.design.coverPhotoId ? photoUrls[journal.design.coverPhotoId]?.display ?? photoUrls[journal.design.coverPhotoId]?.thumb ?? null : null;

  const pageLabel =
    currentPage === 0
      ? "Cover"
      : currentPage >= lastIndex
        ? "Back cover"
        : portrait
          ? `Page ${currentPage} of ${lastIndex - 1}`
          : `Pages ${currentPage}–${Math.min(currentPage + 1, lastIndex - 1)} of ${lastIndex - 1}`;

  const hasPages = pages.length > 0;
  const lastPageId = pages[pages.length - 1]?.id;

  return (
    <div className="flex h-screen flex-col bg-cream">
      <header className="flex items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link to="/" className="shrink-0 text-sm text-ink/55 hover:text-ink">
            &larr; <span className="hidden sm:inline">My journals</span>
            <span className="sm:hidden">Journals</span>
          </Link>
          <h1 className={`hidden truncate text-lg text-ink sm:block ${fontClassFor(journal.design.titleFont)}`}>{journal.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {journal.mode === "ongoing" && (
            <Link to={`/journal/${journal.id}/add`} className="rounded-lg bg-sage-dark px-3 py-2 text-sm font-medium text-white transition hover:bg-sage sm:px-4">
              + <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add memory</span>
            </Link>
          )}
          <Link
            to={`/journal/${journal.id}/edit`}
            state={{ pageId: lastPageIdOf(slots, currentPage) }}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4 ${
              journal.mode === "ongoing" ? "border border-ink/15 text-ink/70 hover:bg-white" : "bg-sage-dark text-white hover:bg-sage"
            }`}
          >
            Edit
          </Link>
          <button onClick={() => setSharing(true)} className="rounded-lg border border-ink/15 px-3 py-2 text-sm font-medium text-ink/70 transition hover:bg-white sm:px-4">
            Share
          </button>
          <MoreMenu
            items={[
              ...(isOwner ? [{ label: "Manage pages", to: `/journal/${journal.id}/pages` }] : []),
              ...(journal.mode === "ongoing" ? [] : [{ label: "Add a memory", to: `/journal/${journal.id}/add` }]),
              { label: "Add photos", onClick: () => setAddingPhotos(true) },
              { label: "Turn into a book", to: `/journal/${journal.id}/book` },
              ...(isOwner ? [{ label: "Change cover photo", onClick: () => setCoverOpen(true) }] : []),
              ...(isOwner ? [{ label: "Album settings", to: `/journal/${journal.id}/settings` }] : []),
              ...(isOwner ? [{ label: "Delete album…", onClick: () => setDeleting(true), danger: true }] : []),
            ]}
          />
        </div>
      </header>

      <main ref={areaRef} className="relative min-h-0 flex-1">
        {bookW > 100 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="transition-transform duration-500 ease-out"
              style={{ width: bookW, transform: `translateX(${shiftX}px)` }}
            >
              <BookDepth
                coverColor={journal.design.coverColor}
                open={isOpen && !portrait}
                leftThickness={leftThickness}
                rightThickness={rightThickness}
              >
                <HTMLFlipBook
                  key={portrait ? "portrait" : "landscape"}
                  ref={flipRef}
                  width={600}
                  height={600}
                  size="stretch"
                  minWidth={portrait ? 250 : 100}
                  maxWidth={4000}
                  minHeight={100}
                  maxHeight={4000}
                  showCover
                  usePortrait
                  drawShadow
                  flippingTime={800}
                  maxShadowOpacity={0.45}
                  mobileScrollSupport={false}
                  useMouseEvents
                  clickEventForward
                  swipeDistance={30}
                  showPageCorners={false}
                  disableFlipByClick
                  startPage={currentRef.current}
                  startZIndex={0}
                  autoSize
                  className=""
                  style={{}}
                  onFlip={(e: { data: number }) => {
                    currentRef.current = e.data;
                    setCurrentPage(e.data);
                  }}
                  onChangeState={(e: { data: string }) => setFlipping(e.data === "flipping" || e.data === "user_fold")}
                >
                  {slots.map((slot, i) => (
                    <FlipPage key={slotKey(slot, i)} hard={slot.kind === "cover" || slot.kind === "back"}>
                      {renderSlot(slot, journal, coverUrl, env)}
                    </FlipPage>
                  ))}
                </HTMLFlipBook>
                {!portrait && <Gutter hidden={!isOpen || flipping} />}
              </BookDepth>
            </div>
          </div>
        )}

        {!portrait && (
          <>
            <button
              onClick={goPrev}
              disabled={currentPage === 0}
              aria-label="Previous page"
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg leading-none shadow ring-1 ring-ink/10 transition hover:bg-white disabled:opacity-0"
            >
              &lsaquo;
            </button>
            <button
              onClick={goNext}
              disabled={currentPage >= lastIndex}
              aria-label="Next page"
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg leading-none shadow ring-1 ring-ink/10 transition hover:bg-white disabled:opacity-0"
            >
              &rsaquo;
            </button>
          </>
        )}

        {!hasPages && isOpen === false && currentPage === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            <p className="rounded-full bg-white/90 px-4 py-2 text-sm text-ink/60 shadow">This album has no pages yet.</p>
          </div>
        )}

        {toast && (
          <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
            <div className="flex items-center gap-4 rounded-full bg-ink px-5 py-2.5 text-sm text-cream shadow-lg">
              <span>Added to your album.</span>
              <Link
                to={`/journal/${journal.id}/edit`}
                state={{ pageId: lastPageId }}
                className="font-medium underline underline-offset-2"
              >
                Customize page
              </Link>
              <button onClick={() => setToast(null)} aria-label="Dismiss" className="text-cream/60 hover:text-cream">
                &times;
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="flex items-center justify-center gap-5 px-5 pb-3 text-xs text-ink/45">
        {portrait && (
          <button onClick={goPrev} disabled={currentPage === 0} className="rounded-full px-3 py-1 text-lg leading-none disabled:opacity-20" aria-label="Previous page">
            &lsaquo;
          </button>
        )}
        <span>{pageLabel}</span>
        {portrait && (
          <button onClick={goNext} disabled={currentPage >= lastIndex} className="rounded-full px-3 py-1 text-lg leading-none disabled:opacity-20" aria-label="Next page">
            &rsaquo;
          </button>
        )}
        {navState.fromEdit && (
          <button onClick={() => navigate(`/journal/${journal.id}/edit`, { state: { pageId: lastPageIdOf(slots, currentPage) } })} className="text-sage-dark underline">
            Back to editing
          </button>
        )}
      </footer>

      {sharing && <ShareModal onClose={() => setSharing(false)} />}
      {coverOpen && (
        <CoverModal
          design={journal.design}
          title={journal.title}
          onChange={(design) => void album.updateJournal({ design })}
          onClose={() => setCoverOpen(false)}
        />
      )}
      {deleting && <DeleteAlbumModal onClose={() => setDeleting(false)} />}
      {addingPhotos && (
        <Modal title="Add photos to this album" onClose={() => setAddingPhotos(false)} wide>
          <p className="mb-3 text-sm text-ink/60">Photos go into the album's shared library. They don't appear on a page until someone places them.</p>
          <PhotoLibrary variant="grid" actions />
        </Modal>
      )}
    </div>
  );
}

function lastPageIdOf(slots: Slot[], index: number): string | undefined {
  for (const i of [index, index + 1]) {
    const s = slots[i];
    if (s?.kind === "page") return s.page.id;
  }
  return undefined;
}

function slotKey(slot: Slot, i: number): string {
  if (slot.kind === "page") return `${slot.page.id}-${slot.half ?? "x"}`;
  return `${slot.kind}-${i}`;
}

function renderSlot(slot: Slot, journal: ReturnType<typeof useAlbum>["journal"], coverUrl: string | null, env: ReturnType<typeof useRenderEnv>) {
  switch (slot.kind) {
    case "cover":
      return <JournalCover title={journal.title} design={journal.design} subtitle={journal.subject} fill size="large" coverUrl={coverUrl} />;
    case "back":
      return (
        <div
          className="flex h-full w-full items-end justify-end rounded-lg p-[6%] shadow-md ring-1 ring-black/10"
          style={{ background: `linear-gradient(225deg, rgba(0,0,0,0.12), rgba(255,255,255,0.08)), ${journal.design.coverColor}`, color: getContrastText(journal.design.coverColor) }}
        >
          <span className="font-serif text-xs opacity-60">{journal.title}</span>
        </div>
      );
    case "filler":
      return <BlankPage albumStyle={journal.design.pageStyle} accent={journal.design.accentColor} />;
    case "page":
      return <PageRenderer page={slot.page} half={slot.half} env={env} />;
  }
}
