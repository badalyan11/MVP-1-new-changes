import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { JournalSummary } from "../types";
import { store } from "../lib/store";
import { JournalCover } from "../components/JournalCover";
import { AccountMenu } from "../components/AccountMenu";
import { Welcome } from "./Welcome";

/** Home: your albums, or the welcome screen if you don't have one yet. */
export function MyJournals() {
  const [journals, setJournals] = useState<JournalSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    store
      .listJournals()
      .then((list) => alive && setJournals(list))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Couldn't load your journals."));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
        <p className="font-serif text-xl text-ink">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-ink/60 underline hover:text-ink">
          Try again
        </button>
      </div>
    );
  }
  if (!journals) {
    return <div className="flex min-h-screen items-center justify-center bg-cream text-sm text-ink/50">Opening your journals...</div>;
  }
  if (journals.length === 0) return <Welcome />;

  return (
    <div className="min-h-screen bg-cream px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-3">
          <h1 className="font-serif text-3xl text-ink">My Journals</h1>
          <div className="flex items-center gap-4">
            <Link to="/welcome" className="text-sm text-ink/50 underline hover:text-ink/80">
              How it works
            </Link>
            <AccountMenu />
          </div>
        </header>

        <Link
          to="/create"
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-sage-dark px-6 py-3.5 font-medium text-white shadow-sm transition hover:bg-sage sm:w-auto sm:px-10"
        >
          + Start a new journal
        </Link>

        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {journals.map((journal) => (
            <Link key={journal.id} to={`/journal/${journal.id}`} className="group block">
              <div className="transition duration-200 group-hover:-translate-y-1">
                <JournalCover title={journal.title} design={journal.design} size="medium" coverUrl={journal.coverUrl} />
              </div>
              <p className="mt-2.5 truncate text-sm text-ink/80">{journal.title}</p>
              <p className="text-xs text-ink/40">
                {journal.mode === "ongoing" ? "Keeps growing" : "From an experience"} · {journal.pageCount}{" "}
                {journal.pageCount === 1 ? "page" : "pages"}
                {journal.role === "collaborator" ? " · Shared with you" : ""}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
