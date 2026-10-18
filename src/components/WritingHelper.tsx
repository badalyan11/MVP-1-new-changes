import { useState } from "react";
import { helpRemember, writeMemory, type WriteResult, type WriteTask, type WritingContext } from "../lib/ai";

const link = "text-xs text-ink/55 underline underline-offset-2 hover:text-ink disabled:opacity-40 disabled:no-underline";

/**
 * Optional help under a writing box. Nothing here is forced: the person's own
 * words stay exactly as typed until they choose to use a suggestion.
 */
export function WritingHelper({
  text,
  context,
  originalNote,
  onUse,
  onAppend,
}: {
  /** What's in the writing box now. */
  text: string;
  context: WritingContext;
  /** The very first thing they wrote, kept so rewrites always start from their words. */
  originalNote?: string;
  /** They chose a suggestion. */
  onUse: (suggestion: string, originalNote: string) => void;
  /** They added remembered details to their own note. */
  onAppend: (additions: string) => void;
}) {
  const [suggestion, setSuggestion] = useState<WriteResult | null>(null);
  const [busy, setBusy] = useState<WriteTask | "questions" | null>(null);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const note = (originalNote?.trim() ? originalNote : text).trim();
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const run = async (task: WriteTask) => {
    setBusy(task);
    try {
      const result = await writeMemory(task, note, context, task === "shorter" || task === "warmer" ? suggestion?.text ?? text : suggestion?.text);
      setSuggestion(result);
    } finally {
      setBusy(null);
    }
  };

  const remember = async () => {
    setBusy("questions");
    try {
      const qs = await helpRemember(text, context);
      setQuestions(qs);
      setAnswers(qs.map(() => ""));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={() => void run("write")}
          disabled={!text.trim() || busy !== null}
          className="rounded-full bg-beige px-3 py-1.5 text-xs font-medium text-ink/80 transition hover:bg-[#EADFCB] disabled:opacity-40"
        >
          {busy === "write" ? "Finding the words..." : "Help me write this"}
        </button>
        <button type="button" onClick={() => void remember()} disabled={busy !== null} className={`${link} ${wordCount < 8 && !questions ? "text-sage-dark" : ""}`}>
          {busy === "questions" ? "Thinking..." : "Help me remember"}
        </button>
      </div>

      {questions && (
        <div className="mt-3 rounded-xl bg-white/70 p-3 ring-1 ring-ink/5">
          <p className="text-xs text-ink/50">Only if they help. Skip any you like.</p>
          <div className="mt-2 space-y-2.5">
            {questions.map((q, i) => (
              <div key={q}>
                <label className="block text-xs text-ink/70">{q}</label>
                <input
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswers((cur) => cur.map((a, j) => (j === i ? e.target.value : a)))}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-sm focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => {
                const add = answers.map((a) => a.trim()).filter(Boolean).join(" ");
                if (add) onAppend(add);
                setQuestions(null);
              }}
              className="rounded-full bg-sage-dark px-3 py-1 text-xs font-medium text-white hover:bg-sage"
            >
              Add to my note
            </button>
            <button type="button" onClick={() => setQuestions(null)} className={link}>
              Skip
            </button>
          </div>
        </div>
      )}

      {suggestion && (
        <div className="mt-3 rounded-xl bg-white/80 p-3 ring-1 ring-sage/40">
          <p className="whitespace-pre-line font-serif text-sm leading-relaxed text-ink/90">{suggestion.text}</p>
          {suggestion.source === "basic" && (
            <p className="mt-1.5 text-[11px] text-ink/40">A light tidy-up of your words. AI rewriting isn't connected here.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <button
              type="button"
              onClick={() => {
                onUse(suggestion.text, note);
                setSuggestion(null);
              }}
              className="rounded-full bg-sage-dark px-3 py-1 text-xs font-medium text-white hover:bg-sage"
            >
              Use this
            </button>
            {suggestion.source === "ai" && (
              <>
                <button type="button" onClick={() => void run("another")} disabled={busy !== null} className={link}>
                  {busy === "another" ? "..." : "Another version"}
                </button>
                <button type="button" onClick={() => void run("shorter")} disabled={busy !== null} className={link}>
                  {busy === "shorter" ? "..." : "Shorter"}
                </button>
                <button type="button" onClick={() => void run("warmer")} disabled={busy !== null} className={link}>
                  {busy === "warmer" ? "..." : "Warmer"}
                </button>
              </>
            )}
            <button type="button" onClick={() => setSuggestion(null)} className={link}>
              Keep mine
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
