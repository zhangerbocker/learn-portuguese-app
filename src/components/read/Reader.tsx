"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { WordPanel } from "../WordPanel";
import { Questions } from "./Questions";
import { itemKey } from "@/lib/deck";
import { findStory, loadCustomStories, markRead, wordStatus } from "@/lib/reading";
import { localDay, saveProgress } from "@/lib/progress-store";
import { useProgress } from "../useSettings";
import { newItem, type Progress } from "@/lib/srs";
import type { StorySentence, StoryToken } from "@/lib/story";
import { speakPortuguese } from "@/lib/speech";
import { LEVEL_NAMES, WORDS_BY_ID } from "@/lib/words";

const LONG_PRESS_MS = 450;

type Sheet = { kind: "word"; token: StoryToken; sentence: StorySentence } | { kind: "sentence"; sentence: StorySentence } | null;

function sentenceText(s: StorySentence): string {
  return s.tokens.map((t) => t.text).join("");
}

export function Reader({ id }: { id: string }) {
  const [story] = useState(() => findStory(id, loadCustomStories(window.localStorage)));
  const progress = useProgress();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [read, setRead] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const closeSheet = useCallback(() => setSheet(null), []);

  if (!story) {
    return (
      <div className="m-auto text-center text-stone-500">
        <p>Story not found.</p>
        <Link href="/read" className="text-red-700 underline dark:text-red-400">
          Back to the library
        </Link>
      </div>
    );
  }

  function startPress(sentence: StorySentence) {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setSheet({ kind: "sentence", sentence });
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  function tapToken(token: StoryToken, sentence: StorySentence) {
    if (longPressed.current) return; // the long press already opened the sentence
    if (token.en || token.wordId !== undefined) setSheet({ kind: "word", token, sentence });
  }

  function addToFlashcards(wordId: number) {
    const now = new Date();
    const key = itemKey("word", wordId);
    if (progress.items[key]) return;
    const updated: Progress = { items: { ...progress.items, [key]: newItem(now, localDay(now)) } };
    saveProgress(window.localStorage, updated);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/read" className="text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
            ← Library
          </Link>
          <button
            type="button"
            onClick={() => speakPortuguese(story.sentences.map(sentenceText).join(" "))}
            className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 dark:border-stone-700 dark:text-stone-300"
          >
            ▶ Listen
          </button>
        </div>
        <div>
          <h1 className="font-pt text-2xl">{story.title}</h1>
          <p className="text-sm text-stone-500">
            {story.titleEn} · {LEVEL_NAMES[story.level]} · {story.topic}
          </p>
        </div>
      </header>

      <p className="text-xs text-stone-400">
        Tap a word for its meaning. Press and hold a sentence (or tap EN) to translate it. Dotted words aren&apos;t in your
        known words yet.
      </p>

      <article className="font-pt select-none text-2xl leading-[1.9] [-webkit-touch-callout:none]" onContextMenu={(e) => e.preventDefault()}>
        {story.sentences.map((sentence, si) => (
          <span
            key={si}
            onPointerDown={() => startPress(sentence)}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            className="rounded transition-colors active:bg-amber-100/60 dark:active:bg-amber-500/10"
          >
            {sentence.tokens.map((token, ti) => {
              const status = token.wordId !== undefined ? wordStatus(progress, token.wordId) : undefined;
              const tappable = Boolean(token.en || token.wordId !== undefined);
              const content = token.text;
              return tappable ? (
                <span
                  key={ti}
                  role="button"
                  tabIndex={0}
                  onClick={() => tapToken(token, sentence)}
                  onKeyDown={(e) => e.key === "Enter" && tapToken(token, sentence)}
                  className={`cursor-pointer rounded hover:bg-stone-200/70 dark:hover:bg-stone-800 ${
                    status && status !== "known" ? "underline decoration-amber-500/70 decoration-dotted underline-offset-[6px]" : ""
                  }`}
                >
                  {content}
                </span>
              ) : (
                <span key={ti}>{content}</span>
              );
            })}
            <button
              type="button"
              aria-label="Translate sentence"
              onClick={() => setSheet({ kind: "sentence", sentence })}
              className="mx-1 align-middle font-sans text-[0.5em] text-stone-400 hover:text-red-700"
            >
              EN
            </button>{" "}
          </span>
        ))}
      </article>

      <Questions story={story} />

      <button
        type="button"
        onClick={() => {
          markRead(window.localStorage, story.id);
          setRead(true);
        }}
        disabled={read}
        className="rounded-full py-3 font-medium bg-red-700 text-white hover:bg-red-800 dark:bg-red-500 dark:text-white dark:hover:bg-red-400 disabled:opacity-60"
      >
        {read ? "Marked as read" : "Mark as read"}
      </button>

      {sheet?.kind === "word" && (
        <WordPanel
          tap={{ text: sheet.token.text, wordId: sheet.token.wordId, en: sheet.token.en, sentence: sentenceText(sheet.sentence) }}
          onClose={closeSheet}
        >
          <FlashcardStatus token={sheet.token} progress={progress} onAdd={addToFlashcards} />
        </WordPanel>
      )}
      {sheet?.kind === "sentence" && (
        <BottomSheet onClose={closeSheet}>
          <div className="flex items-start justify-between gap-2">
            <p className="font-pt text-xl leading-relaxed">{sentenceText(sheet.sentence)}</p>
            <button
              type="button"
              aria-label="Play sentence"
              onClick={() => speakPortuguese(sentenceText(sheet.sentence))}
              className="shrink-0 rounded-full p-1 text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800"
            >
              ▶
            </button>
          </div>
          <p className="mt-3 text-lg">{sheet.sentence.en}</p>
        </BottomSheet>
      )}
    </div>
  );
}

/** Whether a story word is in the flashcards, with a button to add it. */
function FlashcardStatus({ token, progress, onAdd }: { token: StoryToken; progress: Progress; onAdd: (wordId: number) => void }) {
  const word = token.wordId !== undefined ? WORDS_BY_ID.get(token.wordId) : undefined;
  if (!word) return null;
  const status = wordStatus(progress, word.id);
  return status === "new" ? (
    <button
      type="button"
      onClick={() => onAdd(word.id)}
      className="self-start rounded-full bg-red-700 px-4 py-1.5 text-sm text-white dark:bg-red-500"
    >
      Add to flashcards
    </button>
  ) : (
    <span
      className={`self-start rounded-full px-3 py-1 text-xs ${
        status === "known"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      }`}
    >
      {status === "known" ? "Known" : "In your flashcards"}
    </span>
  );
}
