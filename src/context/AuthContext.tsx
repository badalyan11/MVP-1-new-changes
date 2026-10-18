import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser } from "../types";
import { store } from "../lib/store";

interface AuthValue {
  user: AuthUser | null;
  loading: boolean;
  /** True right after someone follows a password-reset link. */
  recovering: boolean;
  /** False when running without Supabase (everything stays in this browser). */
  accountsEnabled: boolean;
  signOut: () => Promise<void>;
  finishRecovery: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let alive = true;
    store.getUser().then((u) => {
      if (!alive) return;
      setUser(u);
      setLoading(false);
    });
    const unsubscribe = store.onAuthChange((event, u) => {
      if (!alive) return;
      setUser(u);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      recovering,
      accountsEnabled: store.kind === "cloud",
      signOut: async () => {
        await store.signOut();
        setUser(null);
      },
      finishRecovery: () => setRecovering(false),
    }),
    [user, loading, recovering]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
