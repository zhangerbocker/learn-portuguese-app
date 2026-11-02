import { describe, expect, it } from "vitest";
import { exerciseCount, planLesson, seededRandom, THEMES, themeFor, troubleItems, type LessonInput, type Step } from "./daily";
import { answerStep, startPractice } from "./daily-store";
import { LIBRARY } from "./reading";
import { lookupForm } from "./segment";
import { gradeItem, Rating, type Progress } from "./srs";
import { WORDS, type Word } from "./words";

const NOW = new Date("2026-11-02T12:00:00Z");
const TODAY = "2026-11-02";

function input(overrides: Partial<LessonInput> = {}): LessonInput {
  return { words: WORDS, stories: LIBRARY, progress: { items: {} }, reviews: [], readIds: new Set(), levels: [1, 2], date: TODAY, now: NOW, ...overrides };
}
const miss = (key: string, at: string) => ({ key, rating: Rating.DontKnow, at });
const choiceSteps = (steps: Step[]): { options: string[]; answer: number }[] =>
  steps.flatMap((s): { options: string[]; answer: number }[] => (s.kind === "reading" ? s.questions : []));

describe("troubleItems", () => {
  it("lists items missed at least twice in the last 30 days, most missed first", () => {
    const reviews = [
      miss("w:1:r", "2026-11-01T10:00:00Z"),
      miss("s:1:p", "2026-10-30T10:00:00Z"), // a sentence card belongs to the same word
      miss("w:2:r", "2026-11-01T10:00:00Z"),
      miss("w:3:r", "2026-11-01T10:00:00Z"),
      miss("w:3:r", "2026-11-01T11:00:00Z"),
      miss("w:3:r", "2026-11-01T12:00:00Z"),
      miss("w:4:r", "2026-09-01T10:00:00Z"),
      miss("w:4:r", "2026-09-02T10:00:00Z"), // too long ago
      { key: "w:5:r", rating: Rating.Know, at: "2026-11-01T10:00:00Z" },
    ];
    expect(troubleItems(reviews, NOW)).toEqual(["w:3", "w:1"]);
  });
});

