import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { store } from "../lib/store";

export function ResetPassword() {
  const { user, loading, finishRecovery } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading) return null;
  // The reset link signs the person in briefly; without that session there's nothing to reset.
  if (!user) return <Navigate to="/signin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await store.updatePassword(password);
      finishRecovery();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your password.");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-ink focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage";

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-serif text-2xl text-ink">Choose a new password</h1>
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl bg-white/70 p-6 shadow-sm ring-1 ring-ink/5">
          <div>
            <label className="block text-sm font-medium text-ink/70">New password</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink/70">Type it again</label>
            <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={inputClass} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-sage-dark px-6 py-3.5 font-medium text-white transition hover:bg-sage disabled:opacity-60">
            {busy ? "Saving..." : "Save new password"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/" className="text-ink/50 underline hover:text-ink/80">
            Skip for now
          </Link>
        </p>
      </div>
    </div>
  );
}
