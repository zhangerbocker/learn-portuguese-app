// "Ask the tutor" about a word (server only: reads the API key). The learner taps a word in an
// exercise or story and gets a short explanation of it in that sentence, with follow-up questions.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { LevelSchema, LEVEL_NAMES, type Level } from "../levels";
import { createClient } from "./anthropic-client";
import type { Identity } from "./auth";
import { budgetFor, costUsd, recordGuestSpend } from "./budget";
import type { Db } from "./db";
import { CHAT_MODEL, TutorError, type Priced } from "./tutor";

/** Limits on what the browser may send, so one request can't run up the bill. */
export const ExplainRequest = z.object({
  /** The word as it appears (fui), and its dictionary form when known (ir). */
  word: z.string().trim().min(1).max(60),
  lemma: z.string().trim().max(60).optional(),
  english: z.string().trim().max(200).optional(),
  /** The sentence it appeared in. */
  sentence: z.string().trim().max(400).optional(),
  level: LevelSchema,
  /** Earlier questions and answers in this panel, oldest first. */
  history: z.array(z.object({ question: z.string().max(300), answer: z.string().max(2000) })).max(4),
  /** A follow-up question; omitted for the first explanation. */
  question: z.string().trim().min(1).max(300).optional(),
});
export type ExplainRequest = z.infer<typeof ExplainRequest>;

/** The app's interface to the explanation model, so the route can be tested with a fake. */
export interface Explainer {
  explain(request: ExplainRequest): Promise<Priced<string>>;
}

const FIRST_QUESTION = "Explain this word as it's used here.";

export function systemPrompt(level: Level): string {
  return `You are a friendly Brazilian Portuguese tutor for an adult English speaker at CEFR ${LEVEL_NAMES[level]}.
The learner tapped a word while practicing and wants to understand it.
- Answer in English, in at most 120 words. Plain text: no headings or tables; "- " for a short list is fine; use *asterisks* only to mark Portuguese words.
- Explain what the word means in the given sentence, what kind of word it is, and when and how Brazilians use it (register: everyday speech vs. formal or written), including common alternatives if natural speech prefers one.
- Give one or two short Portuguese examples with English translations.
- Brazilian usage. Be accurate; if a question goes beyond the word, answer briefly and helpfully.`;
}

function userMessage(request: ExplainRequest, question: string): string {
  const parts = [`Word: ${request.word}`];
  if (request.lemma && request.lemma !== request.word) parts.push(`Dictionary form: ${request.lemma}`);
  if (request.english) parts.push(`Dictionary meaning: ${request.english}`);
  if (request.sentence) parts.push(`Sentence: ${request.sentence}`);
  return `${parts.join("\n")}\n\n${question}`;
}

export function createClaudeExplainer(client = createClient({ timeout: 30_000, maxRetries: 1 })): Explainer {
  return {
    async explain(request) {
      // The first turn carries the word and sentence; follow-ups build on it.
      const turns = [...request.history, ...(request.question ? [{ question: request.question, answer: "" }] : [])];
      const [first, ...rest] = turns.length ? turns : [{ question: FIRST_QUESTION, answer: "" }];
      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userMessage(request, first.question || FIRST_QUESTION) },
        ...(first.answer ? [{ role: "assistant" as const, content: first.answer }] : []),
        ...rest.flatMap((t): Anthropic.MessageParam[] => [
          { role: "user", content: t.question },
          ...(t.answer ? [{ role: "assistant" as const, content: t.answer }] : []),
        ]),
      ];
      let response: Anthropic.Message;
      try {
        response = await client.messages.create({ model: CHAT_MODEL, max_tokens: 1200, system: systemPrompt(request.level), messages });
      } catch (err) {
        if (err instanceof Anthropic.APIError) throw new TutorError(err.message);
        throw err;
      }
      const cost = costUsd(response.model || CHAT_MODEL, response.usage);
      if (response.stop_reason === "refusal") throw new TutorError("the tutor declined to answer this", cost);
      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
      if (!text) throw new TutorError(`the tutor's answer was empty (stop_reason=${response.stop_reason})`, cost);
      return { value: text, costUsd: cost };
    },
  };
}

export interface ExplainDeps {
  getDb: () => Promise<Db>;
  identify: (request: Request) => Identity | null;
  now?: () => Date;
}

/**
 * Handles POST /api/explain. Body: ExplainRequest. Responds { answer, budget } (budget is null for
 * the owner). Guests share their chat budget: 402 with the budget once it's used up.
 */
export function explainHandler(explainer: Explainer, deps: ExplainDeps) {
  const now = deps.now ?? (() => new Date());
  return async function POST(request: Request): Promise<Response> {
    const identity = deps.identify(request);
    if (!identity) return Response.json({ error: "Not signed in" }, { status: 401 });
    const parsed = ExplainRequest.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return Response.json({ error: `${issue.path.join(".") || "body"}: ${issue.message}` }, { status: 400 });
    }
    const db = await deps.getDb();
    const before = await budgetFor(db, identity);
    if (before && !before.allowed) {
      return Response.json({ error: "The guest budget for the AI tutor is used up.", budget: before }, { status: 402 });
    }
    const charge = async (usd: number) => {
      if (identity.role === "guest") await recordGuestSpend(db, identity.id, usd, now());
    };
    try {
      const reply = await explainer.explain(parsed.data);
      await charge(reply.costUsd);
      return Response.json({ answer: reply.value, budget: await budgetFor(db, identity) });
    } catch (err) {
      if (!(err instanceof TutorError)) throw err;
      await charge(err.costUsd);
      console.error(`explain failed: ${err.message}`);
      return Response.json({ error: `Couldn't reach the tutor: ${err.message}` }, { status: 502 });
    }
  };
}
