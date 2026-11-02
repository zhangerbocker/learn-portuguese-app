import { beforeEach, describe, expect, it } from "vitest";
import type { Identity } from "./auth";
import { GUEST_LIMIT_USD, recordGuestSpend } from "./budget";
import { migrate, pgliteDb, type Db } from "./db";
import { explainHandler, systemPrompt, type Explainer, type ExplainRequest } from "./explain";
import { TutorError } from "./tutor";

const NOW = new Date("2026-11-02T12:00:00Z");
const OWNER: Identity = { role: "owner", id: "owner" };
const GUEST: Identity = { role: "guest", id: "g1" };

function fakeExplainer(fail?: Error) {
  const calls: ExplainRequest[] = [];
  const explainer: Explainer = {
    async explain(request) {
      calls.push(request);
      if (fail) throw fail;
      return { value: "'Lhe' means 'to you'.", costUsd: 0.004 };
    },
  };
  return { explainer, calls };
}

let db: Db;
beforeEach(async () => {
  db = await pgliteDb();
  await migrate(db);
});

const handler = (explainer: Explainer, who: Identity | null = OWNER) =>
  explainHandler(explainer, { getDb: async () => db, identify: () => who, now: () => NOW });
const post = (body: unknown) => new Request("http://localhost/api/explain", { method: "POST", body: JSON.stringify(body) });
const BASE = { word: "lhe", lemma: "lhe", sentence: "Eu lhe dou o livro amanhã.", level: 1, history: [] };

describe("explainHandler", () => {
  it("explains a word in its sentence", async () => {
    const { explainer, calls } = fakeExplainer();
    const res = await handler(explainer)(post(BASE));
    expect(await res.json()).toEqual({ answer: "'Lhe' means 'to you'.", budget: null });
    expect(calls[0]).toMatchObject({ word: "lhe", sentence: "Eu lhe dou o livro amanhã." });
  });

  it("passes follow-up questions with the earlier answers", async () => {
    const { explainer, calls } = fakeExplainer();
    await handler(explainer)(post({ ...BASE, history: [{ question: "", answer: "first" }], question: "Is it formal?" }));
    expect(calls[0]).toMatchObject({ question: "Is it formal?", history: [{ question: "", answer: "first" }] });
  });

  it("rejects oversized or malformed requests", async () => {
    expect((await handler(fakeExplainer().explainer)(post({ ...BASE, word: "x".repeat(61) }))).status).toBe(400);
    expect((await handler(fakeExplainer().explainer)(post({ ...BASE, history: Array(5).fill({ question: "q", answer: "a" }) }))).status).toBe(400);
    expect((await handler(fakeExplainer().explainer, null)(post(BASE))).status).toBe(401);
  });

  it("charges a guest's chat budget and refuses once it's used up", async () => {
    const res = await handler(fakeExplainer().explainer, GUEST)(post(BASE));
    expect((await res.json()).budget.spentUsd).toBeCloseTo(0.004);
    await recordGuestSpend(db, GUEST.id, GUEST_LIMIT_USD, NOW);
    const { explainer, calls } = fakeExplainer();
    const refused = await handler(explainer, GUEST)(post(BASE));
    expect(refused.status).toBe(402);
    expect(calls).toHaveLength(0);
  });

  it("answers 502 with the cause when the tutor fails", async () => {
    const res = await handler(fakeExplainer(new TutorError("timed out")).explainer)(post(BASE));
    expect(res.status).toBe(502);
  });
});

describe("systemPrompt", () => {
  it("asks for a short, Brazilian, level-appropriate explanation", () => {
    expect(systemPrompt(2)).toMatch(/CEFR A2/);
    expect(systemPrompt(2)).toMatch(/Brazilian/);
  });
});
