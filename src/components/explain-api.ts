import { z } from "zod";
import type { Level } from "@/lib/levels";
import { GuestBudget } from "@/lib/me";
import { setMe } from "./useMe";

const Reply = z.object({ answer: z.string(), budget: GuestBudget.nullable() });
const ErrorReply = z.object({ error: z.string(), budget: GuestBudget.nullable().optional() });

export interface ExplainParams {
  word: string;
  lemma?: string;
  english?: string;
  sentence?: string;
  level: Level;
  history: { question: string; answer: string }[];
  question?: string;
}

/** Asks the AI tutor about a word; throws with a message to show. Keeps a guest's budget display current. */
export async function askTutor(params: ExplainParams): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") throw new Error("The tutor took too long to answer.");
    if (err instanceof TypeError) throw new Error("Couldn't reach the tutor. Check your connection.");
    throw err;
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ErrorReply.safeParse(json);
    if (parsed.success && parsed.data.budget) setMe({ role: "guest", budget: parsed.data.budget });
    throw new Error(parsed.success ? parsed.data.error : `The tutor failed (HTTP ${res.status}).`);
  }
  const parsed = Reply.safeParse(json);
  if (!parsed.success) throw new Error("The tutor sent an answer the app couldn't read.");
  if (parsed.data.budget) setMe({ role: "guest", budget: parsed.data.budget });
  return parsed.data.answer;
}
