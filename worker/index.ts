/**
 * Cloudflare Worker: serves the built app (static assets) and one API route,
 * POST /api/ai, which calls the Anthropic API for the optional writing help.
 *
 * Secrets (set in the Cloudflare dashboard, never in the browser):
 *   ANTHROPIC_API_KEY   required for AI writing
 *   SUPABASE_URL        used to check the caller is signed in
 *   SUPABASE_ANON_KEY   (public key) used with SUPABASE_URL
 *   AI_MODEL            optional override, default below
 */

interface Env {
  ASSETS: Fetcher;
  ANTHROPIC_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  AI_MODEL?: string;
  /** Only for testing against a stand-in server. */
  ANTHROPIC_BASE_URL?: string;
}

interface AiRequest {
  task?: "write" | "another" | "shorter" | "warmer" | "questions";
  text?: string;
  previous?: string;
  context?: {
    mode?: string;
    journalType?: string;
    customTypeDescription?: string;
    subject?: string;
  };
}

const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_INPUT = 6000;

const WRITING_RULES = `You help people write down their own memories for a personal photo album. The memory is theirs and you are not its author. You help them find the words.

Follow these rules exactly.

1. Facts. Use only what the person wrote. Never add people, places, weather, food, conversations, quotes, feelings, physical details, or events they did not mention. If they did not say how someone felt, do not say it. Never describe what a photograph looks like.
2. Perspective. Keep their point of view and pronouns exactly: I, we, he, she, they, and names. If they wrote "we", it stays "we". Never switch between first and third person. Never change who did what.
3. Their voice. Keep their own words, phrases, slang, humor, and level of formality wherever they work. Fix grammar, punctuation, and flow, and organize a rambling note so it reads smoothly. The result should sound like THEM after taking a few more minutes to write it carefully. It must not sound like a writer or an AI.
4. Length. About the length of their note, at most a little longer. A one-line note stays one to three sentences. Never pad. Never exceed 180 words.
5. No ending flourish. Do not finish with a lesson, moral, or reflection they did not write.
6. No clichés or AI-sounding phrases, such as: cherish, treasure, tapestry, testament, journey, whirlwind, heartwarming, "little did we know", "in that moment", "it wasn't just X, it was Y", "etched in memory", "forever grateful", "moments like these".
7. Punctuation. Never use em dashes or en dashes. Use commas, periods, or the word "and". No emojis or hashtags. No exclamation marks unless they used them.
8. Variety. Do not open with a stock line. Start from their own first detail or their own opening words. Do not give every memory the same shape.
9. Language. Write in the same language as their note. Keep names and their spelling exactly.
10. Output only the memory text, in plain text. No title, no quotation marks, no preamble. Use a short paragraph break only where the note naturally has a second beat.

Example of the style wanted.
Note: "went to the beach w the kids, jake found a crab and wouldnt let it go lol. we stayed til sunset"
Good: "We took the kids to the beach. Jake found a crab and absolutely would not let it go. We stayed until sunset."
Bad: "A golden afternoon unfolded as laughter echoed across the shore. Jake's curiosity sparked a cherished memory that we will treasure forever."`;

const QUESTION_RULES = `You gently help someone remember more about a moment they started to write down. Ask 1 to 3 short questions based specifically on what they wrote, referring to their own details. Questions must be open (not yes or no), under 14 words, and never about how they felt unless their note leaves a clear gap there. Never invent anything. Reply with JSON only, in exactly this shape: {"questions":["...","..."]}`;

function contextLine(ctx: AiRequest["context"]): string {
  const about = ctx?.journalType === "other" ? ctx.customTypeDescription : ctx?.journalType;
  const parts = [about && `Album type: ${about}`, ctx?.subject && `Album is about: ${ctx.subject}`].filter(Boolean);
  return parts.length ? `${parts.join(". ")}. Use this only as light background for tone. Do not mention it unless they did.\n\n` : "";
}

function buildUserMessage(req: AiRequest): string {
  const note = (req.text ?? "").trim();
  const ctx = contextLine(req.context);
  const previous = (req.previous ?? "").trim();
  switch (req.task) {
    case "another":
      return `${ctx}Their original note:\n"""\n${note}\n"""\n\nA version already shown (do not reuse its wording or structure):\n"""\n${previous}\n"""\n\nWrite a clearly different version of the same memory. Change the opening and sentence structure, keep every fact.`;
    case "shorter":
      return `${ctx}Their original note:\n"""\n${note}\n"""\n\nCurrent version:\n"""\n${previous || note}\n"""\n\nMake the current version shorter by tightening it. Do not drop any specific detail they gave, such as names, places, or things said.`;
    case "warmer":
      return `${ctx}Their original note:\n"""\n${note}\n"""\n\nCurrent version:\n"""\n${previous || note}\n"""\n\nLet the warmth already in their own words come through a little more. Use only feelings they actually expressed. If they expressed none, keep the tone simple and kind rather than adding feelings.`;
    default:
      return `${ctx}Here is what they wrote:\n"""\n${note}\n"""\n\nWrite it up in their voice, following the rules.`;
  }
}

async function isSignedIn(request: Request, env: Env): Promise<boolean> {
  // Without a Supabase project there are no accounts to check (local/dev use).
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return true;
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
  });
  return res.ok;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function callClaude(env: Env, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch(`${env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.AI_MODEL || DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
}

function parseQuestions(raw: string): string[] {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { questions?: unknown };
    return Array.isArray(parsed.questions) ? parsed.questions.filter((q): q is string => typeof q === "string").slice(0, 3) : [];
  } catch {
    return [];
  }
}

async function handleAi(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.ANTHROPIC_API_KEY) return json({ error: "AI isn't configured" }, 501);
  if (!(await isSignedIn(request, env))) return json({ error: "Please sign in" }, 401);

  let body: AiRequest;
  try {
    body = (await request.json()) as AiRequest;
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const text = (body.text ?? "").trim();
  if (!text) return json({ error: "Nothing to work with" }, 400);
  if (text.length > MAX_INPUT) return json({ error: "That's a bit long to work with at once" }, 413);

  try {
    if (body.task === "questions") {
      const raw = await callClaude(env, QUESTION_RULES, `${contextLine(body.context)}What they wrote so far:\n"""\n${text}\n"""`, 300);
      return json({ questions: parseQuestions(raw) });
    }
    const out = await callClaude(env, WRITING_RULES, buildUserMessage(body), 700);
    return json({ text: out });
  } catch {
    return json({ error: "The writing help is unavailable right now" }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/ai") return handleAi(request, env);
    return env.ASSETS.fetch(request);
  },
};
