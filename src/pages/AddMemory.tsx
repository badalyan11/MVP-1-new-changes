import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAlbum } from "../context/AlbumContext";
import { PageHeader } from "../components/PageHeader";
import { PhotoLibrary } from "../components/PhotoLibrary";
import { WritingHelper } from "../components/WritingHelper";
import { Modal } from "../components/Modal";
import { insertPage, makePage } from "../lib/pageOps";
import { newPhotoElement, newTextElement, relayout } from "../lib/pageLayouts";
import type { Page, PageElement, Photo } from "../types";

const field =
  "mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-ink placeholder:text-ink/30 focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage";

/**
 * A quick way to add a memory: any mix of photos and words, all optional.
 * The page is laid out automatically and can be customized afterwards.
 */
export function AddMemory() {
  const { journal, photos, photoUrls, photoById, ensureUrls, commitPages, isOwner, userId } = useAlbum();
  const navigate = useNavigate();
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [date, setDate] = useState("");
  const [showDate, setShowDate] = useState(true);
  const [meta, setMeta] = useState<Page["meta"]>({});

  const context = { mode: journal.mode, journalType: journal.journalType, customTypeDescription: journal.customTypeDescription, subject: journal.subject };
  const hasWords = Boolean(title.trim() || story.trim() || date);
  const canSave = photoIds.length > 0 || hasWords;

  const toggle = (photo: Photo) => {
    ensureUrls([photo.id], "display");
    setPhotoIds((cur) => (cur.includes(photo.id) ? cur.filter((id) => id !== photo.id) : [...cur, photo.id]));
  };

  const save = () => {
    if (!canSave) return;
    const elements: PageElement[] = photoIds
      .map((id) => photoById(id))
      .filter((p): p is Photo => Boolean(p))
      .map((p) => newPhotoElement(p, { x: 10, y: 10, w: 40, h: 40 }));
    if (hasWords) {
      elements.push({ ...newTextElement({ x: 8, y: 74, w: 84, h: 20 }), title: title.trim(), story: story.trim(), date, showDate: Boolean(date) && showDate });
    }
    const page = relayout(makePage({ journalId: journal.id, userId, elements, meta }), photoById);
    commitPages((prev) => insertPage(prev, page, null, isOwner));
    navigate(`/journal/${journal.id}`, { state: { startPageId: page.id, added: "yes" } });
  };

  return (
    <div className="min-h-screen bg-cream pb-16">
      <PageHeader backTo={`/journal/${journal.id}`} backLabel="Back to album" title="Add a memory" />
      <div className="mx-auto max-w-xl px-5 sm:px-0">
        <p className="text-sm text-ink/55">Add photos, words, or both. Every part is optional. You can rearrange it all afterwards.</p>

        <section className="mt-6">
          <p className="text-sm font-medium text-ink/70">Photos</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {photoIds.map((id) => (
              <div key={id} className="group relative h-20 w-20 overflow-hidden rounded-lg bg-beige ring-1 ring-ink/10">
                {photoUrls[id]?.thumb && <img src={photoUrls[id].thumb} alt="" className="h-full w-full object-cover" />}
                <button
                  onClick={() => setPhotoIds((cur) => cur.filter((x) => x !== id))}
                  aria-label="Remove from this memory"
                  className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-white/90 text-sm leading-none text-ink group-hover:flex"
                >
                  &times;
                </button>
              </div>
            ))}
            <button onClick={() => setPicking(true)} className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-ink/15 text-center text-xs text-ink/50 transition hover:border-sage hover:text-ink/70">
              + Photos
            </button>
          </div>
        </section>

        <section className="mt-6">
          <label className="block text-sm font-medium text-ink/70">
            What happened? <span className="font-normal text-ink/40">(optional)</span>
          </label>
          <textarea
            rows={6}
            value={story}
            onChange={(e) => {
              setStory(e.target.value);
              if (meta.aiUsed) setMeta((m) => ({ ...m, aiEdited: true }));
            }}
            placeholder="Just write it how you'd tell a friend. Messy is fine."
            className={`${field} resize-y`}
          />
          <WritingHelper
            text={story}
            context={context}
            originalNote={meta.aiUsed ? meta.roughNote : undefined}
            onUse={(suggestion, original) => {
              setStory(suggestion);
              setMeta({ roughNote: original, aiUsed: true, aiEdited: false });
            }}
            onAppend={(additions) => {
              setStory((s) => (s ? `${s}\n${additions}` : additions));
              setMeta({});
            }}
          />
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-ink/70">
            Title <span className="font-normal text-ink/40">(optional)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </label>
          <div>
            <label className="block text-sm font-medium text-ink/70">
              Date <span className="font-normal text-ink/40">(optional)</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            </label>
            {date && (
              <label className="mt-1.5 flex items-center gap-2 text-xs text-ink/60">
                <input type="checkbox" checked={showDate} onChange={(e) => setShowDate(e.target.checked)} />
                Show the date on the page
              </label>
            )}
          </div>
        </section>

        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={save}
            disabled={!canSave}
            className="rounded-xl bg-sage-dark px-8 py-3 font-medium text-white transition hover:bg-sage disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to album
          </button>
          <button onClick={() => navigate(`/journal/${journal.id}`)} className="text-sm text-ink/55 underline hover:text-ink">
            Cancel
          </button>
        </div>
      </div>

      {picking && (
        <Modal title="Choose photos" onClose={() => setPicking(false)} wide>
          <p className="mb-3 text-sm text-ink/60">
            {photos.length === 0 ? "Add photos to your album first. They'll be saved in its library." : "Pick from your album's photos, or add new ones. New photos are picked for you."}
          </p>
          <PhotoLibrary
            variant="grid"
            selectedIds={new Set(photoIds)}
            onPick={toggle}
            onUploaded={(added) => {
              ensureUrls(added.map((p) => p.id), "display");
              setPhotoIds((cur) => [...cur, ...added.map((p) => p.id).filter((id) => !cur.includes(id))]);
            }}
          />
          <div className="mt-4 flex justify-end">
            <button onClick={() => setPicking(false)} className="rounded-xl bg-sage-dark px-6 py-2.5 text-sm font-medium text-white hover:bg-sage">
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
