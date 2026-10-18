import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { store } from "../lib/store";

type Mode = "signin" | "signup" | "forgot";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-ink placeholder:text-ink/30 focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage";

export function SignIn() {
  const { user, loading, accountsEnabled } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setError("");
    setNotice("");
  }, [mode]);

  if (!loading && user) return <Navigate to={next} replace />;

  if (!accountsEnabled) {
    return (
      <Shell>
        <p className="text-sm text-ink/60">
          This copy of Life Journal isn't connected to a database yet, so there are no accounts. Everything you make is
          saved only in this browser.
        </p>
        <button
          onClick={() => navigate(next)}
          className="mt-6 w-full rounded-xl bg-sage-dark px-6 py-3.5 font-medium text-white transition hover:bg-sage"
        >
          Continue
        </button>
        <p className="mt-4 text-xs text-ink/40">To turn on accounts and sharing, follow the Supabase steps in the README.</p>
      </Shell>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "signin") {
        await store.signIn(email.trim(), password);
      } else if (mode === "signup") {
        const { needsConfirmation } = await store.signUp(email.trim(), password, name.trim());
        if (needsConfirmation) setNotice("Almost there. We sent a confirmation link to your email. Open it, then come back and sign in.");
      } else {
        await store.sendPasswordReset(email.trim());
        setNotice("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="flex gap-1 rounded-full bg-beige p-1 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full py-2 font-medium transition ${
              mode === m || (mode === "forgot" && m === "signin") ? "bg-white text-ink shadow-sm" : "text-ink/50"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "signup" && (
          <div>
            <label className="block text-sm font-medium text-ink/70">Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputClass} placeholder="Anna" />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-ink/70">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>
        {mode !== "forgot" && (
          <div>
            <label className="block text-sm font-medium text-ink/70">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className={inputClass}
              placeholder={mode === "signup" ? "At least 8 characters" : ""}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="rounded-lg bg-beige px-3 py-2 text-sm text-ink/70">{notice}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-sage-dark px-6 py-3.5 font-medium text-white transition hover:bg-sage disabled:opacity-60"
        >
          {busy ? "One moment..." : mode === "signin" ? "Sign in" : mode === "signup" ? "Create my account" : "Send reset link"}
        </button>
      </form>

      <div className="mt-4 text-center text-sm">
        {mode === "forgot" ? (
          <button onClick={() => setMode("signin")} className="text-ink/50 underline hover:text-ink/80">
            Back to sign in
          </button>
        ) : (
          mode === "signin" && (
            <button onClick={() => setMode("forgot")} className="text-ink/50 underline hover:text-ink/80">
              Forgot your password?
            </button>
          )
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-ink">Life Journal</h1>
          <p className="mt-2 text-sm text-ink/60">Turn life's moments into stories worth keeping.</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-6 shadow-sm ring-1 ring-ink/5">{children}</div>
      </div>
    </div>
  );
}