describe("themeFor", () => {
  it("rotates through the themes by date, never 'Function words'", () => {
    const days = Array.from({ length: THEMES.length }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
    expect(new Set(days.map((d) => themeFor(d, WORDS, [])))).toEqual(new Set(THEMES));
    expect(THEMES).not.toContain("Function words");
  });

  it("jumps to a theme with clearly more trouble words", () => {
    const scheduled = themeFor(TODAY, WORDS, []);
    const other = THEMES.find((t) => t !== scheduled)!;
    const trouble = WORDS.filter((w) => w.topic === other).slice(0, 3).map((w) => `w:${w.id}`);
    expect(themeFor(TODAY, WORDS, trouble)).toBe(other);
    expect(themeFor(TODAY, WORDS, trouble.slice(0, 2))).toBe(scheduled);
  });
});

describe("seededRandom", () => {
  it("repeats for the same seed and differs between seeds", () => {
    const a = seededRandom("2026-11-02#0");
    const b = seededRandom("2026-11-02#0");
    const c = seededRandom("2026-11-02#1");
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
  });
});

describe("planLesson", () => {
  it("builds about 12 exercises: theme words around a short read", () => {
    const lesson = planLesson(input());
    expect(exerciseCount(lesson)).toBeGreaterThanOrEqual(10);
    expect(exerciseCount(lesson)).toBeLessThanOrEqual(14);
    expect(lesson.steps.filter((s) => s.kind === "reading")).toHaveLength(1);
    expect(new Set(lesson.steps.map((s) => s.kind)).size).toBeGreaterThanOrEqual(3);
  });

  it("is the same all day, and different for practice again", () => {
    expect(planLesson(input())).toEqual(planLesson(input()));
    expect(planLesson(input({ round: 1 }))).not.toEqual(planLesson(input()));
  });

  it("starts with words you keep missing, and brings today's misses back tomorrow", () => {
    const missed = WORDS.filter((w) => w.level === 1).slice(10, 12);
    const progress: Progress = { items: Object.fromEntries(missed.map((w) => [`w:${w.id}`, gradeItem(undefined, Rating.DontKnow, NOW, TODAY)])) };
    const reviews = [miss(`w:${missed[1].id}:r`, "2026-11-01T10:00:00Z"), miss(`w:${missed[1].id}:r`, "2026-11-02T10:00:00Z")];
    for (const date of [TODAY, "2026-11-03"]) {
      const lesson = planLesson(input({ progress, reviews, date }));
      const review = lesson.steps.filter((s) => s.source === "review").map((s) => (s.kind === "reading" ? "" : s.item));
      // The trouble word (missed twice) leads; the other missed word follows.
      expect(review.slice(0, 2)).toEqual([`w:${missed[1].id}`, `w:${missed[0].id}`]);
    }
  });

  it("gives every story question four distinct options including the answer", () => {
    for (const date of ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]) {
      for (const step of choiceSteps(planLesson(input({ date })).steps)) {
        expect(step.options).toHaveLength(4);
        expect(new Set(step.options.map(lookupForm)).size).toBe(4);
        expect(step.answer).toBeGreaterThanOrEqual(0);
        expect(step.answer).toBeLessThan(4);
      }
    }
  });

  it("fills each blank with the word as it appears in its example sentence", () => {
    for (const date of ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]) {
      for (const step of planLesson(input({ date })).steps) {
        if (step.kind !== "blank") continue;
        const word = WORDS.find((w) => `w:${w.id}` === step.item)!;
        expect(step.before + step.answer + step.after).toBe(word.example.pt);
        expect(word.forms.concat(word.pt).map(lookupForm)).toContain(lookupForm(step.answer));
        expect(step.hint).toBe(word.pt);
      }
    }
  });

  it("asks for typed answers: the word with its article, or the whole example sentence", () => {
    const kinds = new Set<string>();
    for (const date of ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]) {
      for (const step of planLesson(input({ date })).steps) {
        kinds.add(step.kind);
        if (step.kind === "reading" || step.kind === "blank") continue;
        const word = WORDS.find((w) => `w:${w.id}` === step.item)!;
        if (step.kind === "meaning") {
          expect(step.prompt).toBe(word.english);
          expect([step.answer, ...step.alternatives]).toContain(word.pt);
        } else {
          expect(step.answer).toBe(word.example.pt);
          expect(step.en).toBe(word.example.en);
          expect(step.answer.split(/\s+/).length).toBeLessThanOrEqual(10);
        }
      }
    }
    expect(kinds).toEqual(new Set(["meaning", "blank", "translate", "reading"]));
  });

  it("keeps to the switched-on levels", () => {
    const levelOf = new Map(WORDS.map((w: Word) => [`w:${w.id}`, w.level]));
    for (const date of ["2026-11-02", "2026-11-03", "2026-11-04"]) {
      const lesson = planLesson(input({ date, levels: [1, 2] }));
      for (const s of lesson.steps) {
        if (s.kind === "reading") expect(LIBRARY.find((st) => st.id === s.storyId)!.level).toBeLessThanOrEqual(2);
        else expect(levelOf.get(s.item)).toBeLessThanOrEqual(2);
      }
    }
  });

  it("keeps reads short: a whole short story, or an excerpt of about 120 words", () => {
    for (const levels of [[1, 2], [1, 2, 3, 4]] as const) {
      for (const date of ["2026-11-02", "2026-11-07", "2026-11-12"]) {
        const read = planLesson(input({ date, levels: [...levels] })).steps.find((s) => s.kind === "reading");
        if (!read || read.kind !== "reading") continue;
        const story = LIBRARY.find((s) => s.id === read.storyId)!;
        const words = story.sentences
          .slice(0, read.sentenceCount)
          .reduce((n, s) => n + s.tokens.filter((t) => /\p{L}/u.test(t.text)).length, 0);
        expect(words).toBeLessThanOrEqual(read.sentenceCount === story.sentences.length ? 160 : 130);
        expect(read.questions.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("answering a lesson", () => {
  const lesson = planLesson(input());

  it("brings a wrong step back once at the end, without counting the retry", () => {
    let p = startPractice(lesson);
    const first = p.queue[0];
    p = answerStep(p, 0, 1); // wrong
    expect(p.queue[p.queue.length - 1]).toBe(first);
    expect(p.missed).toEqual([first]);
    while (p.queue.length > 1) p = answerStep(p, 1, 1);
    p = answerStep(p, 0, 1); // wrong again on the retry: it doesn't come back a third time
    expect(p.queue).toEqual([]);
    expect(p.answered).toBe(lesson.steps.length);
  });
});
