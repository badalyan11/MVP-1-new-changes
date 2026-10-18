import { useMemo, useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAlbum } from "../context/AlbumContext";
import { useRenderEnv } from "../hooks/useRenderEnv";
import { buildSlots } from "../lib/slots";
import { duplicatePage, insertPage, makePage, removePage, reorderPages } from "../lib/pageOps";
import { PageRenderer } from "../components/PageRenderer";
import { PageHeader } from "../components/PageHeader";
import type { Page } from "../types";

const PAGE_DRAG = "application/x-lj-page";
const THUMB = 168;

type Tile = { kind: "page"; page: Page; label: string } | { kind: "filler"; key: string; label: string };

/** A bird's-eye view of the whole album: reorder, add, duplicate, or delete pages. */
export function ManagePages() {
  const { journal, pages, isOwner, commitPages, userId, undo, redo, canUndo, canRedo } = useAlbum();
  const env = useRenderEnv();
  const navigate = useNavigate();
  const [overId, setOverId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const tiles = useMemo<Tile[]>(() => {
    const slots = buildSlots(pages);
    const out: Tile[] = [];
    slots.forEach((slot, i) => {
      if (slot.kind === "page" && slot.half !== 1) {
        out.push({ kind: "page", page: slot.page, label: slot.page.span === 2 ? `Pages ${i}–${i + 1}` : `Page ${i}` });
      } else if (slot.kind === "filler" && i < slots.length - 1) {
        out.push({ kind: "filler", key: `filler-${i}`, label: `Page ${i}` });
      }
    });
    return out;
  }, [pages]);

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-cream">
        <PageHeader backTo={`/journal/${journal.id}`} backLabel="Back to album" title="Manage pages" />
        <p className="px-8 py-10 text-ink/60">Only the album's owner can rearrange pages. You can edit the pages you added from the album's Edit screen.</p>
      </div>
    );
  }

  const move = (draggedId: string, targetId: string, after: boolean) => {
    if (draggedId === targetId) return;
    const ids = pages.map((p) => p.id).filter((id) => id !== draggedId);
    const at = ids.indexOf(targetId);
    ids.splice(after ? at + 1 : at, 0, draggedId);
    commitPages((prev) => reorderPages(prev, ids));
  };

  const onDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData(PAGE_DRAG);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setOverId(null);
    setDragId(null);
    if (draggedId) move(draggedId, targetId, e.clientX > rect.left + rect.width / 2);
  };

  const shift = (id: string, dir: -1 | 1) => {
    const idx = pages.findIndex((p) => p.id === id);
    const target = pages[idx + dir];
    if (target) move(id, target.id, dir === 1);
  };

  const addPage = (span: 1 | 2) => {
    const page = makePage({ journalId: journal.id, userId, span });
    commitPages((prev) => insertPage(prev, page, null, true));
  };

  const remove = (page: Page) => {
    if (page.elements.length > 0 && !window.confirm("Delete this page? Its photos stay in the album's library.")) return;
    commitPages((prev) => removePage(prev, page.id));
  };

  return (
    <div className="min-h-screen bg-cream pb-16">
      <PageHeader
        backTo={`/journal/${journal.id}`}
        backLabel="Back to album"
        title="Manage pages"
        right={
          <>
            <button onClick={undo} disabled={!canUndo} className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm text-ink/75 hover:bg-white disabled:opacity-35">
              Undo
            </button>
            <button onClick={redo} disabled={!canRedo} className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm text-ink/75 hover:bg-white disabled:opacity-35">
              Redo
            </button>
            <Link to={`/journal/${journal.id}/edit`} className="rounded-lg bg-sage-dark px-4 py-1.5 text-sm font-medium text-white hover:bg-sage">
              Edit pages
            </Link>
          </>
        }
      />

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-sm text-ink/55">Drag a page to move it. Two-page spreads are shown wide.</p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-8">
          {tiles.map((tile) =>
            tile.kind === "filler" ? (
              <div key={tile.key} style={{ width: THUMB }}>
                <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-ink/20 px-3 text-center text-[11px] text-ink/35">
                  Blank page that keeps the next spread lined up
                </div>
                <p className="mt-1.5 text-xs text-ink/35">{tile.label}</p>
              </div>
            ) : (
              <div
                key={tile.page.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(PAGE_DRAG, tile.page.id);
                  e.dataTransfer.effectAllowed = "move";
                  setDragId(tile.page.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(PAGE_DRAG)) {
                    e.preventDefault();
                    setOverId(tile.page.id);
                  }
                }}
                onDragLeave={() => setOverId((cur) => (cur === tile.page.id ? null : cur))}
                onDrop={(e) => onDrop(e, tile.page.id)}
                className={`group relative cursor-grab transition ${dragId === tile.page.id ? "opacity-40" : ""}`}
                style={{ width: THUMB * tile.page.span }}
              >
                <div
                  className={`relative overflow-hidden rounded-md shadow-sm ring-1 ${overId === tile.page.id ? "ring-2 ring-sage-dark" : "ring-black/10"}`}
                  style={{ aspectRatio: tile.page.span }}
                  onDoubleClick={() => navigate(`/journal/${journal.id}/edit`, { state: { pageId: tile.page.id } })}
                >
                  <PageRenderer page={tile.page} env={env} />
                </div>
                <p className="mt-1.5 text-xs text-ink/50">{tile.label}</p>
                <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <span className="pointer-events-auto mt-2 flex gap-2.5 rounded-full bg-white/95 px-3 py-1 text-[11px] text-ink/70 shadow ring-1 ring-ink/10">
                    <button onClick={() => shift(tile.page.id, -1)} aria-label="Move earlier" className="hover:text-ink">
                      &larr;
                    </button>
                    <button onClick={() => shift(tile.page.id, 1)} aria-label="Move later" className="hover:text-ink">
                      &rarr;
                    </button>
                    <Link to={`/journal/${journal.id}/edit`} state={{ pageId: tile.page.id }} className="hover:text-ink">
                      Edit
                    </Link>
                    <button onClick={() => commitPages((prev) => duplicatePage(prev, tile.page.id, userId))} className="hover:text-ink">
                      Duplicate
                    </button>
                    <button onClick={() => remove(tile.page)} className="text-red-600">
                      Delete
                    </button>
                  </span>
                </div>
              </div>
            )
          )}

          <div className="flex flex-col gap-2" style={{ width: THUMB }}>
            <button onClick={() => addPage(1)} className="flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-ink/15 text-sm text-ink/50 transition hover:border-sage hover:text-ink/70">
              + Add page
            </button>
            <button onClick={() => addPage(2)} className="text-xs text-ink/45 underline hover:text-ink/70">
              Add a two-page spread
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
