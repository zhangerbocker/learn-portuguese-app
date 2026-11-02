/** Four answer pills; after answering, the right one turns green and a wrong pick turns red. */
export function Choices({
  options,
  answer,
  picked,
  onPick,
  pt,
}: {
  options: readonly string[];
  answer: number;
  picked: number | null;
  onPick: (index: number) => void;
  /** Options are Portuguese (shown in the Portuguese serif). */
  pt?: boolean;
}) {
  return (
    <div className="grid gap-2">
      {options.map((option, i) => {
        const state = picked === null ? "idle" : i === answer ? "right" : i === picked ? "wrong" : "idle";
        return (
          <button
            key={i}
            type="button"
            disabled={picked !== null}
            onClick={() => onPick(i)}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${pt ? "font-pt text-xl" : "text-base"} ${
              state === "right"
                ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100"
                : state === "wrong"
                  ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100"
                  : "border-stone-200 bg-white hover:border-stone-400 disabled:opacity-60 dark:border-stone-800 dark:bg-stone-900"
            }`}
          >
            <span className="font-mono text-xs text-stone-400">{i + 1}</span>
            {option}
          </button>
        );
      })}
    </div>
  );
}
