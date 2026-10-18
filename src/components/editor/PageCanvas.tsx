import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Page, PageElement, PhotoElement, TextElement } from "../../types";
import { CanvasFrame, PhotoView, TextView, type RenderEnv } from "../PageRenderer";
import { PageBackground } from "../PageBackground";
import { PHOTO_DRAG_TYPE } from "../PhotoLibrary";
import { boxAspect, clamp, coverBox, isLowResolution } from "../../lib/crop";

type Handle = "nw" | "ne" | "sw" | "se";

interface Gesture {
  kind: "move" | "resize" | "pan";
  id: string;
  handle?: Handle;
  startX: number;
  startY: number;
  start: PageElement;
  shift: boolean;
  moved: boolean;
}

export interface CommitOptions {
  /** True when the person arranged something by hand (turns off automatic layout). */
  manual?: boolean;
  coalesce?: string;
}

const MIN_SIZE = 6;
const SNAP = 1.3;

function snap(value: number, size: number, max: number): number {
  for (const target of [0, (max - size) / 2, max - size]) {
    if (Math.abs(value - target) < SNAP) return target;
  }
  return value;
}

const btn =
  "flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium text-ink/80 transition hover:bg-beige";

function IconTrash() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8" />
    </svg>
  );
}
function IconCrop() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 1.5v9h9M1.5 4.5h9v9" />
    </svg>
  );
}
function IconFrame() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <rect x="4.5" y="4.5" width="7" height="7" />
    </svg>
  );
}

/**
 * One page (or spread) that can be edited directly: click a photo or the text
 * to select it, drag to move, drag a corner to resize, crop and zoom a photo
 * in place, or drop a photo here from the album's library.
 */
