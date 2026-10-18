import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { store } from "../lib/store";
import { getTypeLabel } from "../lib/journalTypes";

interface Totals {
  ongoing: number;
  experience: number;
  byType: Map<string, number>;
  pages: number;
  photos: number;
  aiUsed: number;
  aiEdited: number;
  interested: number;
}

/** Small counters about your own albums. Nothing leaves your account. */
export function Stats() {
  const [totals, setTotals] = useState<Totals | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const journals = await store.listJournals();
      const t: Totals = { ongoing: 0, experience: 0, byType: new Map(), pages: 0, photos: 0, aiUsed: 0, aiEdited: 0, interested: 0 };
      for (const j of journals) {
        if (j.mode === "ongoing") t.ongoing++;
        else t.experience++;
        const label = getTypeLabel(j.mode, j.journalType, j.customTypeDescription);
        t.byType.set(label, (t.byType.get(label) ?? 0) + 1);
        t.photos += j.photoCount;
        const pages = await store.listPages(j.id);
        t.pages += pages.length;
        for (const p of pages) {
          if (p.meta.aiUsed) t.aiUsed++;
          if (p.meta.aiEdited) t.aiEdited++;
        }
        if (await store.hasBookInterest(j.id)) t.interested++;
      }
      if (alive) setTotals(t);
    })().catch(() => alive && setTotals(null));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-cream px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-xl">
        <Link to="/" className="text-sm text-ink/55 hover:text-ink">
          &larr; My journals
        </Link>
        <h1 className="mt-4 font-serif text-2xl text-ink">Your album stats</h1>
        <p className="mt-1 text-sm text-ink/50">Counts for the albums you can open. Private to you.</p>

        {!totals ? (
          <p className="mt-8 text-sm text-ink/50">Counting...</p>
        ) : (
          <div className="mt-8 space-y-6">
            <Block title="Albums">
              <Row label="Keep adding over time" value={totals.ongoing} />
              <Row label="From an experience" value={totals.experience} />
              <div className="mt-3 border-t border-ink/10 pt-3">
                {[...totals.byType.entries()].map(([label, count]) => (
                  <Row key={label} label={label} value={count} />
                ))}
              </div>
            </Block>
            <Block title="Content">
              <Row label="Pages" value={totals.pages} />
              <Row label="Photos in libraries" value={totals.photos} />
            </Block>
            <Block title="Writing help">
              <Row label="Pages where a suggestion was used" value={totals.aiUsed} />
              <Row label="...and then edited by hand" value={totals.aiEdited} />
            </Block>
            <Block title="Printed album interest">
              <Row label="Albums marked “I'm interested”" value={totals.interested} />
            </Block>
          </div>
        )}
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/70 p-5 shadow-sm ring-1 ring-ink/5">
      <p className="font-serif text-lg text-ink">{title}</p>
      <div className="mt-3 space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ink/60">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
