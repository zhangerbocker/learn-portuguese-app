import { describe, expect, it } from "vitest";
import { itemKey } from "./deck";
import { seededRandom } from "./daily";
import { checkSpoken, readAloudQueue } from "./pronunciation";
import { newItem } from "./srs";
import { WORDS } from "./words";

const heardWords = (c: ReturnType<typeof checkSpoken>) => c.words.filter((w) => w.heard).map((w) => w.text);

describe("checkSpoken", () => {
  it("accepts a transcript that matches apart from case, accents and punctuation", () => {
    const c = checkSpoken("Você já foi ao Rio?", "voce ja foi ao rio");
    expect(c.score).toBe(1);
    expect(c.words.every((w) => w.heard)).toBe(true);
  });

  it("marks the words that weren't heard", () => {
    const c = checkSpoken("Eu gosto muito de café.", "eu gosto de café");
    expect(heardWords(c)).toEqual(["Eu", "gosto", "de", "café."]);
    expect(c.score).toBe(0.8);
  });

  it("ignores extra words and keeps the order", () => {
    const c = checkSpoken("Ela mora no Brasil.", "ah ela mora sim no brasil");
    expect(c.score).toBe(1);
    expect(checkSpoken("Ela mora no Brasil.", "brasil no mora ela").score).toBe(0.25);
  });

  it("reads digits as number words, including the feminine forms", () => {
    expect(checkSpoken("São três horas.", "são 3 horas").score).toBe(1);
    expect(checkSpoken("Tenho duas irmãs.", "tenho 2 irmãs").score).toBe(1);
  });

  it("needs every part of a hyphenated word", () => {
    expect(checkSpoken("Ela chama-se Ana.", "ela chama se ana").score).toBe(1);
    expect(heardWords(checkSpoken("Ela chama-se Ana.", "ela chama ana"))).toEqual(["Ela", "Ana."]);
  });

  it("uses the recognizer's best-matching alternative", () => {
    const c = checkSpoken("Eu sou de Boston.", "eu sol de boston", ["eu sou de boston"]);
    expect(c.score).toBe(1);
    expect(c.transcript).toBe("eu sou de boston");
  });

  it("scores nothing heard as zero", () => {
    expect(checkSpoken("Bom dia!", "").score).toBe(0);
  });
});

describe("readAloudQueue", () => {
  it("gives example sentences at the chosen level, words being studied first", () => {
    const studied = WORDS.filter((w) => w.level === 1 && w.example.pt.split(/\s+/).length >= 3).slice(40, 43);
    const now = new Date("2026-11-16T12:00:00");
    const progress = { items: Object.fromEntries(studied.map((w) => [itemKey("word", w.id), newItem(now, "2026-11-16")])) };
    const queue = readAloudQueue(WORDS, progress, 1, seededRandom("x"), 10);
    expect(queue).toHaveLength(10);
    expect(new Set(queue.slice(0, 3).map((q) => q.wordId))).toEqual(new Set(studied.map((w) => w.id)));
    for (const q of queue) {
      const word = WORDS.find((w) => w.id === q.wordId)!;
      expect(word.level).toBe(1);
      expect(q.pt).toBe(word.example.pt);
    }
  });
});
