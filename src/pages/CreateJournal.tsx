import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { DesignPicker } from "../components/DesignPicker";
import { GatherIllustration, GrowIllustration } from "../components/ModeIllustrations";
import { getTypeOptions, suggestPreset } from "../lib/journalTypes";
import { makeTitlePage } from "../lib/pageOps";
import { store } from "../lib/store";
import { uid } from "../lib/ids";
import type { Journal, JournalDesign, JournalMode } from "../types";

function defaultDesignFor(journalType: string): JournalDesign {
  const preset = suggestPreset(journalType);
  return {
    presetId: preset.id,
    coverColor: preset.coverColor,
    coverPhotoId: null,
    titleFont: preset.titleFont,
    pageStyle: preset.pageStyle,
    accentColor: preset.accentColor,
  };
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-ink placeholder:text-ink/30 focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage";

export function CreateJournal() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<JournalMode | null>(null);
  const [journalType, setJournalType] = useState("");
  const [customTypeDescription, setCustomTypeDescription] = useState("");
  const [design, setDesign] = useState<JournalDesign>(defaultDesignFor("other"));
  const [designCustomized, setDesignCustomized] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const chooseMode = (m: JournalMode) => {
    setMode(m);
    setJournalType("");
    setStep(2);
  };

  const chooseType = (id: string) => {
    setJournalType(id);
    if (!designCustomized) setDesign(defaultDesignFor(id));
  };

  const handleDesignChange = (next: JournalDesign) => {
    setDesignCustomized(true);
    setDesign(next);
  };

  const canCreate = Boolean(mode && journalType && title.trim());

  const handleCreate = async () => {
    if (!canCreate || !mode || !user) return;
    setBusy(true);
    setError("");
    try {
      const now = new Date().toISOString();
      const id = uid();
      const journal: Journal = {
        id,
        ownerId: user.id,
        title: title.trim(),
        mode,
        journalType,
        customTypeDescription: customTypeDescription.trim(),
        subject: subject.trim(),
        dateLabel: dateLabel.trim(),
        design,
        createdAt: now,
        updatedAt: now,
      };
      const firstPage = makeTitlePage({
        journalId: id,
        userId: user.id,
        title: journal.title,
        subtitle: [journal.subject, journal.dateLabel].filter(Boolean).join("\n"),
      });
      await store.createJournal(journal, firstPage);
      // An experience album starts by bringing in the photos; an ongoing one starts with its first memory.
      navigate(mode === "experience" ? `/journal/${id}/edit` : `/journal/${id}`, {
        state: mode === "experience" ? { welcome: true } : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the journal. Please try again.");
      setBusy(false);
    }
  };

  const back = (to: number) => () => setStep(to);

  return (
    <div className="min-h-screen bg-cream px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm text-ink/55 hover:text-ink">
            &larr; My journals
          </Link>
          <div className="flex w-40 gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={`h-1 flex-1 rounded-full ${n <= step ? "bg-sage-dark" : "bg-ink/10"}`} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="mt-10">
            <h1 className="font-serif text-2xl text-ink sm:text-3xl">What kind of album is this?</h1>
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              <ModeCard
                eyebrow="Grow with life"
                title="Keep adding over time"
                body="Start today and add another memory whenever life gives you something worth remembering."
                examples="Childhood · Family · Relationships · College"
                onClick={() => chooseMode("ongoing")}
              >
                <GrowIllustration />
              </ModeCard>
              <ModeCard
                eyebrow="Capture an experience"
                title="Create from an experience"
                body="Already have the photos and memories? Bring everything together and turn it into an album."
                examples="Vacation · Wedding · Graduation · Events"
                onClick={() => chooseMode("experience")}
              >
                <GatherIllustration />
              </ModeCard>
            </div>
          </div>
        )}

        {step === 2 && mode && (
          <div className="mt-10">
            <h1 className="font-serif text-2xl text-ink sm:text-3xl">What's this journal about?</h1>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {getTypeOptions(mode).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => chooseType(option.id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    journalType === option.id ? "border-sage-dark bg-beige" : "border-ink/15 bg-white hover:border-sage-dark"
                  }`}
                >
                  <p className="font-medium text-ink">{option.label}</p>
                  <p className="mt-1 text-xs text-ink/50">{option.blurb}</p>
                </button>
              ))}
            </div>

            {journalType === "other" && (
              <textarea
                value={customTypeDescription}
                onChange={(e) => setCustomTypeDescription(e.target.value)}
                placeholder="Tell us what this journal is about, in your own words..."
                rows={2}
                className="mt-4 w-full resize-none rounded-xl border border-ink/15 bg-white px-4 py-3 text-ink placeholder:text-ink/30 focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage"
              />
            )}

            <StepNav onBack={back(1)} onNext={() => setStep(3)} nextDisabled={!journalType} />
          </div>
        )}

        {step === 3 && (
          <div className="mt-10">
            <h1 className="font-serif text-2xl text-ink sm:text-3xl">Choose a design</h1>
            <p className="mt-1 text-sm text-ink/55">You can change any of this later.</p>
            <div className="mt-6">
              <DesignPicker title={title} journalType={journalType} value={design} onChange={handleDesignChange} />
            </div>
            <StepNav onBack={back(2)} onNext={() => setStep(4)} />
          </div>
        )}

        {step === 4 && mode && (
          <div className="mt-10 max-w-xl">
            <h1 className="font-serif text-2xl text-ink sm:text-3xl">Name your album</h1>
            <div className="mt-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-ink/70">Title</label>
                <input
                  type="text"
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={mode === "ongoing" ? "Leo's Childhood" : "Italy 2026"}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70">
                  Who or what is it about? <span className="font-normal text-ink/40">(optional)</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="my son Leo, our trip to Italy, the Badalyan family..."
                  className={inputClass}
                />
              </div>
              {mode === "experience" && (
                <div>
                  <label className="block text-sm font-medium text-ink/70">
                    When was this? <span className="font-normal text-ink/40">(optional)</span>
                  </label>
                  <input type="text" value={dateLabel} onChange={(e) => setDateLabel(e.target.value)} placeholder="June 2026" className={inputClass} />
                </div>
              )}
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <div className="mt-8 flex justify-between gap-3">
              <button onClick={back(3)} className="rounded-xl border border-ink/15 px-6 py-3 font-medium text-ink/70 transition hover:bg-white">
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={!canCreate || busy}
                className="rounded-xl bg-sage-dark px-8 py-3 font-medium text-white transition hover:bg-sage disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Creating..." : mode === "experience" ? "Create and add photos" : "Create journal"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModeCard({
  eyebrow,
  title,
  body,
  examples,
  onClick,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  examples: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-2xl border border-ink/10 bg-white/70 p-6 text-left transition hover:-translate-y-0.5 hover:border-sage-dark hover:shadow-md"
    >
      <div className="rounded-xl bg-cream px-3 pb-2 pt-4">{children}</div>
      <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-sage-dark">{eyebrow}</p>
      <p className="mt-1 font-serif text-xl text-ink">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink/65">{body}</p>
      <p className="mt-3 text-xs text-ink/40">{examples}</p>
    </button>
  );
}

function StepNav({ onBack, onNext, nextDisabled }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className="mt-8 flex justify-between gap-3">
      <button onClick={onBack} className="rounded-xl border border-ink/15 px-6 py-3 font-medium text-ink/70 transition hover:bg-white">
        Back
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="rounded-xl bg-sage-dark px-8 py-3 font-medium text-white transition hover:bg-sage disabled:cursor-not-allowed disabled:opacity-60"
      >
        Next
      </button>
    </div>
  );
}
