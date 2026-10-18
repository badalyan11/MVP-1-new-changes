import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAlbum } from "../context/AlbumContext";
import { DesignPicker } from "../components/DesignPicker";
import { PageHeader } from "../components/PageHeader";
import { CoverModal } from "../components/CoverModal";
import { DeleteAlbumModal } from "../components/DeleteAlbumModal";
import type { JournalDesign } from "../types";

const field =
  "mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-ink focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage";

export function JournalSettings() {
  const { journal, isOwner, photoUrls, updateJournal } = useAlbum();
  const navigate = useNavigate();
  const [title, setTitle] = useState(journal.title);
  const [subject, setSubject] = useState(journal.subject);
  const [dateLabel, setDateLabel] = useState(journal.dateLabel);
  const [design, setDesign] = useState<JournalDesign>(journal.design);
  const [pickingCover, setPickingCover] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isOwner) return <Navigate to={`/journal/${journal.id}`} replace />;

  const coverUrl = design.coverPhotoId ? photoUrls[design.coverPhotoId]?.display ?? photoUrls[design.coverPhotoId]?.thumb ?? null : null;

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await updateJournal({ title: title.trim() || journal.title, subject: subject.trim(), dateLabel: dateLabel.trim(), design });
      navigate(`/journal/${journal.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your changes.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream pb-16">
      <PageHeader backTo={`/journal/${journal.id}`} backLabel="Back to album" title="Album settings" />
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="space-y-5">
          <label className="block text-sm font-medium text-ink/70">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </label>
          <label className="block text-sm font-medium text-ink/70">
            Who or what is it about? <span className="font-normal text-ink/40">(optional)</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={field} />
          </label>
          {journal.mode === "experience" && (
            <label className="block text-sm font-medium text-ink/70">
              When was this? <span className="font-normal text-ink/40">(optional)</span>
              <input value={dateLabel} onChange={(e) => setDateLabel(e.target.value)} placeholder="June 2026" className={field} />
            </label>
          )}
          <div>
            <p className="text-sm font-medium text-ink/70">Design</p>
            <div className="mt-3">
              <DesignPicker
                title={title}
                journalType={journal.journalType}
                value={design}
                onChange={setDesign}
                coverUrl={coverUrl}
                onPickCover={() => setPickingCover(true)}
                onClearCover={() => setDesign((d) => ({ ...d, coverPhotoId: null, coverFocusX: undefined, coverFocusY: undefined }))}
              />
            </div>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => setDeleting(true)} disabled={busy} className="rounded-xl border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50">
            Delete this album
          </button>
          <button onClick={() => void save()} disabled={busy} className="rounded-xl bg-sage-dark px-8 py-3 font-medium text-white transition hover:bg-sage disabled:opacity-60">
            {busy ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {pickingCover && <CoverModal design={design} title={title} onChange={setDesign} onClose={() => setPickingCover(false)} />}
      {deleting && <DeleteAlbumModal onClose={() => setDeleting(false)} />}
    </div>
  );
}
