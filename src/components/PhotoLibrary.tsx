import { useMemo, useRef, useState, type DragEvent } from "react";
import { useAlbum } from "../context/AlbumContext";
import type { Photo } from "../types";

export const PHOTO_DRAG_TYPE = "application/x-lj-photo";

type Filter = "all" | "unused" | "used";

/**
 * The album's shared photo library. Photos belong to the album; this is just a
 * window onto them. Used by the editor's tray and by the "choose photos" dialogs.
 */
export function PhotoLibrary({
  variant,
  onPick,
  selectedIds,
  draggable = false,
  actions = false,
  emptyHint,
  onUploaded,
}: {
  variant: "tray" | "grid";
  /** Called when a photo is clicked. */
  onPick?: (photo: Photo) => void;
  /** Photos shown with a selection ring (for multi-select dialogs). */
  selectedIds?: Set<string>;
  /** Allow dragging photos out (onto a page). */
  draggable?: boolean;
  /** Show per-photo "use as cover" and delete buttons. */
  actions?: boolean;
  emptyHint?: string;
  /** Called with the photos that were just added to the album. */
  onUploaded?: (photos: Photo[]) => void;
}) {
  const { photos, photoUrls, usedPhotoIds, uploadPhotos, uploadProgress, deletePhoto, setCover, isOwner, userId, journal } = useAlbum();
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const used = photos.filter((p) => usedPhotoIds.has(p.id)).length;
    return { all: photos.length, used, unused: photos.length - used };
  }, [photos, usedPhotoIds]);

  const visible = photos.filter((p) =>
    filter === "all" ? true : filter === "used" ? usedPhotoIds.has(p.id) : !usedPhotoIds.has(p.id)
  );
  const newestFirst = [...visible].reverse();
  const multipleUploaders = new Set(photos.map((p) => p.uploadedBy)).size > 1;

  const handleFiles = async (files: FileList | File[]) => {
    setMessage("");
    const added = await uploadPhotos(Array.from(files));
    if (added.length) onUploaded?.(added);
  };

  const onDropFiles = (e: DragEvent) => {
    setDragOver(false);
    if (e.dataTransfer.files.length > 0 && !e.dataTransfer.types.includes(PHOTO_DRAG_TYPE)) {
      e.preventDefault();
      void handleFiles(e.dataTransfer.files);
    }
  };

  const remove = async (photo: Photo) => {
    const onPage = usedPhotoIds.has(photo.id);
    const ok = window.confirm(
      onPage
        ? "This photo is on a page. Removing it from the album also takes it off that page. Remove it?"
        : "Remove this photo from the album?"
    );
    if (!ok) return;
    try {
      await deletePhoto(photo.id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't remove that photo.");
    }
  };

  const tabs: Array<[Filter, string]> = [
    ["all", "All"],
    ["unused", "Unused"],
    ["used", "Used"],
  ];

  return (
    <div
      className={`flex min-h-0 flex-col ${dragOver ? "rounded-xl ring-2 ring-sage" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDropFiles}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex gap-0.5 rounded-full bg-beige p-0.5 text-xs">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-full px-3 py-1 font-medium transition ${filter === id ? "bg-white text-ink shadow-sm" : "text-ink/55 hover:text-ink"}`}
            >
              {label} <span className="text-ink/40">{counts[id]}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => fileInput.current?.click()}
          className="rounded-full bg-sage-dark px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-sage"
        >
          + Add photos
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          data-testid="photo-upload-input"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {uploadProgress && (
          <span className="text-xs text-ink/60">
            {uploadProgress.done < uploadProgress.total
              ? `Adding photos... ${uploadProgress.done} of ${uploadProgress.total}`
              : uploadProgress.errors.length
                ? `${uploadProgress.total - uploadProgress.errors.length} added, ${uploadProgress.errors.length} couldn't be read`
                : "Photos added"}
          </span>
        )}
        {message && <span className="text-xs text-red-600">{message}</span>}
      </div>

      {uploadProgress?.errors.length ? (
        <p className="mt-1.5 text-xs text-red-600">{uploadProgress.errors[0]}</p>
      ) : null}

      {photos.length === 0 ? (
        <button
          onClick={() => fileInput.current?.click()}
          className="mt-3 rounded-xl border-2 border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/50 transition hover:border-sage hover:text-ink/70"
        >
          {emptyHint ?? "Drop photos here, or click to choose them. They'll wait in your album until you place them."}
        </button>
      ) : visible.length === 0 ? (
        <p className="mt-3 text-sm text-ink/50">{filter === "unused" ? "Every photo is on a page." : "No photos here yet."}</p>
      ) : (
        <div
          className={
            variant === "tray"
              ? "mt-2.5 flex gap-2 overflow-x-auto pb-1"
              : "mt-3 grid min-h-0 grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 overflow-y-auto"
          }
        >
          {newestFirst.map((photo) => {
            const url = photoUrls[photo.id]?.thumb;
            const used = usedPhotoIds.has(photo.id);
            const selected = selectedIds?.has(photo.id);
            const canDelete = isOwner || photo.uploadedBy === userId;
            const isCover = journal.design.coverPhotoId === photo.id;
            return (
              <div
                key={photo.id}
                className={`group relative shrink-0 overflow-hidden rounded-lg bg-beige ${variant === "tray" ? "h-[68px] w-[68px]" : "aspect-square"} ${
                  selected ? "ring-2 ring-sage-dark" : "ring-1 ring-ink/10"
                }`}
              >
                <button
                  type="button"
                  draggable={draggable}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(PHOTO_DRAG_TYPE, photo.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onPick?.(photo)}
                  title={photo.uploaderName && multipleUploaders ? `${photo.filename} · Added by ${photo.uploaderName}` : photo.filename}
                  className="absolute inset-0 cursor-pointer"
                  aria-label={`Photo ${photo.filename}`}
                >
                  {url ? <img src={url} alt="" draggable={false} className="h-full w-full object-cover" /> : null}
                </button>
                {used && (
                  <span className="pointer-events-none absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-sage-dark text-white shadow" title="On a page">
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2.5 6.5l2.2 2.2L9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                {multipleUploaders && photo.uploaderName && (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/55 to-transparent px-1 pb-0.5 pt-3 text-[9px] text-white opacity-0 transition group-hover:opacity-100">
                    {photo.uploaderName}
                  </span>
                )}
                {actions && (
                  <div className="absolute left-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    {isOwner && (
                      <button
                        onClick={() => void setCover(isCover ? null : photo.id)}
                        title={isCover ? "Remove as cover" : "Use as album cover"}
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium shadow ${isCover ? "bg-sage-dark text-white" : "bg-white/90 text-ink"}`}
                      >
                        Cover
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => void remove(photo)}
                        title="Remove from album"
                        className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-red-600 shadow"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
