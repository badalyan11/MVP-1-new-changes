import { store } from "./store";
import { basicPolish, fallbackQuestions } from "./writingFallback";

export interface WritingContext {
  mode: "ongoing" | "experience";
  journalType: string;
  customTypeDescription: string;
  subject: string;
}

export type WriteTask = "write" | "another" | "shorter" | "warmer";

export interface WriteResult {
  text: string;
  /** "ai" when a real model wrote it; "basic" when only tidied locally. */
  source: "ai" | "basic";
}

/** The model is asked not to use these, and we strip them as a safety net. */
function stripDashes(text: string): string {
  return text.replace(/\s*[–—]\s*/g, ", ").replace(/,\s*,/g, ",");
}

async function callApi(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const token = await store.getAccessToken();
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Helps someone put their memory into words. `note` is what they wrote; for
 * "shorter" and "warmer", `previous` is the version being adjusted.
 */
export async function writeMemory(task: WriteTask, note: string, context: WritingContext, previous?: string): Promise<WriteResult> {
  const data = await callApi({ task, text: note, previous, context });
  const text = typeof data?.text === "string" ? data.text.trim() : "";
  if (text) return { text: stripDashes(text), source: "ai" };
  return { text: basicPolish(previous && task !== "another" ? previous : note, task), source: "basic" };
}

/** Optional prompts to help someone remember more. Only called when they ask. */
export async function helpRemember(note: string, context: WritingContext): Promise<string[]> {
  const data = await callApi({ task: "questions", text: note, context });
  const questions = Array.isArray(data?.questions) ? (data.questions as unknown[]).filter((q): q is string => typeof q === "string") : [];
  return questions.length ? questions.slice(0, 3) : fallbackQuestions(note);
}
