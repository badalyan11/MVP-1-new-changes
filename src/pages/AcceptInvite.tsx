import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { store } from "../lib/store";
import type { InviteInfo } from "../types";

/** Where an invitation link lands: see what you're being invited to, sign in if needed, and join. */
export function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    store
      .getInviteInfo(token)
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [token]);

  const next = encodeURIComponent(`/invite/${token}`);

  const join = async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const journalId = await store.acceptInvite(token);
      navigate(`/journal/${journalId}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join this album.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5 py-12">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-3xl text-ink">Life Journal</h1>
        <div className="mt-8 rounded-2xl bg-white/70 p-6 shadow-sm ring-1 ring-ink/5">
          {info === undefined || loading ? (
            <p className="text-sm text-ink/50">One moment...</p>
          ) : info === null ? (
            <>
              <p className="font-serif text-lg text-ink">This invitation isn't valid anymore.</p>
              <p className="mt-2 text-sm text-ink/60">It may have been used, cancelled, or expired. Ask the album's owner for a new link.</p>
              <Link to="/" className="mt-5 inline-block text-sm text-ink/60 underline">
                Go to my journals
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-ink/60">{info.inviterName || "Someone"} invited you to add photos and memories to</p>
              <p className="mt-1 font-serif text-2xl text-ink">{info.journalTitle}</p>
              {info.email && <p className="mt-2 text-xs text-ink/45">This invitation is for {info.email}.</p>}
              {user ? (
                <button
                  onClick={join}
                  disabled={busy}
                  className="mt-6 w-full rounded-xl bg-sage-dark px-6 py-3.5 font-medium text-white transition hover:bg-sage disabled:opacity-60"
                >
                  {busy ? "Joining..." : "Join this album"}
                </button>
              ) : (
                <div className="mt-6 space-y-2.5">
                  <Link to={`/signin?next=${next}`} className="block rounded-xl bg-sage-dark px-6 py-3.5 font-medium text-white transition hover:bg-sage">
                    Sign in to join
                  </Link>
                  <Link to={`/signin?mode=signup&next=${next}`} className="block rounded-xl border border-ink/15 px-6 py-3 text-sm font-medium text-ink/70 transition hover:bg-white">
                    Create an account
                  </Link>
                </div>
              )}
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
