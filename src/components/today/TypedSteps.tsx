import { useState, type ReactNode } from "react";
import { checkAnswer } from "@/lib/answer";
import type { Step } from "@/lib/daily";
import { SpeakButton } from "../cards/SpeakButton";
import { TappableText } from "../TappableText";
import { useSettings } from "../useSettings";
import { Feedback } from "./Feedback";

type Done = (right: number, asked: number) => void;
const kicker = "font-mono text-[11px] uppercase tracking-[0.18em] text-red-700 dark:text-red-400";

/**
 * A typed Portuguese answer, checked like Cards (case and punctuation ignored; accents optional
 * per the setting). After checking, the answer is shown with every word tappable for its
 * meaning, a usage note and "ask the tutor". A wrong answer can be counted as right when the
 * learner's wording was also correct (there's often more than one way to say it).
 */
function TypedAnswer({
  label,
  prompt,
  expected,
  alternatives = [],
  shown,
  sentence,
  placeholder,
  onDone,
}: {
  label: string;
  prompt: ReactNode;
  expected: string;
  alternatives?: string[];
  /** The full Portuguese to show after checking (the whole sentence for a blank). */
  shown: string;
  sentence: string;
  placeholder: string;
  onDone: Done;
}) {
  const [{ accentsOptional }] = useSettings();
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);
  const result = checkAnswer(typed, expected, alternatives);
  const right = result.correct || (accentsOptional && result.accentsOnly);

  return (
    <div className="flex flex-col gap-5">
      <p className={kicker}>{label}</p>
      {prompt}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) setChecked(true);
        }}
        className="flex flex-col gap-3"
      >
        <input
          autoFocus
          lang="pt-BR"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={checked}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={placeholder}
          aria-label="Your answer in Portuguese"
          className={`font-pt w-full rounded-2xl border bg-white px-4 py-3 text-xl outline-none focus:border-red-700 dark:bg-stone-950 ${
            !checked
              ? "border-stone-300 dark:border-stone-700"
              : right
                ? "border-emerald-400 dark:border-emerald-700"
                : "border-rose-300 dark:border-rose-800"
          }`}
        />
        {!checked && (
          <button
            type="submit"
            disabled={!typed.trim()}
            className="rounded-full bg-red-700 py-3 font-medium text-white hover:bg-red-800 disabled:opacity-40 dark:bg-red-500 dark:hover:bg-red-400"
          >
            Check
          </button>
        )}
      </form>
      {checked && (
        <Feedback right={right} onContinue={() => onDone(right ? 1 : 0, 1)}>
          <span className="flex flex-wrap items-center gap-1">
            {right && result.accentsOnly ? "With accents: " : right ? "" : "Answer: "}
            <TappableText text={shown} sentence={sentence} className="font-pt text-xl" />
            <SpeakButton text={shown} label="Play the answer" />
          </span>
          <span className="mt-1 block text-xs opacity-80">Tap any word for its meaning, how it&apos;s used, or to ask the tutor.</span>
          {!right && (
            <button
              type="button"
              onClick={() => onDone(1, 1)}
              className="mt-2 text-xs underline opacity-80 hover:opacity-100"
            >
              My answer means the same, count it as right
            </button>
          )}
        </Feedback>
      )}
    </div>
  );
}

/** English word → type the Portuguese (nouns with or without their article). */
export function MeaningStep({ step, onDone }: { step: Extract<Step, { kind: "meaning" }>; onDone: Done }) {
  return (
    <TypedAnswer
      label="How do you say this in Portuguese?"
      prompt={
        <div>
          <p className="text-3xl">{step.prompt}</p>
          <p className="mt-1 text-sm text-stone-500">{step.hint}</p>
        </div>
      }
      expected={step.answer}
      alternatives={step.alternatives}
      shown={step.answer}
      sentence={step.answer}
      placeholder="Type the Portuguese"
      onDone={onDone}
    />
  );
}

/** A sentence with one word missing: type the missing form (its dictionary form is the hint). */
export function BlankStep({ step, onDone }: { step: Extract<Step, { kind: "blank" }>; onDone: Done }) {
  const sentence = step.before + step.answer + step.after;
  return (
    <TypedAnswer
      label="Fill in the blank"
      prompt={
        <div>
          <p className="font-pt text-3xl leading-snug">
            {step.before}
            <span className="mx-1 inline-block min-w-16 border-b-2 border-stone-400 text-center">&nbsp;</span>
            {step.after}
          </p>
          <p className="mt-2 text-stone-500">{step.en}</p>
          {step.hint.toLowerCase() !== step.answer.toLowerCase() && (
            <p className="mt-1 text-sm text-stone-500">
              Use a form of <span className="font-pt text-base text-stone-800 dark:text-stone-100">{step.hint}</span>
            </p>
          )}
        </div>
      }
      expected={step.answer}
      shown={sentence}
      sentence={sentence}
      placeholder="Type the missing word"
      onDone={onDone}
    />
  );
}

/** An English sentence → type it in Portuguese. */
export function TranslateStep({ step, onDone }: { step: Extract<Step, { kind: "translate" }>; onDone: Done }) {
  return (
    <TypedAnswer
      label="Translate into Portuguese"
      prompt={<p className="text-2xl">{step.en}</p>}
      expected={step.answer}
      shown={step.answer}
      sentence={step.answer}
      placeholder="Type the sentence in Portuguese"
      onDone={onDone}
    />
  );
}
