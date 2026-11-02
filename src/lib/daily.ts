// Daily practice: a short lesson built each day from the word list, example sentences and
// stories. Pure functions (no storage, no clock), so lessons are reproducible and testable.
import { stripAccents } from "./answer";
import { itemKey, itemOfCard, orderedWords } from "./deck";
import type { Level } from "./levels";
import type { ReviewEntry } from "./progress-store";
import { buildLexicon, lookupForm, segment, wordCount } from "./segment";
import { itemPriority, shuffled } from "./session";
import { Rating, type Progress } from "./srs";
import type { Story } from "./story";
import { TOPICS, type Topic } from "./topics";
import { withArticle, type Word } from "./words";

/** Topics a day can be about ("Function words" is a grab bag, not a theme). */
export const THEMES: readonly Topic[] = TOPICS.filter((t) => t !== "Function words");

/** Lesson shape: ~3 review steps, ~6 theme steps and one short read with 2 questions (~12 answers). */
const REVIEW_STEPS = 3;
const THEME_STEPS = 6;
/** Items missed this often within TROUBLE_DAYS are "trouble": they lead the next lessons. */
const TROUBLE_MISSES = 2;
const TROUBLE_DAYS = 30;
/** Stories this short are shown whole with their own questions; longer ones are excerpted. */
const WHOLE_STORY_WORDS = 160;
const EXCERPT_WORDS = 120;
/** Translate-the-sentence uses example sentences of at most this many words. */
const TRANSLATE_MAX_WORDS = 10;
const DAY_MS = 86_400_000;

/** Where a step came from: the review block, today's theme, or the short read. */
export type StepSource = "review" | "theme" | "reading";

/**
 * One exercise. Word exercises are typed in Portuguese (checked like Cards: case and
 * punctuation ignored, accents optional per the learner's setting); the read keeps
 * multiple-choice questions.
 */
export type Step =
  | {
      kind: "meaning";
      source: StepSource;
      /** The word's study item (w:<id>), graded by the answer. */
      item: string;
      /** The English to put into Portuguese, and its part of speech as a hint. */
      prompt: string;
      hint: string;
      /** The word as learned (nouns with their article); the bare word is accepted too. */
      answer: string;
      alternatives: string[];
    }
  | {
      kind: "blank";
      source: StepSource;
      item: string;
      /** The example sentence around the blank, and its English. */
      before: string;
      after: string;
      en: string;
      /** The missing form, and the dictionary form shown as a hint (ir for "fui"). */
      answer: string;
      hint: string;
    }
  | {
      kind: "translate";
      source: StepSource;
      item: string;
      /** The English sentence to translate, and the Portuguese expected. */
      en: string;
      answer: string;
    }
  | {
      kind: "reading";
      source: "reading";
      storyId: string;
      /** How many of the story's sentences to show (all, or an excerpt). */
      sentenceCount: number;
      questions: { q: string; qEn: string; options: string[]; answer: number }[];
    };

export interface Lesson {
  date: string;
  topic: Topic;
  level: Level;
  steps: Step[];
}

export interface LessonInput {
  words: readonly Word[];
  stories: readonly Story[];
  progress: Progress;
  reviews: readonly ReviewEntry[];
  readIds: ReadonlySet<string>;
  /** Levels switched on (A1–A2, or A1–B2). */
  levels: readonly Level[];
  /** Local day, YYYY-MM-DD. */
  date: string;
  now: Date;
  /** Varies the lesson for "practice again" on the same day; 0 for the day's lesson. */
  round?: number;
}

// ---------------------------------------------------------------- randomness

/** A small deterministic generator (mulberry32), so a day's lesson is the same on every load. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whole days since 1970-01-01 for a YYYY-MM-DD date. */
function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

// ---------------------------------------------------------------- trouble and theme

/** Items answered "don't know" at least twice in the last 30 days, most-missed first. */
export function troubleItems(reviews: readonly ReviewEntry[], now: Date): string[] {
  const since = now.getTime() - TROUBLE_DAYS * DAY_MS;
  const misses = new Map<string, number>();
  for (const r of reviews) {
    if (r.rating !== Rating.DontKnow || Date.parse(r.at) < since) continue;
    let item: string;
    try {
      item = itemOfCard(r.key);
    } catch {
      continue; // not a card key (shouldn't happen)
    }
    misses.set(item, (misses.get(item) ?? 0) + 1);
  }
  return [...misses].filter(([, n]) => n >= TROUBLE_MISSES).sort((a, b) => b[1] - a[1]).map(([item]) => item);
}

/**
 * The day's theme: the themes take turns by date, but a theme with clearly more trouble
 * words (at least 3 more than the scheduled one) goes first.
 */
