import { stripAccents } from "./answer";
import { shuffled } from "./session";
import { itemKey, orderedWords } from "./deck";
import type { Progress } from "./srs";
import type { Level, Word } from "./words";

/** One word of the sentence to read, and whether the recognizer heard it. */
export interface SpokenWord {
  /** As written in the sentence, with its punctuation. */
  text: string;
  heard: boolean;
}

export interface SpokenCheck {
  words: SpokenWord[];
  /** Share of the sentence's words that were heard, 0–1. */
  score: number;
  /** The transcript that matched best. */
  transcript: string;
}

// Recognizers often write numbers as digits ("3 horas"); read them back as words.
const NUMBERS = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove", "vinte",
];
const FEMININE: Record<string, string> = { um: "uma", dois: "duas" };

/** A word reduced to what speech can show: lowercase, no accents or punctuation. */
function loose(word: string): string {
  return stripAccents(word.normalize("NFC").toLowerCase()).replace(/[^\p{L}\p{N}]/gu, "");
}

function spokenTokens(transcript: string): string[] {
  return transcript
    .split(/[\s-]+/)
    .map(loose)
    .filter(Boolean);
}

function matches(target: string, heard: string): boolean {
  if (target === heard) return true;
  const n = Number(heard);
  if (Number.isInteger(n) && n >= 0 && n < NUMBERS.length) {
    const word = loose(NUMBERS[n]);
    return target === word || target === loose(FEMININE[NUMBERS[n]] ?? "");
  }
  return false;
}

/** Which of the sentence's words appear, in order, in what was heard (case, accents and punctuation ignored). */
function check(sentence: string, transcript: string): SpokenCheck {
  const shown = sentence.split(/\s+/).filter(Boolean);
  // A hyphenated word (chama-se) is heard as two, so each part must be heard.
  const parts = shown.map((w) => w.split("-").map(loose).filter(Boolean));
  const target = parts.flat();
  const heard = spokenTokens(transcript);
  const n = target.length;
  const m = heard.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = matches(target[i], heard[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const found = new Array<boolean>(n).fill(false);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (matches(target[i], heard[j])) {
      found[i] = true;
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }
  let k = 0;
  const words = shown.map((text, w) => {
    const ok = parts[w].length === 0 || parts[w].every(() => found[k++]);
    return { text, heard: ok };
  });
  const scored = words.filter((_, w) => parts[w].length > 0);
  return { words, score: scored.length ? scored.filter((w) => w.heard).length / scored.length : 0, transcript };
}

/** Compares a read-aloud sentence with the recognizer's transcript and its alternatives, keeping the best. */
export function checkSpoken(sentence: string, transcript: string, alternatives: readonly string[] = []): SpokenCheck {
  return [transcript, ...alternatives]
    .map((t) => check(sentence, t))
    .reduce((best, c) => (c.score > best.score ? c : best));
}

export interface ReadAloudItem {
  wordId: number;
  pt: string;
  en: string;
}

/**
 * Sentences to read aloud: example sentences (3+ words) at the chosen level, from words you're
 * studying first, then from the next new words in study order; shuffled within each group.
 */
export function readAloudQueue(words: readonly Word[], progress: Progress, level: Level, random: () => number, size = 10): ReadAloudItem[] {
  const atLevel = orderedWords(words.filter((w) => w.level === level && w.example.pt.split(/\s+/).length >= 3));
  const studying = atLevel.filter((w) => progress.items[itemKey("word", w.id)]);
  const rest = atLevel.filter((w) => !progress.items[itemKey("word", w.id)]).slice(0, size * 3);
  return [...shuffled(studying, random), ...shuffled(rest, random)]
    .slice(0, size)
    .map((w) => ({ wordId: w.id, pt: w.example.pt, en: w.example.en }));
}
