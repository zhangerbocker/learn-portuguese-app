import { describe, expect, it } from "vitest";
import rawNotes from "../../data/word-notes.json";
import { lookupForm } from "./segment";
import { noteFor } from "./word-notes";
import { WORDS } from "./words";

describe("word notes", () => {
  it("only explain words in the word list", () => {
    const listed = new Set(WORDS.map((w) => lookupForm(w.pt)));
    const keys = Object.keys(rawNotes).filter((k) => !k.startsWith("_"));
    expect(keys.filter((k) => !listed.has(lookupForm(k)))).toEqual([]);
  });

  it("are found by the word's dictionary form", () => {
    expect(noteFor({ pt: "lhe" })).toMatch(/to you/);
    expect(noteFor({ pt: "casa" })).toBeUndefined();
  });
});