export function PageCanvas({
  page,
  env,
  px,
  editable,
  active,
  selectedId,
  cropMode,
  lockedLabel,
  onSelect,
  onActivate,
  onCommit,
  onToggleCrop,
  onDropPhoto,
  onRemoveElement,
}: {
  page: Page;
  env: RenderEnv;
  /** Pixel size of ONE page. A spread canvas is twice as wide. */
  px: number;
  editable: boolean;
  active: boolean;
  selectedId: string | null;
  cropMode: boolean;
  lockedLabel?: string;
  onSelect: (id: string | null) => void;
  onActivate: () => void;
  onCommit: (elements: PageElement[], opts?: CommitOptions) => void;
  onToggleCrop: () => void;
  onDropPhoto: (photoId: string, at: { x: number; y: number }, targetId?: string) => void;
  onRemoveElement: (id: string) => void;
}) {
  const span = page.span;
  const width = px * span;
  const height = px;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<PageElement[] | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const elements = draft ?? page.elements;
  const selected = elements.find((e) => e.id === selectedId) ?? null;

  const latest = useRef({ page, width, height, env, onCommit });
  latest.current = { page, width, height, env, onCommit };

  const startGesture = (e: ReactPointerEvent, el: PageElement, kind: Gesture["kind"], handle?: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    onActivate();
    onSelect(el.id);
    if (!editable) return;

    const g: Gesture = { kind, id: el.id, handle, startX: e.clientX, startY: e.clientY, start: el, shift: e.shiftKey, moved: false };
    let result: PageElement[] | null = null;

    const move = (ev: PointerEvent) => {
      const { page: p, width: w, height: h, env: envNow } = latest.current;
      const dxPx = ev.clientX - g.startX;
      const dyPx = ev.clientY - g.startY;
      if (!g.moved && Math.abs(dxPx) + Math.abs(dyPx) < 3) return;
      g.moved = true;
      const ux = (dxPx / w) * (100 * p.span);
      const uy = (dyPx / h) * 100;
      const base = g.start;
      const canvasW = 100 * p.span;
      let next: PageElement = base;

      if (g.kind === "move") {
        next = {
          ...base,
          x: snap(clamp(base.x + ux, 0, canvasW - base.w), base.w, canvasW),
          y: snap(clamp(base.y + uy, 0, 100 - base.h), base.h, 100),
        };
      } else if (g.kind === "resize" && g.handle) {
        let { x, y, w: bw, h: bh } = base;
        const right = base.x + base.w;
        const bottom = base.y + base.h;
        if (g.handle.includes("e")) bw = clamp(base.w + ux, MIN_SIZE, canvasW - base.x);
        if (g.handle.includes("w")) {
          x = clamp(base.x + ux, 0, right - MIN_SIZE);
          bw = right - x;
        }
        if (g.handle.includes("s")) bh = clamp(base.h + uy, MIN_SIZE, 100 - base.y);
        if (g.handle.includes("n")) {
          y = clamp(base.y + uy, 0, bottom - MIN_SIZE);
          bh = bottom - y;
        }
        if (ev.shiftKey && base.type === "photo") {
          const ratio = base.w / base.h;
          bh = bw / ratio;
          if (g.handle.includes("n")) y = bottom - bh;
        }
        next = { ...base, x, y, w: bw, h: bh };
      } else if (g.kind === "pan" && base.type === "photo") {
        const photo = envNow.photoById(base.photoId);
        if (photo) {
          const boxW = (base.w / canvasW) * w;
          const boxH = (base.h / 100) * h;
          const box = coverBox(photo.width / photo.height, boxAspect(base.w, base.h), base.zoom, base.panX, base.panY);
          const overflowX = boxW - (box.widthPct / 100) * boxW;
          const overflowY = boxH - (box.heightPct / 100) * boxH;
          next = {
            ...base,
            panX: Math.abs(overflowX) > 0.5 ? clamp(base.panX + dxPx / overflowX, 0, 1) : base.panX,
            panY: Math.abs(overflowY) > 0.5 ? clamp(base.panY + dyPx / overflowY, 0, 1) : base.panY,
            userCrop: true,
          };
        }
      }
      result = p.elements.map((x) => (x.id === g.id ? next : x));
      setDraft(result);
    };

    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      setDraft(null);
      if (result && g.moved) latest.current.onCommit(result, { manual: true });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const updateElement = (id: string, patch: Partial<PhotoElement> & Partial<TextElement>, opts?: CommitOptions) => {
    onCommit(
      page.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as PageElement) : e)),
      opts
    );
  };

  // Scroll to zoom while cropping the selected photo.
  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      const { page: p, onCommit: commit } = latest.current;
      const sel = p.elements.find((x) => x.id === selectedId);
      if (!cropMode || !editable || !sel || sel.type !== "photo") return;
      e.preventDefault();
      const zoom = clamp(sel.zoom * (1 - e.deltaY * 0.0015), 1, 4);
      commit(
        p.elements.map((x) => (x.id === sel.id ? { ...sel, zoom, userCrop: true } : x)),
        { manual: true, coalesce: `zoom:${sel.id}` }
      );
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [cropMode, editable, selectedId]);

  const handleDragOver = (e: DragEvent) => {
    if (!editable || !e.dataTransfer.types.includes(PHOTO_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropOver(true);
  };

  const handleDrop = (e: DragEvent) => {
    setDropOver(false);
    const photoId = e.dataTransfer.getData(PHOTO_DRAG_TYPE);
    if (!editable || !photoId || !canvasRef.current) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const ux = ((e.clientX - rect.left) / rect.width) * 100 * span;
    const uy = ((e.clientY - rect.top) / rect.height) * 100;
    const target = [...page.elements].reverse().find((el) => el.type === "photo" && ux >= el.x && ux <= el.x + el.w && uy >= el.y && uy <= el.y + el.h);
    onDropPhoto(photoId, { x: ux, y: uy }, target?.id);
  };

  const pct = (el: { x: number; y: number; w: number; h: number }): CSSProperties => ({
    position: "absolute",
    left: `${el.x / span}%`,
    top: `${el.y}%`,
    width: `${el.w / span}%`,
    height: `${el.h}%`,
  });

  const handles: Array<[Handle, CSSProperties, string]> = [
    ["nw", { left: -5, top: -5 }, "cursor-nwse-resize"],
    ["ne", { right: -5, top: -5 }, "cursor-nesw-resize"],
    ["sw", { left: -5, bottom: -5 }, "cursor-nesw-resize"],
    ["se", { right: -5, bottom: -5 }, "cursor-nwse-resize"],
  ];

  const toolbarBelow = selected ? selected.y < 14 : false;
  const centerX = selected ? (selected.x + selected.w / 2) / span : 0;
  const photoSel = selected?.type === "photo" ? selected : null;
  const textSel = selected?.type === "text" ? selected : null;
  const lowRes = photoSel ? (() => {
    const p = env.photoById(photoSel.photoId);
    return p ? isLowResolution(photoSel, p) : false;
  })() : false;

  return (
    <div
      className={`editing relative ${dropOver ? "ring-4 ring-sage/60" : ""}`}
      style={{ width, height }}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropOver(false)}
      onDrop={handleDrop}
    >
      <div className="absolute inset-0 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
        <CanvasFrame
          ref={canvasRef}
          span={span}
          onPointerDown={() => {
            onActivate();
            onSelect(null);
          }}
        >
          <PageBackground styleId={page.style ?? env.albumStyle} accent={env.accent} span={span} />
          {elements.map((el) => {
            const isSel = el.id === selectedId;
            const cls = editable ? `${isSel && cropMode && el.type === "photo" ? "cursor-grab" : "cursor-move"} hover:outline hover:outline-2 hover:outline-sage/50` : "";
            if (el.type === "photo") {
              if (!env.photoById(el.photoId)) return null;
              return (
                <PhotoView
                  key={el.id}
                  el={el}
                  span={span}
                  env={env}
                  className={cls}
                  onPointerDown={(e) => startGesture(e, el, isSel && cropMode ? "pan" : "move")}
                />
              );
            }
            const empty = !(el.title.trim() || el.story.trim() || (el.showDate && el.date));
            return (
              <TextView key={el.id} el={el} span={span} env={env} className={cls} onPointerDown={(e) => startGesture(e, el, "move")}>
                {empty && editable && (
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center border border-dashed border-ink/25 text-ink/35"
                    style={{ fontSize: "calc(var(--u) * 2.4)" }}
                  >
                    Click to add words
                  </div>
                )}
              </TextView>
            );
          })}
        </CanvasFrame>
      </div>

      {/* Selection, handles, warnings and the floating toolbar sit outside the clipped page so edge photos stay easy to grab. */}
      <div className="pointer-events-none absolute inset-0">
        {editable &&
          elements.map((el) => {
            if (el.type !== "photo") return null;
            const photo = env.photoById(el.photoId);
            if (!photo || !isLowResolution(el, photo)) return null;
            return (
              <div key={el.id} style={pct(el)}>
                <span
                  className="pointer-events-auto absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow"
                  title="Low resolution for this size. It may print soft."
                >
                  !
                </span>
              </div>
            );
          })}

        {editable && selected && (
          <>
            <div style={pct(selected)} className="outline outline-2 outline-sage-dark">
              {!cropMode &&
                handles.map(([h, pos, cursor]) => (
                  <div
                    key={h}
                    onPointerDown={(e) => startGesture(e, selected, "resize", h)}
                    className={`pointer-events-auto absolute h-2.5 w-2.5 rounded-sm border border-sage-dark bg-white ${cursor}`}
                    style={pos}
                  />
                ))}
            </div>
            <div
              className="pointer-events-auto absolute z-20 flex items-center gap-0.5 whitespace-nowrap rounded-lg bg-white p-1 shadow-lg ring-1 ring-ink/10"
              style={{
                left: `${centerX}%`,
                top: `${toolbarBelow ? selected.y + selected.h : selected.y}%`,
                transform: `translate(-50%, ${toolbarBelow ? "8px" : "calc(-100% - 8px)"})`,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {photoSel && (
                <>
                  <button onClick={onToggleCrop} className={`${btn} ${cropMode ? "bg-sage-dark text-white hover:bg-sage-dark" : ""}`} title="Crop and zoom: drag the photo inside its frame">
                    <IconCrop /> Crop
                  </button>
                  {cropMode && (
                    <label className="flex items-center gap-1.5 px-1.5 text-[11px] text-ink/60">
                      Zoom
                      <input
                        type="range"
                        min={1}
                        max={4}
                        step={0.02}
                        value={photoSel.zoom}
                        onChange={(e) => updateElement(photoSel.id, { zoom: Number(e.target.value), userCrop: true }, { manual: true, coalesce: `zoom:${photoSel.id}` })}
                        className="w-24 accent-[#6E7F63]"
                      />
                    </label>
                  )}
                  <button
                    onClick={() => updateElement(photoSel.id, { frame: photoSel.frame === "white" ? "none" : "white" }, { manual: true })}
                    className={`${btn} ${photoSel.frame === "white" ? "bg-beige" : ""}`}
                    title="White photo border"
                  >
                    <IconFrame />
                  </button>
                </>
              )}
              {textSel && (
                <>
                  <button onClick={() => updateElement(textSel.id, { align: "left" }, { manual: true })} className={`${btn} ${textSel.align === "left" ? "bg-beige" : ""}`}>
                    Left
                  </button>
                  <button onClick={() => updateElement(textSel.id, { align: "center" }, { manual: true })} className={`${btn} ${textSel.align === "center" ? "bg-beige" : ""}`}>
                    Center
                  </button>
                </>
              )}
              <button onClick={() => onRemoveElement(selected.id)} className={`${btn} text-red-600`} title={photoSel ? "Take off this page (stays in your album)" : "Delete text"}>
                <IconTrash />
              </button>
              {lowRes && <span className="px-1.5 text-[11px] text-amber-600">Low resolution for this size</span>}
            </div>
          </>
        )}

        {editable && span === 2 && photoSel && photoSel.x < 100 && photoSel.x + photoSel.w > 100 && (
          <div
            className="pointer-events-none absolute inset-y-0 flex items-start justify-center border-x border-dashed border-white/80"
            style={{ left: "46%", width: "8%", background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.16) 0 6px, transparent 6px 12px)" }}
          >
            <span className="mt-2 rounded bg-black/40 px-1.5 py-0.5 text-center text-[9px] leading-tight text-white">Keep faces out of the fold</span>
          </div>
        )}

        {lockedLabel && (
          <div className="pointer-events-auto absolute inset-0 flex items-end justify-center bg-ink/[0.04] pb-3" onPointerDown={onActivate}>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs text-ink/60 shadow">{lockedLabel}</span>
          </div>
        )}

        {active && <div className="absolute inset-x-[18%] -bottom-[9px] h-[3px] rounded-full bg-white/80 shadow-sm" title="The page your changes apply to" />}
      </div>
    </div>
  );
}

export function EmptySlot({ px, label, children }: { px: number; label: string; children?: ReactNode }) {
  return (
    <div className="relative flex items-center justify-center bg-[#FBF8F0] text-center text-xs text-ink/35" style={{ width: px, height: px }}>
      <span className="px-6">{label}</span>
      {children}
    </div>
  );
}
