import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAlbum } from "../context/AlbumContext";
import { store } from "../lib/store";
import { Modal } from "./Modal";

/** Permanently delete the album. The owner has to type its name to confirm. */
export function DeleteAlbumModal({ onClose }: { onClose: () => void }) {
  const { journal, pages, photos } = useAlbum();
  const navigate = useNavigate();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const name = journal.title.trim();
  const matches = typed.trim().toLowerCase() === name.toLowerCase();
  const contentPages = pages.filter((p) => p.elements.length > 0).length;

  const remove = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setError("");
    try {
      await store.deleteJournal(journal.id);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this album.");
      setBusy(false);
    }
  };

  return (
    <Modal title="Delete this album?" onClose={busy ? () => {} : onClose}>
      <p className="text-sm text-ink/80">
        <span className="font-medium">&ldquo;{name}&rdquo;</span> will be deleted for good, for you and for everyone it's shared with.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink/65">
        <li>
          {contentPages} {contentPages === 1 ? "page" : "pages"} with content
        </li>
        <li>
          {photos.length} {photos.length === 1 ? "photo" : "photos"}, including the original files
        </li>
        <li>Its collaborators and invite links</li>
      </ul>
      <p className="mt-3 text-sm font-medium text-red-600">This can't be undone.</p>

      <label className="mt-4 block text-sm text-ink/70">
        To confirm, type the album's name: <span className="font-medium text-ink">{name}</span>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void remove()}
          autoFocus
          autoComplete="off"
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-ink focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
        />
      </label>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex justify-end gap-3">
        <button onClick={onClose} disabled={busy} className="rounded-xl border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink/70 hover:bg-white disabled:opacity-50">
          Keep my album
        </button>
        <button
          onClick={() => void remove()}
          disabled={!matches || busy}
          className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Deleting..." : "Delete forever"}
        </button>
      </div>
    </Modal>
  );
}