export function themeFor(date: string, words: readonly Word[], trouble: readonly string[]): Topic {
  const scheduled = THEMES[((dayNumber(date) % THEMES.length) + THEMES.length) % THEMES.length];
  const byId = new Map(words.map((w) => [w.id, w]));
  const counts = new Map<Topic, number>();
  for (const item of trouble) {
    const word = item.startsWith("w:") ? byId.get(Number(item.slice(2))) : undefined;
    if (word && THEMES.includes(word.topic)) counts.set(word.topic, (counts.get(word.topic) ?? 0) + 1);
  }
  const [weakest, most] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [scheduled, 0];
  return most - (counts.get(scheduled) ?? 0) >= 3 ? weakest : scheduled;
}

// ---------------------------------------------------------------- exercises

/**
 * The first `n` distinct values of `pool` (in its order, so callers rank it) that differ from
 * `exclude`, ignoring case and accents (no "nos" next to "nós").
 */
function pick(pool: readonly string[], exclude: readonly string[], n: number): string[] {
  const loose = (v: string) => stripAccents(lookupForm(v));
  const seen = new Set(exclude.map(loose));
  const out: string[] = [];
  for (const value of pool) {
    const key = loose(value);
    if (!value.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length === n) break;
  }
  return out;
}

/** Four shuffled options: the answer and three distractors; null if there aren't enough distractors. */
function choices(answer: string, distractors: string[], random: () => number): { options: string[]; answer: number } | null {
  if (distractors.length < 3) return null;
  const options = shuffled([answer, ...distractors.slice(0, 3)], random);
  return { options, answer: options.indexOf(answer) };
}

const posOf = (w: Word) => w.pos.split("/")[0].trim();
const sentenceWords = (text: string) =>
  text
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\d\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

interface ExerciseContext {
  words: readonly Word[];
  lexicon: ReturnType<typeof buildLexicon>;
  random: () => number;
}

const POS_NAMES: Record<string, string> = {
  "n.": "noun",
  "v.": "verb",
  "adj.": "adjective",
  "adv.": "adverb",
  "prep.": "preposition",
  "conj.": "conjunction",
  "pron.": "pronoun",
  "art.": "article",
  "num.": "number",
  "expr.": "expression",
  "interj.": "interjection",
};

function meaningStep(word: Word, source: StepSource): Step {
  const full = withArticle(word);
  const pos = POS_NAMES[posOf(word)] ?? posOf(word);
  const gender = word.gender === "m" ? ", masculine" : word.gender === "f" ? ", feminine" : "";
  return {
    kind: "meaning",
    source,
    item: itemKey("word", word.id),
    prompt: word.english,
    hint: pos + gender,
    answer: full,
    alternatives: full === word.pt ? [] : [word.pt],
  };
}

function blankStep(word: Word, source: StepSource, ctx: ExerciseContext): Step | null {
  const tokens = segment(word.example.pt, ctx.lexicon);
  const at = tokens.findIndex((t) => t.wordId === word.id);
  if (at < 0) return null;
  return {
    kind: "blank",
    source,
    item: itemKey("word", word.id),
    before: tokens.slice(0, at).map((t) => t.text).join(""),
    after: tokens.slice(at + 1).map((t) => t.text).join(""),
    en: word.example.en,
    answer: tokens[at].text,
    hint: word.pt,
  };
}

function translateStep(word: Word, source: StepSource): Step | null {
  const length = sentenceWords(word.example.pt).length;
  if (length < 3 || length > TRANSLATE_MAX_WORDS) return null;
  return { kind: "translate", source, item: itemKey("word", word.id), en: word.example.en, answer: word.example.pt };
}

/** An exercise for a word, trying the preferred kind first and falling back to the others. */
function exerciseFor(word: Word, source: StepSource, preferred: number, ctx: ExerciseContext): Step | null {
  const makers = [() => meaningStep(word, source), () => blankStep(word, source, ctx), () => translateStep(word, source)];
  for (let i = 0; i < makers.length; i++) {
    const step = makers[(preferred + i) % makers.length]();
    if (step) return step;
  }
  return null;
}

// ---------------------------------------------------------------- reading

