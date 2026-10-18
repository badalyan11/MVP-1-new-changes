import { Link } from "react-router-dom";
import { JournalCover } from "../components/JournalCover";
import { DESIGN_PRESETS } from "../lib/journalTypes";
import { AccountMenu } from "../components/AccountMenu";

const EXAMPLES = [
  { title: "Leo's Childhood", preset: DESIGN_PRESETS[1] },
  { title: "Our Story", preset: DESIGN_PRESETS[2] },
  { title: "Italy 2026", preset: DESIGN_PRESETS[5] },
  { title: "College Memories", preset: DESIGN_PRESETS[3] },
];

const STEPS = [
  { number: 1, label: "Start a journal" },
  { number: 2, label: "Add your photos and memories" },
  { number: 3, label: "Arrange them into an album you keep forever" },
];

export function Welcome({ showBack = false }: { showBack?: boolean }) {
  return (
    <div className="relative min-h-screen bg-cream px-5 py-14 sm:px-8">
      {showBack && (
        <Link to="/" className="absolute left-5 top-5 text-sm text-ink/55 hover:text-ink">
          &larr; My journals
        </Link>
      )}
      <div className="absolute right-5 top-5">
        <AccountMenu />
      </div>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-3xl text-ink sm:text-4xl">Life Journal</h1>
        <p className="mt-2 text-lg text-ink/70">Turn life's moments into stories worth keeping.</p>

        <p className="mx-auto mt-6 max-w-md text-ink/60">
          Gather your photos and write what you remember in your own simple words. We can help with the words if you like, and you decide where everything goes, in an album you can flip through like a real book, and one day hold in your hands.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number}>
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-sage-dark font-serif text-white">
                {step.number}
              </div>
              <p className="mt-2 text-sm text-ink/70">{step.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <p className="text-sm font-medium text-ink/50">A few journals people keep</p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {EXAMPLES.map((example) => (
              <JournalCover
                key={example.title}
                title={example.title}
                design={{
                  presetId: example.preset.id,
                  coverColor: example.preset.coverColor,
                  coverPhotoId: null,
                  titleFont: example.preset.titleFont,
                  pageStyle: example.preset.pageStyle,
                  accentColor: example.preset.accentColor,
                }}
                size="small"
              />
            ))}
          </div>
        </div>

        <Link
          to="/create"
          className="mt-12 inline-block rounded-xl bg-sage-dark px-8 py-3.5 font-medium text-white shadow-sm transition hover:bg-sage"
        >
          Start my first journal
        </Link>
      </div>
    </div>
  );
}
