import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Who's signed in, and the way to sign out. Hidden when the app runs without accounts. */
export function AccountMenu() {
  const { user, accountsEnabled, signOut } = useAuth();
  const navigate = useNavigate();
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

  if (!accountsEnabled || !user) return null;
  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-beige text-sm font-medium text-ink/70 transition hover:bg-white hover:ring-1 hover:ring-ink/10"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-ink/10">
          <div className="border-b border-ink/10 px-4 py-3">
            <p className="truncate text-sm font-medium text-ink">{user.name}</p>
            <p className="truncate text-xs text-ink/50">{user.email}</p>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate("/signin");
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-ink/80 hover:bg-beige"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
