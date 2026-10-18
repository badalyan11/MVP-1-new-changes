import type { JournalDesign } from "../types";
import { fontClassFor } from "../lib/journalTypes";
import { getContrastText } from "../lib/color";

export function JournalCover({
  title,
  design,
  subtitle,
  size = "medium",
  fill = false,
  coverUrl = null,
}: {
  title: string;
  design: JournalDesign;
  subtitle?: string;
  size?: "small" | "medium" | "large";
  /** Fill the parent's size instead of enforcing its own aspect ratio (for use inside the flip-book). */
  fill?: boolean;
  /** The cover photo (from the album's library), already resolved to a URL. */
  coverUrl?: string | null;
}) {
  const hasPhoto = Boolean(coverUrl);
  const textColor = hasPhoto ? "#FAF6EF" : getContrastText(design.coverColor);
  const shapeClasses = {
    small: "rounded-md p-4",
    medium: "rounded-lg p-6",
    large: "rounded-lg p-[7%]",
  }[size];
  const sizeClasses = fill ? `h-full w-full ${shapeClasses}` : `aspect-square ${shapeClasses}`;
  const titleSizeClasses = { small: "text-base", medium: "text-2xl", large: "text-[clamp(1.5rem,4cqw,3rem)]" }[size];

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden shadow-md ring-1 ring-black/10 ${sizeClasses}`}
      style={{
        backgroundColor: design.coverColor,
        backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: `${design.coverFocusX ?? 50}% ${design.coverFocusY ?? 50}%`,
        containerType: "inline-size",
      }}
    >
      {hasPhoto && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 45%, transparent 70%)" }}
        />
      )}
      {/* the hinge, so the cover reads as a real hardcover */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[7%]"
        style={{ background: "linear-gradient(to right, rgba(0,0,0,0.22), rgba(255,255,255,0.10) 55%, rgba(0,0,0,0.10) 70%, transparent)" }}
      />
      <div className="relative h-1 w-10 rounded-full" style={{ backgroundColor: design.accentColor }} />
      <div className="relative" style={{ color: textColor }}>
        <p className={`${fontClassFor(design.titleFont)} ${titleSizeClasses} leading-snug`}>{title}</p>
        {subtitle && <p className="mt-1 text-xs opacity-80">{subtitle}</p>}
      </div>
    </div>
  );
}
