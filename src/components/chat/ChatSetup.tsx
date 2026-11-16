import { useState } from "react";
import { SCENARIOS } from "@/lib/chat";
import { LEVEL_NAMES, type Level } from "@/lib/words";
import { useActiveLevels } from "../useSettings";
import { BudgetNote } from "./BudgetNote";
import type { Me } from "@/lib/me";

export function ChatSetup({
  starting,
  me,
  onStart,
  onPronounce,
}: {
  starting: boolean;
  me: Me | null;
  onStart: (level: Level, scenario: string) => void;
  onPronounce: (level: Level) => void;
}) {
  const outOfBudget = me?.role === "guest" && me.budget !== null && !me.budget.allowed;
  const levels = useActiveLevels();
  const [chosen, setLevel] = useState<Level>(1);
  // Falls back to A1 when the chosen level is switched off.
  const level = levels.includes(chosen) ? chosen : 1;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-pt text-3xl leading-tight">Chat</h1>
        <div className="flex rounded-full bg-stone-200 p-1 text-sm dark:bg-stone-800">
          {levels.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={`rounded-full px-4 py-1.5 ${level === l ? "bg-white shadow-sm dark:bg-stone-950" : "text-stone-600 dark:text-stone-400"}`}
            >
              {LEVEL_NAMES[l]}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-stone-500">
        Pick a situation. Write or speak in Portuguese (English for words you don&apos;t know is fine) and every message gets checked.
      </p>
      <BudgetNote me={me} />
      <ul className="flex flex-col gap-2">
        {SCENARIOS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={starting || outOfBudget}
              onClick={() => onStart(level, s.id)}
              className="w-full rounded-[20px] border border-stone-200 bg-white p-4 text-left shadow-[0_30px_60px_-44px_rgba(27,25,22,0.5)] transition hover:-translate-y-0.5 hover:border-red-700 disabled:opacity-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-red-400"
            >
              <span className="block font-medium">{s.title}</span>
              <span className="block text-sm text-stone-500">{s.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onPronounce(level)}
        className="w-full rounded-[20px] border border-dashed border-stone-300 p-4 text-left transition hover:border-red-700 dark:border-stone-700 dark:hover:border-red-400"
      >
        <span className="block font-medium">Pronunciation practice</span>
        <span className="block text-sm text-stone-500">Read sentences aloud and see which words were understood. Free, no AI.</span>
      </button>
    </div>
  );
}
