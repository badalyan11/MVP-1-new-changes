import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAlbum } from "../context/AlbumContext";
import { useRenderEnv } from "../hooks/useRenderEnv";
import { useElementSize } from "../hooks/useElementSize";
import { useClickOutside } from "../hooks/useClickOutside";
import { buildSlots, buildSpreads, type Slot } from "../lib/slots";
import {
  addPhotoToPage,
  addTextToPage,
  applyLayout,
  convertSpan,
  removeElement,
  suggestLayouts,
  textElementOf,
} from "../lib/pageLayouts";
import { arrangePhotos } from "../lib/arrange";
import { insertPage, makePage, removePage, duplicatePage } from "../lib/pageOps";
import { PAGE_STYLE_DEFS, getPageStyle } from "../lib/pageStyles";
import { boxAspect, defaultPan } from "../lib/crop";
import { BookDepth, Gutter } from "../components/AlbumBoard";
import { PageBackground } from "../components/PageBackground";
import { LayoutThumb } from "../components/LayoutThumb";
import { PhotoLibrary } from "../components/PhotoLibrary";
import { PageCanvas, EmptySlot, type CommitOptions } from "../components/editor/PageCanvas";
import { TextPanel } from "../components/editor/TextPanel";
import { fontClassFor } from "../lib/journalTypes";
import type { Page, PageElement, Photo, TextElement } from "../types";

interface ViewItem {
  page: Page | null;
  span: 1 | 2;
}
interface View {
  key: string;
  items: ViewItem[];
  across: number;
  label: string;
}

type Menu = "layout" | "style" | "page" | null;

function buildViews(slots: Slot[], pages: Page[], narrow: boolean): View[] {
  if (narrow) {
    return pages.map((p, i) => ({ key: p.id, items: [{ page: p, span: p.span }], across: p.span, label: `Page ${i + 1} of ${pages.length}` }));
  }
  return buildSpreads(slots).map((s) => {
    const label = `Pages ${s.slotIndex}–${s.slotIndex + 1}`;
    if (s.left.kind === "page" && s.left.half === 0) {
      return { key: s.left.page.id, items: [{ page: s.left.page, span: 2 as const }], across: 2, label };
    }
    const item = (slot: Slot): ViewItem => (slot.kind === "page" ? { page: slot.page, span: 1 } : { page: null, span: 1 });
    return { key: `slot-${s.slotIndex}`, items: [item(s.left), item(s.right)], across: 2, label };
  });
}

const toolbarBtn =
  "rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/75 transition hover:bg-white disabled:opacity-35 disabled:hover:bg-transparent";

