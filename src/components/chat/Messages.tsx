import { useState } from "react";
import { SpeakButton } from "../cards/SpeakButton";
import { Correction } from "../Correction";
import { countedChanges, type MessageCheck } from "@/lib/chat";
import type { Word } from "@/lib/words";

export function PartnerMessage({ text, en }: { text: string; en: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex max-w-[85%] items-start gap-2 self-start">
      <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 shadow-sm dark:bg-stone-900">
        <p className="font-pt text-lg leading-relaxed">{text}</p>
        {open && <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{en}</p>}
      </div>
      <div className="flex flex-col items-center">
        <button
          type="button"
          aria-label={open ? "Hide English" : "Show English"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`mt-1.5 h-7 w-7 shrink-0 rounded-full text-sm ${open ? "bg-red-700 text-white dark:bg-red-500" : "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300"}`}
        >
          ?
        </button>
        <SpeakButton text={text} label="Read aloud" />
      </div>
    </div>
  );
}

export interface GapWord {
  word: Word | undefined;
  /** "new" can be added to flashcards; "studying" is already there. */
  status: "new" | "studying";
}

/** The learner's message and, under it, how it was checked. */
export function UserMessage({
  text,
  check,
  accentsOptional,
  gapWord,
  onAddWord,
}: {
  text: string;
  check?: MessageCheck;
  accentsOptional: boolean;
  gapWord: (pt: string) => GapWord;
  onAddWord: (wordId: number) => void;
}) {
  return (
    <div className="flex max-w-[85%] flex-col items-end gap-1.5 self-end">
      <p className="font-pt rounded-2xl rounded-tr-sm bg-red-700 px-4 py-2.5 text-lg leading-relaxed text-white dark:bg-red-600">{text}</p>
      {check && <CheckCard text={text} check={check} accentsOptional={accentsOptional} gapWord={gapWord} onAddWord={onAddWord} />}
    </div>
  );
}

function CheckCard({
  text,
  check,
  accentsOptional,
  gapWord,
  onAddWord,
}: {
  text: string;
  check: MessageCheck;
  accentsOptional: boolean;
  gapWord: (pt: string) => GapWord;
  onAddWord: (wordId: number) => void;
}) {
  if (check.changes.length === 0 && check.gaps.length === 0) {
    return <p className="text-xs text-emerald-700 dark:text-emerald-400">✓ Looks good</p>;
  }
  const counted = countedChanges(check, accentsOptional);
  const accentOnly = check.changes.length > 0 && counted.length === 0;
  return (
    <div className="w-full rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm dark:border-stone-800 dark:bg-stone-900/60">
      {accentOnly ? (
        <>
          <Correction wrong={text} right={check.corrected} className="text-lg" />
          <p className="mt-1 text-emerald-700 dark:text-emerald-400">✓ Looks good: only accents were missing (underlined)</p>
        </>
      ) : check.changes.length > 0 ? (
        <>
          <Correction wrong={text} right={check.corrected} className="text-lg" />
          <p className="mt-1 text-stone-600 dark:text-stone-300">{check.correctedEn}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {counted.map((c, i) => (
              <li key={i}>
                <span className="font-pt">
                  <del className="text-red-600 dark:text-red-400">{c.from}</del> → <span className="text-emerald-700 dark:text-emerald-400">{c.to}</span>
                </span>{" "}
                <span className="text-stone-600 dark:text-stone-300">{c.reason}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-stone-500">
            Added to your flashcards
            {counted.length < check.changes.length && " · underlined words only needed an accent (not counted)"}
          </p>
        </>
      ) : (
        <p className="text-emerald-700 dark:text-emerald-400">✓ Grammar looks good</p>
      )}
      {check.gaps.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5 border-t border-stone-200 pt-2 dark:border-stone-800">
          {check.gaps.map((g, i) => {
            const { word, status } = gapWord(g.pt);
            return (
              <li key={i} className="flex items-center justify-between gap-2">
                <span>
                  <span className="text-stone-500">{g.typed} = </span>
                  <span className="font-pt text-base">{g.pt}</span>{" "}
                  <span className="text-stone-600 dark:text-stone-300">{g.en}</span>
                </span>
                {word &&
                  (status === "new" ? (
                    <button
                      type="button"
                      onClick={() => onAddWord(word.id)}
                      className="shrink-0 rounded-full bg-red-700 px-3 py-1 text-xs text-white dark:bg-red-500"
                    >
                      Add to flashcards
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs text-stone-500">In your flashcards</span>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
