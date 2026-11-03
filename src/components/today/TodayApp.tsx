"use client";

import { useMemo, useState } from "react";
import { exerciseCount, planLesson, type Lesson, type Step } from "@/lib/daily";
import { answerStep, isFinished, loadDoneDays, loadPractice, markDone, savePractice, startPractice, type Practice } from "@/lib/daily-store";
import { appendReview, loadReviews, localDay, saveProgress } from "@/lib/progress-store";
import { LIBRARY } from "@/lib/reading";
import { gradeItem, Rating } from "@/lib/srs";
import { streak } from "@/lib/stats";
import { LEVEL_NAMES, withArticle, WORDS, WORDS_BY_ID } from "@/lib/words";
import { useActiveLevels, useProgress, useReadIds } from "../useSettings";
import { ReadingStep } from "./ReadingStep";
import { BlankStep, MeaningStep, TranslateStep } from "./TypedSteps";

const kicker = "font-mono text-[11px] uppercase tracking-[0.18em] text-red-700 dark:text-red-400";
const primary = "rounded-full bg-red-700 py-3 font-medium text-white hover:bg-red-800 dark:bg-red-500 dark:hover:bg-red-400";

/** The word a step practices, if any (reads don't practice one word). */
function wordOf(step: Step) {
  return step.kind === "reading" ? undefined : WORDS_BY_ID.get(Number(step.item.slice(2)));
}

export function TodayApp() {
  const today = localDay(new Date());
  const progress = useProgress();
  const levels = useActiveLevels();
  const readIds = useReadIds();
  // A lesson from an earlier day is dropped: each day starts fresh.
  const [practice, setPractice] = useState<Practice | null>(() => {
    const saved = loadPractice(window.localStorage);
    return saved && saved.lesson.date === today ? saved : null;
  });
  const [inLesson, setInLesson] = useState(() => practice !== null && !isFinished(practice));

  function plan(round: number): Lesson {
    return planLesson({
      words: WORDS,
      stories: LIBRARY,
      progress,
      reviews: loadReviews(window.localStorage),
      readIds,
      levels,
      date: today,
      now: new Date(),
      round,
    });
  }

  function begin(round: number) {
    const next = startPractice(plan(round), round);
    savePractice(window.localStorage, next);
    setPractice(next);
    setInLesson(true);
  }

  /** Records an answer on the word's schedule, as Cards does, so misses lead the next lessons. */
  function record(item: string, right: boolean) {
    const at = new Date();
    const rating = right ? Rating.Know : Rating.DontKnow;
    saveProgress(window.localStorage, { items: { ...progress.items, [item]: gradeItem(progress.items[item], rating, at, localDay(at)) } });
    appendReview(window.localStorage, { key: `${item}:r`, rating, at: at.toISOString() });
  }

  function onStepDone(right: number, asked: number) {
    if (!practice) return;
    const index = practice.queue[0];
    const step = practice.lesson.steps[index];
    // Only the first answer counts on the word's schedule: getting a retry right right after
    // seeing the answer shouldn't clear the miss, so the word leads the next lesson.
    if (step.kind !== "reading" && !practice.missed.includes(index)) record(step.item, right === asked);
    const next = answerStep(practice, right, asked);
    savePractice(window.localStorage, next);
    setPractice(next);
    if (isFinished(next)) {
      markDone(window.localStorage, today);
      setInLesson(false);
    }
  }

  if (practice && inLesson && !isFinished(practice)) {
    const index = practice.queue[0];
    const step = practice.lesson.steps[index];
    const total = practice.lesson.steps.length + practice.missed.length;
    const done = total - practice.queue.length;
    const retry = practice.missed.includes(index);
    // A new key per attempt resets the step (a missed step comes back fresh).
    const key = `${index}-${done}`;
    return (
      <div className="flex flex-1 flex-col gap-5">
        <header className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Pause the lesson"
            onClick={() => setInLesson(false)}
            className="rounded-full p-1 text-xl leading-none text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
          >
            ×
          </button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800" aria-hidden="true">
            <div className="h-full bg-red-700 transition-all dark:bg-red-400" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className="text-xs text-stone-500">
            {done + 1}/{total}
          </span>
        </header>
        {retry && <p className="-mb-2 text-xs text-stone-500">One more try at one you missed</p>}
        {step.kind === "meaning" && <MeaningStep key={key} step={step} onDone={onStepDone} />}
        {step.kind === "blank" && <BlankStep key={key} step={step} onDone={onStepDone} />}
        {step.kind === "translate" && <TranslateStep key={key} step={step} onDone={onStepDone} />}
        {step.kind === "reading" && <ReadingStep key={key} step={step} onDone={onStepDone} />}
      </div>
    );
  }

  return (
    <TodayHome
      today={today}
      practice={practice}
      plan={plan}
      onStart={() => (practice && !isFinished(practice) ? setInLesson(true) : begin(practice ? practice.round + 1 : 0))}
    />
  );
}