export function AlbumEditor() {
  const album = useAlbum();
  const { journal, pages, photos, usedPhotoIds, commitPages, undo, redo, canUndo, canRedo, saveState, saveError, retrySave, isOwner, userId, photoById, ensureUrls, canEditPage, uploadPhotos, uploadProgress, memberName } = album;
  const env = useRenderEnv();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state ?? {}) as { pageId?: string; welcome?: boolean };

  const areaRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const { width: areaW, height: areaH } = useElementSize(areaRef);
  const narrow = areaW > 0 && areaW < 760;

  const [activePageId, setActivePageId] = useState<string | null>(navState.pageId ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [trayOpen, setTrayOpen] = useState(true);
  const [menu, setMenu] = useState<Menu>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(Boolean(navState.welcome));
  const [justUploaded, setJustUploaded] = useState(false);
  const [dropHover, setDropHover] = useState(false);

  useClickOutside(toolbarRef, menu !== null, () => setMenu(null));

  const slots = useMemo(() => buildSlots(pages), [pages]);
  const views = useMemo(() => buildViews(slots, pages, narrow), [slots, pages, narrow]);

  const firstPage = pages[0] ?? null;
  const activePage = pages.find((p) => p.id === activePageId) ?? firstPage;
  const viewIndex = Math.max(0, activePage ? views.findIndex((v) => v.items.some((i) => i.page?.id === activePage.id)) : 0);
  const view: View | undefined = views[viewIndex];

  const pad = 30;
  const across = view?.across ?? 2;
  const px = Math.floor(Math.max(120, Math.min((areaW - pad * 2) / across, areaH - pad * 2 - 20)));

  const lookup = photoById;
  const unusedPhotos = useMemo(() => photos.filter((p) => !usedPhotoIds.has(p.id)), [photos, usedPhotoIds]);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 6000);
  }, []);

  // Photos on pages should be sharp.
  useEffect(() => {
    const ids = new Set<string>();
    for (const p of pages) for (const e of p.elements) if (e.type === "photo") ids.add(e.photoId);
    ensureUrls([...ids], "display");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  // Drop a selection that no longer exists (after undo, delete, etc.).
  useEffect(() => {
    if (selectedId && !pages.some((p) => p.elements.some((e) => e.id === selectedId))) {
      setSelectedId(null);
      setCropMode(false);
    }
  }, [pages, selectedId]);

  useEffect(() => {
    if (narrow) setTrayOpen(false);
  }, [narrow]);

  // ---------- editing helpers ----------
  const mutate = useCallback(
    (pageId: string, fn: (p: Page) => Page, opts?: { coalesce?: string }) => {
      commitPages((prev) => prev.map((p) => (p.id === pageId ? fn(p) : p)), opts);
    },
    [commitPages]
  );

  const select = (id: string | null) => {
    if (id !== selectedId) setCropMode(false);
    setSelectedId(id);
  };

  const commitElements = (page: Page) => (elements: PageElement[], opts?: CommitOptions) => {
    mutate(page.id, (p) => ({ ...p, elements, autoLayout: opts?.manual ? false : p.autoLayout }), opts?.coalesce ? { coalesce: opts.coalesce } : undefined);
  };

  const dropPhoto = (page: Page) => (photoId: string, at: { x: number; y: number }, targetId?: string) => {
    const photo = photoById(photoId);
    if (!photo) return;
    ensureUrls([photoId], "display");
    setActivePageId(page.id);
    if (targetId) {
      mutate(page.id, (p) => ({
        ...p,
        elements: p.elements.map((e) => {
          if (e.id !== targetId || e.type !== "photo") return e;
          const pan = defaultPan(photo.width / photo.height, boxAspect(e.w, e.h));
          return { ...e, photoId, zoom: 1, panX: pan.panX, panY: pan.panY, userCrop: false };
        }),
      }));
    } else {
      mutate(page.id, (p) => addPhotoToPage(p, photo, lookup, at));
    }
  };

  const removeEl = (page: Page) => (elementId: string) => {
    mutate(page.id, (p) => removeElement(p, elementId, lookup));
    setSelectedId(null);
    setCropMode(false);
  };

  const addPhotoFromTray = (photo: Photo) => {
    ensureUrls([photo.id], "display");
    if (!activePage) {
      const page = addPhotoToPage(makePage({ journalId: journal.id, userId }), photo, lookup);
      commitPages((prev) => insertPage(prev, page, null, isOwner));
      setActivePageId(page.id);
      return;
    }
    if (!canEditPage(activePage)) {
      flash("This page was added by someone else. You can change pages you added.");
      return;
    }
    mutate(activePage.id, (p) => addPhotoToPage(p, photo, lookup));
  };

  const addPage = (span: 1 | 2 = 1) => {
    const page = makePage({ journalId: journal.id, userId, span });
    commitPages((prev) => insertPage(prev, page, activePage?.id ?? null, isOwner));
    setActivePageId(page.id);
    setSelectedId(null);
    setMenu(null);
  };

  const deleteActivePage = () => {
    if (!activePage) return;
    if (!canEditPage(activePage)) return;
    const hasContent = activePage.elements.length > 0;
    if (hasContent && !window.confirm("Delete this page? The photos stay in your album's library.")) return;
    const idx = pages.findIndex((p) => p.id === activePage.id);
    const neighbor = pages[idx + 1] ?? pages[idx - 1] ?? null;
    commitPages((prev) => removePage(prev, activePage.id));
    setActivePageId(neighbor?.id ?? null);
    setSelectedId(null);
    setMenu(null);
  };

  const addText = () => {
    if (!activePage || !canEditPage(activePage)) return;
    const next = addTextToPage(activePage, lookup);
    mutate(activePage.id, () => next);
    setSelectedId(textElementOf(next)?.id ?? null);
    setMenu(null);
  };

  const chooseLayout = (layoutId: string) => {
    if (!activePage) return;
    const def = suggestLayouts(activePage, lookup).find((l) => l.id === layoutId);
    if (!def) return;
    mutate(activePage.id, (p) => ({ ...applyLayout(p, def, lookup), autoLayout: true }));
    setMenu(null);
  };

  const chooseStyle = (styleId: string) => {
    if (!activePage) return;
    mutate(activePage.id, (p) => ({ ...p, style: styleId === journal.design.pageStyle ? null : (styleId as Page["style"]) }));
  };

  const styleWholeAlbum = async () => {
    if (!activePage) return;
    const styleId = getPageStyle(activePage.style ?? journal.design.pageStyle).id;
    commitPages((prev) => prev.map((p) => (p.style ? { ...p, style: null } : p)));
    await album.updateJournal({ design: { ...journal.design, pageStyle: styleId } });
    setMenu(null);
    flash("Every page now uses this style.");
  };

  const toggleSpan = () => {
    if (!activePage || !canEditPage(activePage)) return;
    mutate(activePage.id, (p) => convertSpan(p, p.span === 1 ? 2 : 1, lookup));
    setMenu(null);
  };

  const duplicate = () => {
    if (!activePage) return;
    commitPages((prev) => duplicatePage(prev, activePage.id, userId));
    setMenu(null);
  };

  const arrange = () => {
    if (unusedPhotos.length === 0) return;
    const created = arrangePhotos({ photos: unusedPhotos, journalId: journal.id, userId, lookup });
    ensureUrls(unusedPhotos.map((p) => p.id), "display");
    commitPages((prev) => {
      const last = prev.reduce((m, p) => Math.max(m, p.position), 0);
      return [...prev, ...created.map((p, i) => ({ ...p, position: last + 1 + i }))];
    });
    setActivePageId(created[0]?.id ?? null);
    setJustUploaded(false);
    flash(`Arranged ${unusedPhotos.length} photos onto ${created.length} pages. Change anything you like, or press Undo.`);
  };

  const goTo = (index: number) => {
    const target = views[index];
    const first = target?.items.find((i) => i.page)?.page;
    if (first) {
      setActivePageId(first.id);
      setSelectedId(null);
      setCropMode(false);
    }
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const page = pages.find((p) => p.elements.some((el) => el.id === selectedId));
        if (page && canEditPage(page)) {
          e.preventDefault();
          mutate(page.id, (p) => removeElement(p, selectedId, lookup));
          setSelectedId(null);
        }
      } else if (e.key === "Escape") {
        if (cropMode) setCropMode(false);
        else setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- selection ----------
  const selectedPage = selectedId ? pages.find((p) => p.elements.some((e) => e.id === selectedId)) ?? null : null;
  const selectedText = selectedPage ? (selectedPage.elements.find((e) => e.id === selectedId && e.type === "text") as TextElement | undefined) : undefined;
  const writingContext = { mode: journal.mode, journalType: journal.journalType, customTypeDescription: journal.customTypeDescription, subject: journal.subject };

  const updateText = (page: Page, el: TextElement) => (patch: Partial<TextElement>, meta?: Partial<Page["meta"]>) => {
    mutate(
      page.id,
      (p) => ({
        ...p,
        elements: p.elements.map((e) => (e.id === el.id ? ({ ...e, ...patch } as PageElement) : e)),
        meta: meta ? { ...p.meta, ...meta } : p.meta,
      }),
      { coalesce: `text:${el.id}` }
    );
  };

  // ---------- upload (welcome) ----------
  const handleWelcomeFiles = async (files: FileList | File[]) => {
    const added = await uploadPhotos(Array.from(files));
    if (added.length > 0) {
      setShowWelcome(false);
      setJustUploaded(true);
      setTrayOpen(true);
    }
  };

  const onWelcomeDrop = (e: DragEvent) => {
    e.preventDefault();
    setDropHover(false);
    if (e.dataTransfer.files.length) void handleWelcomeFiles(e.dataTransfer.files);
  };

  const canEditActive = activePage ? canEditPage(activePage) : true;
  const suggestions = activePage ? suggestLayouts(activePage, lookup) : [];
  const activePhotoCount = activePage ? activePage.elements.filter((e) => e.type === "photo").length : 0;
  const activeHasText = activePage ? Boolean(textElementOf(activePage)) : false;
  const activeStyleId = activePage ? getPageStyle(activePage.style ?? journal.design.pageStyle).id : journal.design.pageStyle;

  const progress = views.length > 1 ? viewIndex / (views.length - 1) : 0;

  const saveLabel = saveState === "saving" ? "Saving..." : saveState === "error" ? "Couldn't save" : "All changes saved";

  return (
    <div className="flex h-screen flex-col bg-cream">
      <header ref={toolbarRef} className="relative z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink/10 bg-cream px-4 py-2.5 sm:px-6">
        <Link to={`/journal/${journal.id}`} className="shrink-0 text-sm text-ink/55 hover:text-ink">
          &larr; Back to album
        </Link>
        <span className={`hidden min-w-0 truncate text-base text-ink md:block ${fontClassFor(journal.design.titleFont)}`}>{journal.title}</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={undo} disabled={!canUndo} className={toolbarBtn} aria-label="Undo" title="Undo (Ctrl/Cmd+Z)">
            Undo
          </button>
          <button onClick={redo} disabled={!canRedo} className={toolbarBtn} aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)">
            Redo
          </button>
          <span className="mx-1 hidden h-5 w-px bg-ink/10 sm:block" />

          <div className="relative">
            <button onClick={() => setMenu(menu === "layout" ? null : "layout")} disabled={!activePage || !canEditActive} className={toolbarBtn}>
              Layout
            </button>
            {menu === "layout" && activePage && (
              <div className="absolute right-0 top-full z-40 mt-2 w-[19rem] rounded-xl bg-white p-3 shadow-xl ring-1 ring-ink/10">
                <p className="text-xs text-ink/50">
                  Suggestions for {activePhotoCount === 0 ? "a page with no photos" : `${activePhotoCount} photo${activePhotoCount === 1 ? "" : "s"}`}. Your photos and words stay put.
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {suggestions.map((def) => (
                    <button
                      key={def.id}
                      onClick={() => chooseLayout(def.id)}
                      title={def.label}
                      className={`flex flex-col items-center gap-1 rounded-lg p-2 text-[10px] leading-tight text-ink/60 transition hover:bg-beige ${
                        activePage.layoutId === def.id ? "bg-beige ring-1 ring-sage-dark" : ""
                      }`}
                    >
                      <LayoutThumb def={def} photoCount={activePhotoCount} hasText={activeHasText} />
                      <span className="line-clamp-2 text-center">{def.label}</span>
                    </button>
                  ))}
                  {suggestions.length === 0 && <p className="col-span-3 text-xs text-ink/45">Add a photo or some words to see layouts.</p>}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => setMenu(menu === "style" ? null : "style")} disabled={!activePage || !canEditActive} className={toolbarBtn}>
              Page style
            </button>
            {menu === "style" && activePage && (
              <div className="absolute right-0 top-full z-40 mt-2 w-[19rem] rounded-xl bg-white p-3 shadow-xl ring-1 ring-ink/10">
                <div className="grid grid-cols-4 gap-2.5">
                  {PAGE_STYLE_DEFS.map((s) => (
                    <button key={s.id} onClick={() => chooseStyle(s.id)} className="text-left" title={s.label}>
                      <div className={`relative aspect-square overflow-hidden rounded-md ring-2 ${activeStyleId === s.id ? "ring-sage-dark" : "ring-ink/10"}`}>
                        <PageBackground styleId={s.id} accent={journal.design.accentColor} />
                      </div>
                      <p className="mt-1 text-[10px] leading-tight text-ink/55">{s.label}</p>
                    </button>
                  ))}
                </div>
                {isOwner && (
                  <button onClick={() => void styleWholeAlbum()} className="mt-3 text-xs text-sage-dark underline">
                    Use this style for every page
                  </button>
                )}
              </div>
            )}
          </div>

          <button onClick={addText} disabled={!activePage || !canEditActive || Boolean(activePage && textElementOf(activePage))} className={toolbarBtn}>
            + Words
          </button>

          <div className="relative">
            <button onClick={() => setMenu(menu === "page" ? null : "page")} className={toolbarBtn}>
              Page &#9662;
            </button>
            {menu === "page" && (
              <div className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-ink/10">
                {[
                  { label: "Add a page after this one", onClick: () => addPage(1), show: true },
                  { label: "Add a two-page spread", onClick: () => addPage(2), show: true },
                  { label: activePage?.span === 2 ? "Back to one page" : "Stretch across two pages", onClick: toggleSpan, show: Boolean(activePage) && canEditActive },
                  { label: "Duplicate this page", onClick: duplicate, show: Boolean(activePage) && isOwner },
                  { label: "Manage all pages", onClick: () => navigate(`/journal/${journal.id}/pages`), show: isOwner },
                  { label: "Delete this page", onClick: deleteActivePage, show: Boolean(activePage) && canEditActive, danger: true },
                ]
                  .filter((i) => i.show)
                  .map((item) => (
                    <button
                      key={item.label}
                      onClick={item.onClick}
                      className={`block w-full px-4 py-2 text-left text-sm hover:bg-beige ${item.danger ? "text-red-600" : "text-ink/80"}`}
                    >
                      {item.label}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate(`/journal/${journal.id}`, { state: { startPageId: activePage?.id, fromEdit: true } })}
            className="rounded-lg bg-sage-dark px-4 py-1.5 text-sm font-medium text-white transition hover:bg-sage"
          >
            Preview
          </button>
          <button
            onClick={saveState === "error" ? retrySave : undefined}
            title={saveError ?? undefined}
            className={`hidden text-xs sm:block ${saveState === "error" ? "text-red-600 underline" : "text-ink/40"}`}
          >
            {saveLabel}
          </button>
        </div>
      </header>

      {justUploaded && unusedPhotos.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-b border-sage/30 bg-[#EEF1E8] px-4 py-2 text-sm text-ink/70">
          <span>{unusedPhotos.length} photos are waiting in your album.</span>
          <button onClick={arrange} className="font-medium text-sage-dark underline underline-offset-2">
            Arrange for me
          </button>
          <button onClick={() => setJustUploaded(false)} className="text-ink/50 underline underline-offset-2">
            I'll place them myself
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <main ref={areaRef} className="relative min-w-0 flex-1">
          {view && px > 100 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <BookDepth
                coverColor={journal.design.coverColor}
                open={!narrow}
                leftThickness={2 + progress * 9}
                rightThickness={2 + (1 - progress) * 9}
              >
                <div className="relative flex" style={{ gap: narrow ? 0 : 4, background: narrow ? undefined : "rgba(40,28,10,0.5)" }}>
                  {view.items.map((item, i) =>
                    item.page ? (
                      <PageCanvas
                        key={item.page.id}
                        page={item.page}
                        env={env}
                        px={px}
                        editable={canEditPage(item.page)}
                        active={view.across === 2 && item.page.id === activePage?.id}
                        selectedId={item.page.elements.some((e) => e.id === selectedId) ? selectedId : null}
                        cropMode={cropMode}
                        lockedLabel={canEditPage(item.page) ? undefined : `Added by ${memberName(item.page.createdBy) ?? "another member"}`}
                        onSelect={select}
                        onActivate={() => setActivePageId(item.page!.id)}
                        onCommit={commitElements(item.page)}
                        onToggleCrop={() => setCropMode((c) => !c)}
                        onDropPhoto={dropPhoto(item.page)}
                        onRemoveElement={removeEl(item.page)}
                      />
                    ) : (
                      <EmptySlot key={`blank-${i}`} px={px} label="A blank page keeps the next spread lined up." />
                    )
                  )}
                  {!narrow && view.across === 2 && <Gutter />}
                </div>
              </BookDepth>

              <div className="mt-7 flex items-center gap-4 text-xs text-ink/50">
                <button onClick={() => goTo(viewIndex - 1)} disabled={viewIndex <= 0} className="rounded-full px-2.5 py-1 text-lg leading-none hover:bg-white disabled:opacity-20" aria-label="Previous pages">
                  &lsaquo;
                </button>
                <span>{view.label}</span>
                <button onClick={() => goTo(viewIndex + 1)} disabled={viewIndex >= views.length - 1} className="rounded-full px-2.5 py-1 text-lg leading-none hover:bg-white disabled:opacity-20" aria-label="Next pages">
                  &rsaquo;
                </button>
                <button onClick={() => addPage(1)} className="ml-2 rounded-full border border-ink/15 px-3 py-1 hover:bg-white">
                  + Add page
                </button>
              </div>
            </div>
          ) : pages.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <p className="font-serif text-lg text-ink">This album has no pages yet.</p>
              <button onClick={() => addPage(1)} className="rounded-xl bg-sage-dark px-5 py-2.5 text-sm font-medium text-white hover:bg-sage">
                Add the first page
              </button>
            </div>
          ) : null}

          {showWelcome && photos.length === 0 && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-cream/90 p-6">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropHover(true);
                }}
                onDragLeave={() => setDropHover(false)}
                onDrop={onWelcomeDrop}
                className={`w-full max-w-lg rounded-2xl border-2 border-dashed bg-white/80 p-8 text-center transition ${dropHover ? "border-sage-dark" : "border-ink/15"}`}
              >
                <p className="font-serif text-2xl text-ink">Bring in your photos</p>
                <p className="mt-2 text-sm text-ink/60">
                  Add as many as you like at once. They'll wait in your album's photo library, and you decide where each one goes. Or let us make a first arrangement.
                </p>
                <label className="mt-6 inline-block cursor-pointer rounded-xl bg-sage-dark px-6 py-3 text-sm font-medium text-white transition hover:bg-sage">
                  Choose photos
                  <input type="file" accept="image/*" multiple className="hidden" data-testid="welcome-upload-input" onChange={(e) => e.target.files && void handleWelcomeFiles(e.target.files)} />
                </label>
                <p className="mt-3 text-xs text-ink/40">or drop them here</p>
                {uploadProgress && uploadProgress.done < uploadProgress.total && (
                  <p className="mt-4 text-sm text-ink/60">Adding photos... {uploadProgress.done} of {uploadProgress.total}</p>
                )}
                <button onClick={() => setShowWelcome(false)} className="mt-5 text-xs text-ink/45 underline">
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {toast && (
            <div className="absolute inset-x-0 bottom-3 z-30 flex justify-center px-4">
              <div className="flex items-center gap-4 rounded-full bg-ink px-5 py-2.5 text-sm text-cream shadow-lg">
                <span>{toast}</span>
                {canUndo && toast.startsWith("Arranged") && (
                  <button onClick={undo} className="font-medium underline underline-offset-2">
                    Undo
                  </button>
                )}
              </div>
            </div>
          )}
        </main>

        {selectedText && selectedPage && !narrow && canEditPage(selectedPage) && (
          <TextPanel
            page={selectedPage}
            el={selectedText}
            context={writingContext}
            onChange={updateText(selectedPage, selectedText)}
            onClose={() => setSelectedId(null)}
            onDelete={() => removeEl(selectedPage)(selectedText.id)}
          />
        )}
      </div>

      {selectedText && selectedPage && narrow && canEditPage(selectedPage) && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[65vh] overflow-y-auto rounded-t-2xl shadow-2xl">
          <TextPanel
            page={selectedPage}
            el={selectedText}
            context={writingContext}
            onChange={updateText(selectedPage, selectedText)}
            onClose={() => setSelectedId(null)}
            onDelete={() => removeEl(selectedPage)(selectedText.id)}
          />
        </div>
      )}

      <section className="border-t border-ink/10 bg-white/50">
        <div className="flex items-center justify-between gap-3 px-4 py-1.5 sm:px-6">
          <button onClick={() => setTrayOpen((o) => !o)} className="flex items-center gap-2 text-sm font-medium text-ink/75" aria-expanded={trayOpen}>
            <span className={`inline-block transition ${trayOpen ? "rotate-90" : ""}`}>&#9656;</span>
            Photos <span className="font-normal text-ink/40">{photos.length}</span>
          </button>
          {unusedPhotos.length >= 2 && (
            <button onClick={arrange} className="rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink/70 transition hover:bg-white" title="Make a starting arrangement from the photos you haven't used yet">
              Arrange for me
            </button>
          )}
        </div>
        {trayOpen && (
          <div className="px-4 pb-2 sm:px-6">
            <PhotoLibrary variant="tray" draggable actions onPick={addPhotoFromTray} />
            <p className="mt-1 text-[11px] text-ink/35">Drag a photo onto a page, or click it to add it to the page you're on.</p>
          </div>
        )}
      </section>
    </div>
  );
}
