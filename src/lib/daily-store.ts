import { z } from "zod";
import type { Lesson } from "./daily";
import { LevelSchema } from "./levels";
import { notifyStorageChange, type KeyValueStorage } from "./progress-store";
import { TOPICS } from "./topics";

/**
 * A lesson being worked through. Steps are done in order; a step answered wrong comes back
 * once at the end (reads don't repeat). Kept in browser storage so leaving the tab resumes it.
 */
export interface Practice {
  lesson: Lesson;
  /** 0 for the day's lesson; 1, 2… for "practice again" the same day. */
  round: number;
  /** Step indexes still to do; the first is on screen. */
  queue: number[];
  /** Steps answered wrong at least once, in order. */
  missed: number[];
  /** Answers right the first time (each read question counts). */
  rightFirstTime: number;
  /** Answers given the first time through (each read question counts). */
  answered: number;
}

export function startPractice(lesson: Lesson, round = 0): Practice {
  return { lesson, round, queue: lesson.steps.map((_, i) => i), missed: [], rightFirstTime: 0, answered: 0 };
}

/**
 * Records the answer to the step on screen and moves on. `right` and `asked` count the
 * questions in it (a read has several). A wrong step comes back once at the end.
 */
export function answerStep(practice: Practice, right: number, asked: number): Practice {
  const [step, ...rest] = practice.queue;
  if (step === undefined) return practice;
  const retry = practice.missed.includes(step);
  const wrong = right < asked;
  const comesBack = wrong && !retry && practice.lesson.steps[step].kind !== "reading";
  return {
    ...practice,
    queue: comesBack ? [...rest, step] : rest,
    missed: wrong && !retry ? [...practice.missed, step] : practice.missed,
    // Retries don't count toward the score: it's about the first time through.
    rightFirstTime: practice.rightFirstTime + (retry ? 0 : right),
    answered: practice.answered + (retry ? 0 : asked),
  };
}

export const isFinished = (practice: Practice) => practice.queue.length === 0;

const PRACTICE_KEY = "pt.daily.v1";
const DONE_KEY = "pt.dailyDone.v1";

const SavedPractice = z.object({
  lesson: z.object({
    date: z.string(),
    topic: z.enum(TOPICS),
    level: LevelSchema,
    steps: z.array(z.object({ kind: z.enum(["meaning", "blank", "translate", "reading"]) }).passthrough()),
  }),
  round: z.number().int().min(0),
  queue: z.array(z.number().int().min(0)),
  missed: z.array(z.number().int().min(0)),
  rightFirstTime: z.number().int().min(0),
  answered: z.number().int().min(0),
});

function readJson(storage: KeyValueStorage, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    return null;
  }
}

/** The lesson in progress (or just finished); null if none or unreadable. */
export function loadPractice(storage: KeyValueStorage): Practice | null {
  const parsed = SavedPractice.safeParse(readJson(storage, PRACTICE_KEY));
  if (!parsed.success) return null;
  const practice = parsed.data as unknown as Practice;
  const steps = practice.lesson.steps.length;
  return practice.queue.every((i) => i < steps) ? practice : null;
}

export function savePractice(storage: KeyValueStorage, practice: Practice | null): void {
  storage.setItem(PRACTICE_KEY, JSON.stringify(practice));
  notifyStorageChange();
}

/** Days (YYYY-MM-DD) on which a lesson was finished. */
export function loadDoneDays(storage: KeyValueStorage): string[] {
  const value = readJson(storage, DONE_KEY);
  return Array.isArray(value) ? value.filter((d): d is string => typeof d === "string") : [];
}

export function markDone(storage: KeyValueStorage, day: string): void {
  const days = loadDoneDays(storage);
  if (days.includes(day)) return;
  storage.setItem(DONE_KEY, JSON.stringify([...days, day].slice(-400)));
  notifyStorageChange();
}

export const PRACTICE_STORAGE_KEY = PRACTICE_KEY;
export const DONE_STORAGE_KEY = DONE_KEY;
