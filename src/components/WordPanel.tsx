"use client";

import { useState, type ReactNode } from "react";
import { BottomSheet } from "./read/BottomSheet";
import { SpeakButton } from "./cards/SpeakButton";
import { askTutor } from "./explain-api";
import { useMe } from "./useMe";
import { dollars } from "@/lib/me";
import { PERSONS, VERBS } from "@/lib/verbs";
import { noteFor } from "@/lib/word-notes";
import { LEVEL_NAMES, withArticle, WORDS_BY_ID, type Level } from "@/lib/words";

/** Inline emphasis in a tutor answer: **bold** and *italic* (the model sometimes uses them). */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <b key={i}>{part.slice(2, -2)}</b>
        ) : part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <i key={i} className="font-pt text-[1.05em]">
            {part.slice(1, -1)}
          </i>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** A tutor answer: paragraphs and "- " bullet lists, with inline emphasis. */
function TutorAnswer({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        return lines.every((l) => /^\s*[-•]\s/.test(l)) ? (
          <ul key={i} className="list-disc pl-5">
            {lines.map((l, j) => (
              <li key={j}>
                <Inline text={l.replace(/^\s*[-•]\s/, "")} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Inline text={l.replace(/^\s*[-•]\s/, "• ")} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export interface WordTap {
  /** The word as it appears (fui). */
  text: string;
  /** Its entry in the word list, when it has one. */
  wordId?: number;
  /** Its meaning in this sentence, when known (story glosses). */
  en?: string;
  /** The sentence it appeared in, for the tutor. */
  sentence?: string;
}

/**
 * What a tapped word means: the dictionary entry, its other forms, a usage note for tricky
 * words, and "Ask the tutor" for an AI explanation with follow-up questions.
 */
export function WordPanel({ tap, onClose, children }: { tap: WordTap; onClose: () => void; children?: ReactNode }) {
  const word = tap.wordId !== undefined ? WORDS_BY_ID.get(tap.wordId) : undefined;
  const verb = word ? VERBS.find((v) => v.wordId === word.id) : undefined;
  const note = word ? noteFor(word) : undefined;
  const me = useMe();
  const [chat, setChat] = useState<{ question: string; answer: string }[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(followUp?: string) {
    setAsking(true);
    setError(null);
    try {
      const answer = await askTutor({
        word: tap.text,
        lemma: word?.pt,
        english: word?.english,
        sentence: tap.sentence,
        level: (word?.level ?? 1) as Level,
        history: chat,
        ...(followUp ? { question: followUp } : {}),
      });
      setChat((c) => [...c, { question: followUp ?? "", answer }]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAsking(false);
    }
  }

  const guestLeft = me?.role === "guest" && me.budget ? Math.min(me.budget.remainingUsd, me.budget.poolRemainingUsd) : null;

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto">
        <div className="flex items-baseline gap-2">
          <span className="font-pt text-4xl">{tap.text}</span>
          <SpeakButton text={tap.text} label="Play word" />
        </div>
        {tap.en && <p className="-mt-2 text-lg">{tap.en}</p>}
        {word ? (
          <p className="text-sm text-stone-600 dark:text-stone-300">
            <span className="font-pt text-base">{withArticle(word)}</span> · {word.english} ·{" "}
            <span className="text-stone-500">
              {word.pos} · {LEVEL_NAMES[word.level]} · {word.topic}
            </span>
          </p>
        ) : (
          <p className="text-sm text-stone-500">A name or a word outside the word list.</p>
        )}

        {verb ? (
          <table className="font-pt w-full text-left text-sm">
            <thead>
              <tr className="font-sans text-[11px] uppercase tracking-wide text-stone-400">
                <th className="font-medium" />
                <th className="font-medium">Present</th>
                <th className="font-medium">Past</th>
              </tr>
            </thead>
            <tbody>
              {PERSONS.map((person, i) => (
                <tr key={person}>
                  <td className="pr-2 font-sans text-xs text-stone-500">{person}</td>
                  <td>{verb.tenses.presente[i]}</td>
                  <td>{verb.tenses.preterito[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          word &&
          word.forms.length > 0 && (
            <p className="text-sm text-stone-500">
              Other forms: <span className="font-pt text-base text-stone-700 dark:text-stone-200">{word.forms.slice(0, 8).join(", ")}</span>
            </p>
          )
        )}

        {note && (
          <div className="rounded-2xl bg-amber-50 p-3 text-sm text-stone-800 dark:bg-amber-900/30 dark:text-stone-100">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-amber-800 dark:text-amber-300">How it&apos;s used</p>
            {note}
          </div>
        )}
        {word && (
          <p className="text-sm text-stone-500">
            <span className="font-pt text-base text-stone-700 dark:text-stone-200">{word.example.pt}</span> · {word.example.en}
          </p>
        )}

        {children}

        <section className="flex flex-col gap-2 border-t border-stone-200 pt-3 dark:border-stone-800">
          {chat.map((turn, i) => (
            <div key={i} className="flex flex-col gap-1">
              {turn.question && <p className="self-end rounded-2xl bg-stone-100 px-3 py-1.5 text-sm dark:bg-stone-800">{turn.question}</p>}
              <TutorAnswer text={turn.answer} />
            </div>
          ))}
          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
          {chat.length === 0 ? (
            <button
              type="button"
              disabled={asking}
              onClick={() => void ask()}
              className="rounded-full border border-stone-300 py-2.5 text-sm font-medium hover:border-stone-700 disabled:opacity-50 dark:border-stone-700"
            >
              {asking ? "Asking the tutor…" : `Ask the tutor about “${tap.text}”`}
            </button>
          ) : (
            chat.length < 5 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (question.trim()) void ask(question.trim());
                }}
                className="flex gap-2"
              >
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={300}
                  placeholder="Ask a follow-up…"
                  aria-label="Follow-up question"
                  className="flex-1 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
                />
                <button
                  type="submit"
                  disabled={asking || !question.trim()}
                  className="rounded-full bg-red-700 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-red-500"
                >
                  {asking ? "…" : "Ask"}
                </button>
              </form>
            )
          )}
          {guestLeft !== null && <p className="text-xs text-stone-500">Uses your guest chat budget ({dollars(guestLeft)} left).</p>}
        </section>
      </div>
    </BottomSheet>
  );
}
