import { useEffect, useMemo, useState } from "react";
import { useAlbum } from "../context/AlbumContext";
import { useRenderEnv } from "../hooks/useRenderEnv";
import { buildSlots } from "../lib/slots";
import { store } from "../lib/store";
import { JournalCover } from "../components/JournalCover";
import { PageHeader } from "../components/PageHeader";
import { BlankPage, PageRenderer } from "../components/PageRenderer";
import { BookDepth, Gutter } from "../components/AlbumBoard";
import type { Slot } from "../lib/slots";

/** A look at the album as a printed keepsake, and a way to say you'd want one. */
export function BookPreview() {
  const { journal, pages, photoUrls } = useAlbum();
  const env = useRenderEnv();
  const [interested, setInterested] = useState<boolean | null>(null);
  const [justClicked, setJustClicked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    store
      .hasBookInterest(journal.id)
      .then(setInterested)
      .catch(() => setInterested(false));
  }, [journal.id]);

  const slots = useMemo(() => buildSlots(pages), [pages]);
  // Up to three inside spreads to show off the real pages.
  const spreads: Array<[Slot, Slot]> = [];
  for (let i = 1; i + 1 < slots.length - 1 && spreads.length < 3; i += 2) spreads.push([slots[i], slots[i + 1]]);

  const coverUrl = journal.design.coverPhotoId ? photoUrls[journal.design.coverPhotoId]?.display ?? photoUrls[journal.design.coverPhotoId]?.thumb ?? null : null;

  const renderSlot = (slot: Slot) =>
    slot.kind === "page" ? <PageRenderer page={slot.page} half={slot.half} env={env} /> : <BlankPage albumStyle={journal.design.pageStyle} accent={journal.design.accentColor} />;

  const express = async () => {
    try {
      await store.markBookInterest(journal.id);
      setJustClicked(true);
      setInterested(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-cream pb-16">
      <PageHeader backTo={`/journal/${journal.id}`} backLabel="Back to album" />
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <h1 className="font-serif text-3xl text-ink">Bring your album to life.</h1>
        <p className="mt-2 text-ink/60">Turn it into a printed keepsake you can hold onto for years.</p>

        <div className="mt-10 grid items-start gap-10 md:grid-cols-[220px_1fr]">
          <div className="mx-auto w-44 md:w-full" style={{ filter: "drop-shadow(8px 10px 12px rgba(40,28,10,0.3))" }}>
            <JournalCover title={journal.title} design={journal.design} size="large" subtitle={journal.subject} coverUrl={coverUrl} />
          </div>

          <div className="space-y-8">
            {spreads.length === 0 ? (
              <p className="text-ink/55">Add a few pages and your book will start taking shape.</p>
            ) : (
              spreads.map(([left, right], i) => (
                <BookDepth key={i} coverColor={journal.design.coverColor} open leftThickness={3} rightThickness={3} padding={8}>
                  <div className="relative grid grid-cols-2">
                    <div className="aspect-square">{renderSlot(left)}</div>
                    <div className="aspect-square">{renderSlot(right)}</div>
                    <Gutter />
                  </div>
                </BookDepth>
              ))
            )}
          </div>
        </div>

        <div className="mt-14 rounded-2xl bg-white/70 p-6 text-center shadow-sm ring-1 ring-ink/5">
          <p className="font-serif text-lg text-ink">Printed albums are coming soon.</p>
          {justClicked ? (
            <p className="mt-3 text-sage-dark">Thanks! We'll let you know when printed albums are ready.</p>
          ) : interested ? (
            <p className="mt-3 text-sage-dark">You're on the list for this one.</p>
          ) : (
            <button
              onClick={() => void express()}
              disabled={interested === null}
              className="mt-4 rounded-xl bg-sage-dark px-6 py-2.5 text-sm font-medium text-white transition hover:bg-sage disabled:opacity-50"
            >
              I'm interested
            </button>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
