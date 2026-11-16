import { useState } from "react";
import { SpeakButton } from "../cards/SpeakButton";
import { MicButton } from "../MicButton";
import { useDictation } from "../useDictation";
import { useProgress } from "../useSettings";
import { seededRandom } from "@/lib/daily";
import { checkSpoken, readAloudQueue, type SpokenCheck } from "@/lib/pronunciation";
import { LEVEL_NAMES, WORDS, type Level } from "@/lib/words";

const ROUND = 10;

/**
 * Read example sentences aloud; the speech recognizer shows which words it understood. No AI and
 * nothing is graded, so it's free and doesn't touch the flashcards.
 */
export function PronunciationPractice({ level, onBack }: { level: Level; onBack: () => void }) {
  const progress = useProgress();
  const [round, setRound] = useState(0);
  const [queue, setQueue] = useState(() => readAloudQueue(WORDS, progress, level, seededRandom(`${Date.now()}`), ROUND));
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<SpokenCheck | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const item = queue[index];
  const dictation = useDictation((text, alternatives) => item && setResult(checkSpoken(item.pt, text, alternatives)));

  function next() {
    // A skipped sentence isn't scored.
    if (result) setScores((s) => [...s, result.score]);
    setResult(null);
    setIndex((i) => i + 1);
  }
  function again() {
    setQueue(readAloudQueue(WORDS, progress, level, seededRandom(`${Date.now()}:${round + 1}`), ROUND));
    setRound((r) => r + 1);
    setIndex(0);
    setScores([]);
    setResult(null);
  }

  const header = (
    <header className="flex items-center justify-between gap-2">
      <div>
        <h1 className="font-semibold">Pronunciation</h1>
        <p className="text-xs text-stone-500">
          {LEVEL_NAMES[level]}
          {item && ` · ${index + 1} of ${queue.length}`}
        </p>
      </div>
      <button type="button" onClick={onBack} className="rounded-full border border-stone-300 px-3 py-1.5 text-sm dark:border-stone-700">
        Done
      </button>
    </header>
  );

  if (!dictation.supported) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <p className="rounded-2xl bg-stone-100 p-4 text-sm dark:bg-stone-900">
          This browser can&apos;t turn speech into text. Pronunciation practice works in Chrome, Edge and Safari.
        </p>
      </div>
    );
  }

  if (!item) {
    const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div className="rounded-[20px] border border-stone-200 bg-white p-6 text-center dark:border-stone-800 dark:bg-stone-900">
          <p className="font-pt text-4xl">{Math.round(average * 100)}%</p>
          <p className="mt-1 text-sm text-stone-500">
            of words understood, across {scores.length} {scores.length === 1 ? "sentence" : "sentences"}
          </p>
        </div>
        <button type="button" onClick={again} className="rounded-full bg-red-700 py-3 font-medium text-white hover:bg-red-800 dark:bg-red-500 dark:hover:bg-red-400">
          Practice again
        </button>
      </div>
    );
  }

  const heardCount = result?.words.filter((w) => w.heard).length ?? 0;
  return (
    <div className="flex flex-col gap-5">
      {header}
      <div className="h-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
        <div className="h-full bg-red-700 transition-all dark:bg-red-500" style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>

      <div className="rounded-[20px] border border-stone-200 bg-white p-5 shadow-[0_30px_60px_-44px_rgba(27,25,22,0.5)] dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-start justify-between gap-2">
          <p className="font-pt text-3xl leading-snug">
            {result
              ? result.words.map((w, i) => (
                  <span key={i}>
                    {i > 0 && " "}
                    <span
                      className={
                        w.heard
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-rose-700 underline decoration-rose-400 decoration-wavy underline-offset-4 dark:text-rose-400"
                      }
                    >
                      {w.text}
                    </span>
                  </span>
                ))
              : item.pt}
          </p>
          <SpeakButton text={item.pt} label="Hear the sentence" />
        </div>
        <p className="mt-2 text-stone-500">{item.en}</p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <MicButton
          size="h-16 w-16"
          listening={dictation.listening}
          onStart={() => {
            setResult(null);
            dictation.start();
          }}
          onStop={dictation.stop}
        />
        <p className="text-sm text-stone-500">
          {dictation.listening ? "Listening… tap to stop" : result ? "Tap to try again" : "Tap and read the sentence aloud"}
        </p>
        {(dictation.listening || result) && dictation.text && (
          <p className="text-center text-sm text-stone-600 dark:text-stone-300">
            Heard: <span className="font-pt text-base">{result?.transcript ?? dictation.text}</span>
          </p>
        )}
        {dictation.error && !dictation.listening && (
          <p role="alert" className="text-center text-sm text-red-700 dark:text-red-400">
            {dictation.error}
          </p>
        )}
      </div>

      {result && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            result.score === 1
              ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "bg-stone-100 text-stone-700 dark:bg-stone-900 dark:text-stone-200"
          }`}
        >
          {result.score === 1
            ? "Perfeito! Every word was understood."
            : `${heardCount} of ${result.words.length} words understood. Listen to the sentence, then try the red words again.`}
        </div>
      )}
      <button
        type="button"
        disabled={dictation.listening}
        onClick={next}
        className={`rounded-full py-3 font-medium disabled:opacity-40 ${
          result ? "bg-red-700 text-white hover:bg-red-800 dark:bg-red-500 dark:hover:bg-red-400" : "border border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-300"
        }`}
      >
        {result ? "Next" : "Skip"}
      </button>
    </div>
  );
}
