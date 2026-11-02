import { useCallback, useState } from "react";
import type { Step } from "@/lib/daily";
import { SpeakButton } from "../cards/SpeakButton";
import { Choices } from "./Choices";
import { Feedback, useNumberKeys } from "./Feedback";

type MeaningStepData = Extract<Step, { kind: "meaning" }>;

/** "What does this mean?": a Portuguese word with English choices, or the reverse. */
export function MeaningStep({ step, onDone }: { step: MeaningStepData; onDone: (right: number, asked: number) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const pick = useCallback((i: number) => setPicked((p) => p ?? i), []);
  useNumberKeys(step.options.length, picked === null, pick);
  const right = picked === step.answer;
  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-red-700 dark:text-red-400">
        {step.direction === "pt" ? "What does this mean?" : "How do you say this in Portuguese?"}
      </p>
      <div className="flex items-center gap-2">
        <p className={step.direction === "pt" ? "font-pt text-4xl" : "text-2xl"}>{step.prompt}</p>
        {step.direction === "pt" && <SpeakButton text={step.prompt} label="Play word" />}
      </div>
      <Choices options={step.options} answer={step.answer} picked={picked} onPick={pick} pt={step.direction === "en"} />
      {picked !== null && (
        <Feedback right={right} onContinue={() => onDone(right ? 1 : 0, 1)}>
          {!right && (
            <>
              Answer: <b className={step.direction === "en" ? "font-pt text-base" : ""}>{step.options[step.answer]}</b>
            </>
          )}
        </Feedback>
      )}
    </div>
  );
}
