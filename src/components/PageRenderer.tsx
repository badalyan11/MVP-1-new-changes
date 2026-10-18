import { forwardRef, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import type { Page, Photo, PhotoElement, PhotoUrls, TextElement } from "../types";
import { PageBackground } from "./PageBackground";
import { boxAspect, coverBox } from "../lib/crop";
import { fontClassFor } from "../lib/journalTypes";
import { useFitText } from "../hooks/useFitText";

/** Everything needed to draw a page, independent of whether it's being read or edited. */
export interface RenderEnv {
  albumStyle: string;
  accent: string;
  titleFont: string;
  urls: Record<string, PhotoUrls>;
  photoById: (id: string) => Photo | undefined;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

/**
 * The drawing surface for one page (or a two-page spread). Sizes inside use
 * `--u`, which is 1% of ONE page's width, so everything scales with the page.
 */
export const CanvasFrame = forwardRef<
  HTMLDivElement,
  { span: 1 | 2; half?: 0 | 1 | null; children?: ReactNode; className?: string } & Omit<HTMLAttributes<HTMLDivElement>, "children">
>(({ span, half = null, children, className = "", style, ...rest }, ref) => {
  const showingHalf = span === 2 && half !== null;
  const frameStyle: CSSProperties = {
    width: showingHalf ? "200%" : "100%",
    left: showingHalf && half === 1 ? "-100%" : 0,
    containerType: "inline-size",
    ["--span" as string]: span,
    ["--u" as string]: "calc(1cqw / var(--span))",
    ...style,
  };
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={ref} className={`absolute top-0 h-full ${className}`} style={frameStyle} {...rest}>
        {children}
      </div>
    </div>
  );
});
CanvasFrame.displayName = "CanvasFrame";

function rectStyle(el: { x: number; y: number; w: number; h: number }, span: 1 | 2): CSSProperties {
  return {
    position: "absolute",
    left: `${el.x / span}%`,
    top: `${el.y}%`,
    width: `${el.w / span}%`,
    height: `${el.h}%`,
  };
}

export function PhotoView({
  el,
  span,
  env,
  style,
  className = "",
  children,
  ...rest
}: {
  el: PhotoElement;
  span: 1 | 2;
  env: Pick<RenderEnv, "urls" | "photoById">;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">) {
  const photo = env.photoById(el.photoId);
  const urls = env.urls[el.photoId];
  const src = urls?.display ?? urls?.thumb;
  const framed = el.frame === "white";
  const box = photo ? coverBox(photo.width / photo.height, boxAspect(el.w, el.h), el.zoom, el.panX, el.panY) : null;

  return (
    <div
      className={className}
      style={{
        ...rectStyle(el, span),
        boxShadow: framed
          ? "0 0 0 calc(var(--u) * 1.4) #fff, 0 calc(var(--u) * 0.8) calc(var(--u) * 2.4) rgba(0,0,0,0.28)"
          : undefined,
        ...style,
      }}
      {...rest}
    >
      <div className="absolute inset-0 overflow-hidden bg-beige">
        {src && box ? (
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute max-w-none select-none"
            style={{
              width: `${box.widthPct}%`,
              height: `${box.heightPct}%`,
              left: `${box.leftPct}%`,
              top: `${box.topPct}%`,
            }}
          />
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function TextView({
  el,
  span,
  env,
  style,
  className = "",
  children,
  ...rest
}: {
  el: TextElement;
  span: 1 | 2;
  env: Pick<RenderEnv, "titleFont">;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">) {
  const boxRef = useRef<HTMLDivElement>(null);
  const hasContent = Boolean(el.title.trim() || el.story.trim() || (el.showDate && el.date));
  const dateText = el.showDate && el.date ? formatDate(el.date) : "";
  useFitText(boxRef, [el.title, el.story, el.date, el.showDate, el.w, el.h, span, el.scale]);
  const center = el.align === "center";
  const k = el.scale ?? 1;

  return (
    <div className={className} style={{ ...rectStyle(el, span), ...style }} {...rest}>
      <div
        ref={boxRef}
        className={`flex h-full w-full flex-col overflow-hidden text-ink ${center ? "items-center justify-center text-center" : ""}`}
        style={{ padding: "calc(var(--u) * 1)", gap: "calc(var(--u) * 1.1 * var(--fit, 1))" }}
      >
        {hasContent && (
          <>
            {el.title.trim() && (
              <p
                className={`${fontClassFor(env.titleFont)} leading-tight`}
                style={{ fontSize: `calc(var(--u) * ${4.6 * k} * var(--fit, 1))` }}
              >
                {el.title}
              </p>
            )}
            {dateText && (
              <p className="font-caveat leading-none text-ink/70" style={{ fontSize: `calc(var(--u) * ${3.6 * k} * var(--fit, 1))` }}>
                {dateText}
              </p>
            )}
            {el.story.trim() && (
              <p
                className="whitespace-pre-line font-serif text-ink/90"
                style={{ fontSize: `calc(var(--u) * ${2.5 * k} * var(--fit, 1))`, lineHeight: 1.55 }}
              >
                {el.story}
              </p>
            )}
          </>
        )}
      </div>
      {children}
    </div>
  );
}

/** A finished, non-interactive page: used by the reader, the book preview, and page thumbnails. */
export function PageRenderer({ page, half = null, env }: { page: Page; half?: 0 | 1 | null; env: RenderEnv }) {
  return (
    <CanvasFrame span={page.span} half={half}>
      <PageBackground styleId={page.style ?? env.albumStyle} accent={env.accent} span={page.span} />
      {page.elements.map((el) =>
        el.type === "photo" ? (
          env.photoById(el.photoId) ? <PhotoView key={el.id} el={el} span={page.span} env={env} /> : null
        ) : (
          <TextView key={el.id} el={el} span={page.span} env={env} />
        )
      )}
    </CanvasFrame>
  );
}

export function BlankPage({ albumStyle, accent }: { albumStyle: string; accent: string }) {
  return (
    <CanvasFrame span={1}>
      <PageBackground styleId={albumStyle} accent={accent} />
    </CanvasFrame>
  );
}
