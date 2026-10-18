import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export interface MenuItem {
  label: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
}

/** A small "more" dropdown, for secondary actions that shouldn't clutter the screen. */
export function MoreMenu({ items, label = "More" }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        className="rounded-lg border border-ink/15 px-3 py-2 text-sm font-medium text-ink/70 transition hover:bg-white"
      >
        &middot;&middot;&middot;
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1.5 min-w-[11rem] overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-ink/10">
          {items.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2 text-sm hover:bg-beige ${item.danger ? "text-red-600" : "text-ink/80"}`}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className={`block w-full px-4 py-2 text-left text-sm hover:bg-beige ${item.danger ? "text-red-600" : "text-ink/80"}`}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
