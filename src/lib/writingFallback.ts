/**
 * What the writing helper does when no AI is connected: it only tidies the
 * person's own words (capitalization, punctuation, paragraphs). It never adds
 * sentences, feelings, or details, because anything it "added" would be invented.
 */

function stripFiller(text: string): string {
  return text
    .replace(/\b(really|very|just|so|actually|basically|literally)\s+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fixSentence(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  s = s.replace(/\bi\b(?=['’\s.,!?;:]|$)/g, "I");
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return /[.!?…]["')\]]?$/.test(s) ? s : `${s}.`;
}

export function basicPolish(note: string, task: "write" | "another" | "shorter" | "warmer" = "write"): string {
  const base = task === "shorter" ? stripFiller(note) : note;
  const sentences = base
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .flatMap((para) => para.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/))
    .map(fixSentence)
    .filter(Boolean);
  if (sentences.length <= 4) return sentences.join(" ");
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) paragraphs.push(sentences.slice(i, i + 3).join(" "));
  return paragraphs.join("\n\n");
}

/** Gentle, optional prompts based on what's missing from the note. At most three. */
export function fallbackQuestions(note: string): string[] {
  const out: string[] = [];
  const lower = note.toLowerCase();
  if (/\bfirst\b/.test(lower)) out.push("What do you remember most about that first time?");
  if (!/\b(then|after|next|later|finally)\b/.test(lower)) out.push("What happened next?");
  if (!/\d/.test(note) && !/\b[A-Z][a-z]{2,}\b/.test(note.slice(1))) out.push("Was there a small detail you don't want to forget?");
  if (out.length < 2) out.push("What do you remember most about it?");
  return out.slice(0, 3);
}