function readingStep(stories: readonly Story[], topic: Topic, level: Level, levels: readonly Level[], readIds: ReadonlySet<string>, random: () => number): Step | null {
  const length = (s: Story, n = s.sentences.length) =>
    s.sentences.slice(0, n).reduce((sum, se) => sum + wordCount(se.tokens.map((t) => t.text).join("")), 0);
  const inTopic = stories.filter((s) => s.topic === topic && levels.includes(s.level));
  const candidates = [
    ...inTopic.filter((s) => s.level === level),
    ...inTopic.filter((s) => s.level !== level && s.level < level),
  ];
  if (candidates.length === 0) return null;
  // Unread first, then shortest; random among equals so a re-read day varies.
  const story = [...shuffled(candidates, random)].sort(
    (a, b) => Number(readIds.has(a.id)) - Number(readIds.has(b.id)) || (a.level === level ? 0 : 1) - (b.level === level ? 0 : 1) || length(a) - length(b),
  )[0];

  if (length(story) <= WHOLE_STORY_WORDS && story.questions.length >= 2) {
    return { kind: "reading", source: "reading", storyId: story.id, sentenceCount: story.sentences.length, questions: story.questions.slice(0, 2) };
  }
  // Excerpt: the first sentences up to ~120 words, quizzed with "which of these happens?".
  let n = 1;
  while (n < story.sentences.length && length(story, n + 1) <= EXCERPT_WORDS) n++;
  const excerpt = story.sentences.slice(0, n).map((s) => s.en);
  const elsewhere = stories
    .filter((s) => s.id !== story.id && s.topic === topic)
    .flatMap((s) => s.sentences.map((se) => se.en))
    .filter((en) => en.split(" ").length >= 4);
  const questions = shuffled(excerpt.filter((en) => en.split(" ").length >= 4), random)
    .slice(0, 2)
    .flatMap((right) => {
      const c = choices(right, pick(shuffled(elsewhere, random), excerpt, 3), random);
      return c ? [{ q: "O que acontece na história?", qEn: "Which of these happens in the story?", ...c }] : [];
    });
  return questions.length ? { kind: "reading", source: "reading", storyId: story.id, sentenceCount: n, questions } : null;
}

// ---------------------------------------------------------------- the lesson

/**
 * The day's lesson: up to 3 review steps (trouble words, then missed, then due), up to 6
 * steps on the day's theme, and a short read, with the theme steps split around the read.
 * Only words from the switched-on levels are used.
 */
export function planLesson(input: LessonInput): Lesson {
  const { progress, now, levels } = input;
  const random = seededRandom(`${input.date}#${input.round ?? 0}`);
  const words = input.words.filter((w) => levels.includes(w.level));
  const byId = new Map(words.map((w) => [w.id, w]));
  const trouble = troubleItems(input.reviews, now);
  const topic = themeFor(input.date, words, trouble);
  const ctx: ExerciseContext = { words, lexicon: buildLexicon(words), random };
  const wordItem = (w: Word) => itemKey("word", w.id);

  // Review: trouble words first (most missed), then missed, then due again.
  const troubleWords = trouble.flatMap((item) => (item.startsWith("w:") ? (byId.get(Number(item.slice(2))) ?? []) : []));
  const missedOrDue = orderedWords(words)
    .filter((w) => [0, 2].includes(itemPriority(progress, wordItem(w), now)))
    .sort((a, b) => itemPriority(progress, wordItem(a), now) - itemPriority(progress, wordItem(b), now));
  const reviewWords = [...new Set([...troubleWords, ...missedOrDue])].slice(0, REVIEW_STEPS);

  // Theme: the lowest level with words not yet known, words being learned before new ones.
  const notKnown = (w: Word) => itemPriority(progress, wordItem(w), now) !== 4 && progress.items[wordItem(w)]?.state !== "review";
  const themeWords = orderedWords(words).filter((w) => w.topic === topic && !reviewWords.includes(w));
  const level = ([...levels].sort((a, b) => a - b).find((l) => themeWords.some((w) => w.level === l && notKnown(w))) ?? Math.min(...levels)) as Level;
  const fresh = themeWords
    .filter((w) => w.level <= level)
    .sort((a, b) => Number(!notKnown(a)) - Number(!notKnown(b)) || itemPriority(progress, wordItem(a), now) - itemPriority(progress, wordItem(b), now) || b.level - a.level)
    .slice(0, (THEME_STEPS + REVIEW_STEPS) * 2); // spare words in case some can't make an exercise

  const kinds = shuffled([0, 1, 2, 0, 1, 2, 0, 1, 2], random);
  let k = 0;
  const steps = (list: Word[], source: StepSource, limit: number) =>
    list.flatMap((w) => exerciseFor(w, source, kinds[k++ % kinds.length], ctx) ?? []).slice(0, limit);

  const review = steps(reviewWords, "review", REVIEW_STEPS);
  // With little to review, the theme takes the spare places.
  const theme = steps(fresh, "theme", THEME_STEPS + REVIEW_STEPS - review.length);
  const reading = readingStep(input.stories, topic, level, levels, input.readIds, random);
  const half = Math.ceil(theme.length / 2);
  return {
    date: input.date,
    topic,
    level,
    steps: [...review, ...theme.slice(0, half), ...(reading ? [reading] : []), ...theme.slice(half)],
  };
}

/** Questions answered in a lesson (a read counts once per question). */
export function exerciseCount(lesson: Lesson): number {
  return lesson.steps.reduce((n, s) => n + (s.kind === "reading" ? s.questions.length : 1), 0);
}
