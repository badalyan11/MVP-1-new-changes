import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** A consistent top bar: where you are, a clear way back, and (optionally) actions on the right. */
export function PageHeader({
  backTo,
  backLabel,
  title,
  right,
}: {
  backTo: string;
  backLabel: string;
  title?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <Link to={backTo} className="shrink-0 text-sm text-ink/55 hover:text-ink">
          &larr; {backLabel}
        </Link>
        {title && <h1 className="truncate font-serif text-lg text-ink">{title}</h1>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}
