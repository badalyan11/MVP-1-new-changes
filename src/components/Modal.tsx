import { useEffect, type ReactNode } from "react";

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label={title}
        className={`flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-cream shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-4xl" : "sm:max-w-md"}`}
      >
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3.5">
          <h2 className="font-serif text-lg text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full px-2 py-1 text-xl leading-none text-ink/50 hover:bg-beige hover:text-ink">
            &times;
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
