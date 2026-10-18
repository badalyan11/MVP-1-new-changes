import { useRef } from "react";
import type { JournalDesign } from "../types";
import { useAlbum } from "../context/AlbumContext";
import { JournalCover } from "./JournalCover";
import { Modal } from "./Modal";
import { PhotoLibrary } from "./PhotoLibrary";

/**
 * Put your own photo on the album's cover: pick one from the album's photos or
 * add a new one, then drag the cover to choose which part shows.
 */
export function CoverModal({
  design,
  title,
  onChange,
  onClose,
}: {
  design: JournalDesign;
  title: string;
  onChange: (design: JournalDesign) => void;
  onClose: () => void;
}) {
  const { photoUrls, ensureUrls } = useAlbum();
  const drag = useRef<{ x: number; y: number; fx: number; fy: number; w: number; h: number } | null>(null);
  const url = design.coverPhotoId ? photoUrls[design.coverPhotoId]?.display ?? photoUrls[design.coverPhotoId]?.thumb ?? null : null;

  const choose = (photoId: string) => {
    ensureUrls([photoId], "display");
    onChange({ ...design, coverPhotoId: photoId, coverFocusX: 50, coverFocusY: 50 });
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!url) return;
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { x: e.clientX, y: e.clientY, fx: design.coverFocusX ?? 50, fy: design.coverFocusY ?? 50, w: r.width, h: r.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    // Dragging the picture one way moves the visible part the other way.
    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    onChange({
      ...design,
      coverFocusX: clamp(d.fx - ((e.clientX - d.x) / d.w) * 100),
      coverFocusY: clamp(d.fy - ((e.clientY - d.y) / d.h) * 100),
    });
  };

  return (
    <Modal title="Album cover photo" onClose={onClose} wide>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div>
          <div
            className={`mx-auto w-full max-w-[220px] touch-none ${url ? "cursor-grab active:cursor-grabbing" : ""}`}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            <JournalCover title={title || "Your Journal"} design={design} size="medium" coverUrl={url} />
          </div>
          <p className="mt-2 text-center text-xs text-ink/50">{url ? "Drag the cover to choose which part of the photo shows." : "No cover photo yet."}</p>
          {url && (
            <button
              onClick={() => onChange({ ...design, coverPhotoId: null, coverFocusX: undefined, coverFocusY: undefined })}
              className="mx-auto mt-2 block text-xs text-ink/50 underline hover:text-ink/80"
            >
              Remove the cover photo
            </button>
          )}
          <button onClick={onClose} className="mt-4 w-full rounded-xl bg-sage-dark px-5 py-2.5 text-sm font-medium text-white hover:bg-sage">
            Done
          </button>
        </div>
        <div>
          <p className="mb-3 text-sm text-ink/60">Click a photo from this album, or add a new one. A new photo you add here becomes the cover.</p>
          <PhotoLibrary variant="grid" onPick={(photo) => choose(photo.id)} onUploaded={(added) => added[0] && choose(added[0].id)} />
        </div>
      </div>
    </Modal>
  );
}
