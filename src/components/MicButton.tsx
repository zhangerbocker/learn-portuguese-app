/** Tap to start speaking, tap again to stop. Red and pulsing while listening. */
export function MicButton({
  listening,
  disabled,
  onStart,
  onStop,
  size = "h-11 w-11",
}: {
  listening: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  size?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled && !listening}
      onClick={listening ? onStop : onStart}
      aria-label={listening ? "Stop listening" : "Speak in Portuguese"}
      aria-pressed={listening}
      className={`${size} flex shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${
        listening
          ? "animate-pulse bg-red-700 text-white dark:bg-red-500"
          : "border border-stone-300 text-stone-600 hover:border-red-700 hover:text-red-700 dark:border-stone-700 dark:text-stone-300 dark:hover:border-red-400 dark:hover:text-red-400"
      }`}
    >
      {listening ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      )}
    </button>
  );
}
