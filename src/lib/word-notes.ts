import rawNotes from "../../data/word-notes.json";
import { lookupForm } from "./segment";
import type { Word } from "./words";

const NOTES: ReadonlyMap<string, string> = new Map(
  Object.entries(rawNotes as Record<string, string>)
    .filter(([key]) => !key.startsWith("_"))
    .map(([key, note]) => [lookupForm(key), note]),
);

/** A hand-written usage note for tricky words (lhe, se, a gente…), if there is one. */
export function noteFor(word: Pick<Word, "pt">): string | undefined {
  return NOTES.get(lookupForm(word.pt));
}
