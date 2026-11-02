import { useState } from "react";
import { lookupForm } from "@/lib/segment";
import type { Step } from "@/lib/daily";
import { SpeakButton } from "../cards/SpeakButton";
import { Feedback } from "./Feedback";

type BuildStepData = Extract<Step, { kind: "build" }>;

const tileClass = "font-pt rounded-xl border px-3 py-1.5 text-xl";

/** Tap word tiles into order to translate an English sentence (no typing, so accents never matter). */
export function BuildStep({ step, onDone }: { step: BuildStepData; onDone: (right: number, asked: number) => void }) {
  // Indexes into step.tiles, in the order tapped.
  const [chosen, setChosen] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const built = chosen.map((i) => step.tiles[i]);
  const right = built.length === step.answer.length && built.every((w, i) => lookupForm(w) === lookupForm(step.answer[i]));
  const sentence = step.answer.join(" ");

  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-red-700 dark:text-red-400">Build the sentence</p>
      <p className="text-2xl">{step.en}</p>
      <div className="flex min-h-14 flex-wrap content-start gap-2 border-b-2 border-stone-300 pb-3 dark:border-stone-700">
        {chosen.map((tile, i) => (
          <button
            key={`${tile}-${i}`}
            type="button"
            disabled={checked}
            onClick={() => setChosen((c) => c.filter((_, j) => j !== i))}
            className={`${tileClass} border-stone-300 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900`}
          >
            {step.tiles[tile]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {step.tiles.map((word, i) => (
          <button
            key={i}
            type="button"
            disabled={checked || chosen.includes(i)}
            onClick={() => setChosen((c) => [...c, i])}
            className={`${tileClass} border-stone-200 bg-stone-100 disabled:opacity-25 dark:border-stone-800 dark:bg-stone-800`}
          >
            {word}
          </button>
        ))}
      </div>
      {!checked ? (
        <button
          type="button"
          disabled={chosen.length === 0}
          onClick={() => setChecked(true)}
          className="rounded-full bg-red-700 py-3 font-medium text-white hover:bg-red-800 disabled:opacity-40 dark:bg-red-500 dark:hover:bg-red-400"
        >
          Check
        </button>
      ) : (
        <Feedback right={right} onContinue={() => onDone(right ? 1 : 0, 1)}>
          <span className="flex items-center gap-1">
            <b className="font-pt text-lg">{sentence}</b>
            <SpeakButton text={sentence} label="Play sentence" />
          </span>
        </Feedback>
      )}
    </div>
  );
}