/** Before a lesson: the day's theme and what's in it. After: the score and the words to watch. */
function TodayHome({
  today,
  practice,
  plan,
  onStart,
}: {
  today: string;
  practice: Practice | null;
  plan: (round: number) => Lesson;
  onStart: () => void;
}) {
  // The lesson Start would begin (the saved one, or today's), for the preview.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lesson = useMemo(() => practice?.lesson ?? plan(0), [practice]);
  const reviews = loadReviews(window.localStorage);
  const days = streak(reviews, today);
  const doneToday = loadDoneDays(window.localStorage).includes(today);
  const finished = practice !== null && isFinished(practice);
  const paused = practice !== null && !finished;
  const count = (source: Step["source"]) => lesson.steps.filter((s) => s.source === source).length;
  const preview = lesson.steps.flatMap((s) => (s.source === "theme" ? (wordOf(s) ?? []) : [])).slice(0, 6);
  const toWatch = finished ? [...new Set(practice.missed.flatMap((i) => wordOf(practice.lesson.steps[i]) ?? []))] : [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className={kicker}>{finished ? "Lesson complete" : "Today's lesson"}</p>
          <h1 className="font-pt mt-1 text-4xl leading-tight">{finished ? "Muito bem!" : lesson.topic}</h1>
          {!finished && <p className="text-sm text-stone-500">{LEVEL_NAMES[lesson.level]} · about 5 minutes</p>}
        </div>
        <div className="shrink-0 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-center dark:border-stone-800 dark:bg-stone-900">
          <p className="font-pt text-2xl leading-none">{days}</p>
          <p className="text-[11px] text-stone-500">day streak{doneToday ? " ✓" : ""}</p>
        </div>
      </header>

      {finished ? (
        <section className="flex flex-col gap-4 rounded-[22px] border border-stone-200 bg-white p-5 shadow-[0_30px_60px_-44px_rgba(27,25,22,0.5)] dark:border-stone-800 dark:bg-stone-900">
          <p className="text-lg">
            <b>{practice.rightFirstTime}</b> of {practice.answered} right the first time · {lesson.topic}
          </p>
          {toWatch.length > 0 ? (
            <div>
              <p className={kicker}>Coming back next time</p>
              <ul className="mt-2 flex flex-col gap-1">
                {toWatch.map((w) => (
                  <li key={w.id}>
                    <span className="font-pt text-lg">{withArticle(w)}</span> <span className="text-stone-500">· {w.english}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-stone-600 dark:text-stone-300">No mistakes today.</p>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-[22px] border border-stone-200 bg-white p-5 shadow-[0_30px_60px_-44px_rgba(27,25,22,0.5)] dark:border-stone-800 dark:bg-stone-900">
          <p className={kicker}>What you&apos;re learning today</p>
          <ul className="flex flex-col gap-1 text-stone-700 dark:text-stone-200">
            {count("review") > 0 && <li>↺ {count("review")} to review: words you missed or that are due</li>}
            <li>✦ {count("theme")} on {lesson.topic.toLowerCase()}</li>
            {count("reading") > 0 && <li>❏ a short read with questions</li>}
          </ul>
          {preview.length > 0 && (
            <p className="font-pt flex flex-wrap gap-1.5 text-lg">
              {preview.map((w) => (
                <span key={w.id} title={w.english} className="rounded-lg bg-stone-100 px-2 py-0.5 dark:bg-stone-800">
                  {withArticle(w)}
                </span>
              ))}
            </p>
          )}
          <p className="text-xs text-stone-500">{exerciseCount(lesson)} exercises · say it in Portuguese, fill in the blank, translate, read</p>
        </section>
      )}

      <button type="button" onClick={onStart} className={primary}>
        {paused ? "Continue the lesson" : finished || doneToday ? "Practice again" : "Start"}
      </button>
      {(finished || doneToday) && <p className="-mt-3 text-center text-xs text-stone-500">Today&apos;s lesson is done; extra practice builds a new one.</p>}
    </div>
  );
}
