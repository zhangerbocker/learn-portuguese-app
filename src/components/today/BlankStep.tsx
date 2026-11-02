import { useCallback, useState } from "react";
import type { Step } from "@/lib/daily";
import { Choices } from "./Choices";
import { Feedback, useNumberKeys } from "./Feedback";

type BlankStepData = Extract<Step, { kind: "blank" }>;

/** A sentence with one word missing: pick the word that fits. */
export function BlankStep({ step, onDone }: { step: BlankStepData; onDone: (right: number, asked: number) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const pick = useCallback((i: number) => setPicked((p) => p ?? i), []);
  useNumberKeys(step.options.length, picked === null, pick);
  const right = picked === step.answer;
  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-red-700 dark:text-red-400">Fill in the blank</p>
      <div>
        <p className="font-pt text-3xl leading-snug">
          {step.before}
          <span
            className={`mx-1 inline-block min-w-16 border-b-2 text-center ${
              picked === null ? "border-stone-400" : right ? "border-emerald-500 text-emerald-800 dark:text-emerald-200" : "border-rose-400 text-rose-800 dark:text-rose-200"
            }`}
          >
            {picked === null ? " " : step.options[step.answer]}
          </span>
          {step.after}
        </p>
        <p className="mt-2 text-stone-500">{step.en}</p>
      </div>
      <Choices options={step.options} answer={step.answer} picked={picked} onPick={pick} pt />
      {picked !== null && (
        <Feedback right={right} onContinue={() => onDone(right ? 1 : 0, 1)}>
          {!right && (
            <>
              Answer: <b className="font-pt text-base">{step.options[step.answer]}</b>
            </>
          )}
        </Feedback>
      )}
    </div>
  );
}
