import { z } from "zod";
import { itemOfCard, matchingCards, type CardFilter, type Deck } from "./deck";
import type { KeyValueStorage } from "./progress-store";
import type { Progress } from "./srs";
import { LevelSchema } from "./levels";
import { TENSES } from "./verbs";
import { TOPICS } from "./topics";

/** Session sizes offered on the "New session" screen; "all" takes every matching card. */
export const SESSION_SIZES = [10, 20, 30, 40, 50, 60, 70, 80] as const;
export type SessionSize = (typeof SESSION_SIZES)[number] | "all";

/**
 * A study session: a shuffled deck of cards worked through one at a time. "I know it"
 * takes the top card out for the rest of the session; "I don't know it" shuffles it back in.
 */
export interface Session {
  filter: CardFilter;
  size: SessionSize;
  /** Cards still to go; the first is on screen. */
  queue: string[];
  /** Cards the session started with. */
  total: number;
  /** Cards answered "don't know" at least once this session, in the order first missed. */
  missed: string[];
}

/**
 * Priority of a study item for practice, lowest first:
 * 0 last answered "don't know"; 1 added by hand (from a story or chat) but not yet answered;
 * 2 known but due again; 3 never seen; 4 known and not yet due.
 */
export function itemPriority(progress: Progress, itemKey: string, now: Date): number {
  const item = progress.items[itemKey];
  if (!item) return 3;
  if (item.state === "learning") return 0;
  if (item.state === "new") return 1;
  return new Date(item.due).getTime() <= now.getTime() ? 2 : 4;
}

/** The priority of a card's item (see itemPriority). */
function priority(progress: Progress, card: string, now: Date): number {
  return itemPriority(progress, itemOfCard(card), now);
}

export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks the cards for a new session: every matching card ranked by priority (see above;
 * ties keep study order, and known cards come soonest-due first), the first `size` of
 * them, shuffled.
 */
export function startSession(
  deck: Deck,
  progress: Progress,
  filter: CardFilter,
  size: SessionSize,
  now: Date,
  random: () => number,
): Session {
  const due = (card: string) => new Date(progress.items[itemOfCard(card)]?.due ?? 0).getTime();
  const ranked = matchingCards(deck, filter)
    .map((card, order) => ({ card, order, rank: priority(progress, card, now) }))
    .sort((a, b) => a.rank - b.rank || (a.rank === 2 || a.rank === 4 ? due(a.card) - due(b.card) : 0) || a.order - b.order)
    .map((c) => c.card);
  const picked = size === "all" ? ranked : ranked.slice(0, size);
  return { filter, size, queue: shuffled(picked, random), total: picked.length, missed: [] };
}

/** A session over exactly these cards (to go over the ones missed last time), shuffled. */
export function sessionOf(cards: readonly string[], filter: CardFilter, random: () => number): Session {
  return { filter, size: "all", queue: shuffled(cards, random), total: cards.length, missed: [] };
}

/** "I know it": the top card leaves the session. */
export function markKnown(session: Session): Session {
  return { ...session, queue: session.queue.slice(1) };
}

/**
 * "I don't know it": the top card goes back to a random place in the rest of the deck,
 * never straight back on top while other cards remain.
 */
export function markMissed(session: Session, random: () => number): Session {
  const [card, ...rest] = session.queue;
  if (card === undefined) return session;
  const at = rest.length === 0 ? 0 : 1 + Math.floor(random() * rest.length);
  return {
    ...session,
    queue: [...rest.slice(0, at), card, ...rest.slice(at)],
    missed: session.missed.includes(card) ? session.missed : [...session.missed, card],
  };
}

const SESSION_KEY = "pt.session.v1";

const SavedSession = z.object({
  filter: z.object({
    kind: z.enum(["words", "sentences", "grammar", "verbs", "mistakes"]),
    level: z.union([LevelSchema, z.literal("all")]),
    topic: z.union([z.enum(TOPICS), z.literal("all")]),
    face: z.enum(["r", "p"]),
    tense: z.union([z.enum(TENSES), z.literal("all")]).optional(),
  }),
  size: z.union([z.literal("all"), z.number().int()]).refine(
    (s): s is SessionSize => s === "all" || (SESSION_SIZES as readonly number[]).includes(s),
  ),
  queue: z.array(z.string()),
  total: z.number().int().min(0),
  missed: z.array(z.string()),
});

/** The session in progress (kept so switching tabs doesn't lose it); null if none or unreadable. */
export function loadSession(storage: KeyValueStorage): Session | null {
  const raw = storage.getItem(SESSION_KEY);
  if (raw === null) return null;
  try {
    const parsed = SavedSession.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as Session) : null;
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    return null;
  }
}

export function saveSession(storage: KeyValueStorage, session: Session | null): void {
  storage.setItem(SESSION_KEY, session === null ? "null" : JSON.stringify(session));
}
