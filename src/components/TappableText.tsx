"use client";

import { useState } from "react";
import { buildLexicon, segment } from "@/lib/segment";
import { WORDS } from "@/lib/words";
import { WordPanel, type WordTap } from "./WordPanel";

// Every word at every level, so any Portuguese shown can be looked up.
const LEXICON = buildLexicon(WORDS);

/** Portuguese text whose words can be tapped to open the word panel (meaning, note, ask the tutor). */
export function TappableText({ text, sentence = text, className = "" }: { text: string; sentence?: string; className?: string }) {
  const [tap, setTap] = useState<WordTap | null>(null);
  return (
    <span className={className}>
      {segment(text, LEXICON).map((t, i) =>
        t.kind === "word" || t.kind === "unknown" || t.kind === "extra" ? (
          <span
            key={i}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setTap({ text: t.text, wordId: t.wordId, sentence });
            }}
            onKeyDown={(e) => e.key === "Enter" && setTap({ text: t.text, wordId: t.wordId, sentence })}
            className="cursor-pointer rounded underline decoration-stone-400/60 decoration-dotted underline-offset-4 hover:bg-stone-200/70 dark:hover:bg-stone-800"
          >
            {t.text}
          </span>
        ) : (
          <span key={i}>{t.text}</span>
        ),
      )}
      {tap && <WordPanel tap={tap} onClose={() => setTap(null)} />}
    </span>
  );
}
