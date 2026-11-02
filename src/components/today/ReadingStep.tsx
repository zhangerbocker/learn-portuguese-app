import { useState } from "react";
import type { Step } from "@/lib/daily";
import { LIBRARY, markRead } from "@/lib/reading";
import { LEVEL_NAMES } from "@/lib/words";
import { WordPanel, type WordTap } from "../WordPanel";
import { Choices } from "./Choices";
import { Feedback } from "./Feedback";

type ReadingStepData = Extract<Step, { kind: "reading" }>;

/** A short story (or the start of one): tap words for their meaning, then answer the questions. */
export function ReadingStep({ step, onDone }: { step: ReadingStepData; onDone: (right: number, asked: number) => void }) {
  const story = LIBRARY.find((s) => s.id === step.storyId);
  const [picks, setPicks] = useState<(number | null)[]>(step.questions.map(() => null));
  const [tap, setTap] = useState<WordTap | null>(null);
  const [showEn, setShowEn] = useState(false);
  if (!story) {
    // The story was removed since the lesson was planned: skip it without counting.
    return <Feedback right onContinue={() => onDone(0, 0)}>This reading is no longer available.</Feedback>;
  }
  const sentences = story.sentences.slice(0, step.sentenceCount);
  const whole = step.sentenceCount >= story.sentences.length;
  const answered = picks.every((p) => p !== null);
  const right = picks.filter((p, i) => p === step.questions[i].answer).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-red-700 dark:text-red-400">
          Read {whole ? "the story" : "the start of the story"}
        </p>
        <h2 className="font-pt mt-1 text-2xl">{story.title}</h2>
        <p className="text-sm text-stone-500">
          {story.titleEn} · {LEVEL_NAMES[story.level]} · tap a word for its meaning
        </p>
      </div>
      <article className="font-pt rounded-[20px] border border-stone-200 bg-white p-4 text-xl leading-[1.8] dark:border-stone-800 dark:bg-stone-900">
        {sentences.map((sentence, si) => (
          <span key={si}>
            {sentence.tokens.map((t, ti) =>
              t.en || t.wordId !== undefined ? (
                <span
                  key={ti}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTap({ text: t.text, wordId: t.wordId, en: t.en, sentence: sentence.tokens.map((x) => x.text).join("") })}
                  className="cursor-pointer rounded hover:bg-stone-200/70 dark:hover:bg-stone-800"
                >
                  {t.text}
                </span>
              ) : (
                <span key={ti}>{t.text}</span>
              ),
            )}{" "}
          </span>
        ))}
        {!whole && <span className="text-stone-400">…</span>}
      </article>
      <button type="button" onClick={() => setShowEn((s) => !s)} className="self-start text-sm text-stone-500 underline">
        {showEn ? "Hide the English" : "Show the English"}
      </button>
      {showEn && <p className="-mt-3 text-sm text-stone-600 dark:text-stone-300">{sentences.map((s) => s.en).join(" ")}</p>}

      {step.questions.map((q, qi) => (
        <div key={qi} className="flex flex-col gap-2">
          <p className="font-pt text-xl">{q.q}</p>
          <p className="-mt-2 text-sm text-stone-500">{q.qEn}</p>
          <Choices
            options={q.options}
            answer={q.answer}
            picked={picks[qi]}
            onPick={(i) => setPicks((p) => p.map((v, j) => (j === qi ? (v ?? i) : v)))}
            pt={q.q !== "O que acontece na história?"}
          />
        </div>
      ))}
      {answered && (
        <Feedback
          right={right === step.questions.length}
          onContinue={() => {
            if (whole) markRead(window.localStorage, story.id);
            onDone(right, step.questions.length);
          }}
        >
          {right} of {step.questions.length} right.
        </Feedback>
      )}

      {tap && <WordPanel tap={tap} onClose={() => setTap(null)} />}
    </div>
  );
}
