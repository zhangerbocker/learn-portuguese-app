import { useEffect, type ReactNode } from "react";

/** Right/wrong strip shown after an answer, with the correct answer and a Continue button (Enter). */
export function Feedback({ right, children, onContinue }: { right: boolean; children?: ReactNode; onContinue: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onContinue]);

  return (
    <div
      role="status"
      className={`flex flex-col gap-3 rounded-[20px] border p-4 ${
        right
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
      }`}
    >
      <p className="font-pt text-2xl">{right ? "Muito bem!" : "Quase…"}</p>
      {children && <div className="text-sm">{children}</div>}
      <button
        type="button"
        autoFocus
        onClick={onContinue}
        className="rounded-full bg-red-700 py-3 font-medium text-white hover:bg-red-800 dark:bg-red-500 dark:hover:bg-red-400"
      >
        Continue
      </button>
    </div>
  );
}

/** Lets 1–4 pick an option while the step is waiting for an answer. */
export function useNumberKeys(count: number, enabled: boolean, onPick: (index: number) => void) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= count) onPick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, enabled, onPick]);
}
