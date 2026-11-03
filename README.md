# Português

A study app for **Brazilian Portuguese, CEFR A1–A2**: spaced-repetition flashcards (words, sentences,
grammar and verb conjugations), graded reading with tap-to-translate, and a chat partner that corrects
every message.

Adapted, with permission, from [ScharanCysne/mandarin](https://github.com/ScharanCysne/mandarin), an HSK
Chinese app. The content model, tokenizer, answer checking and prompts were rewritten for Portuguese.

## Run

```bash
npm install
npm run dev
```

- Laptop: http://localhost:3000 (no login locally unless `SESSION_SECRET` is set).
- Phone (same Wi-Fi): `npm run dev -- -H 0.0.0.0`, then http://<laptop-LAN-IP>:3000
  (find it with `ipconfig getifaddr en0` on macOS).

Chat and "New story" call Claude. Put a key in `.env.local` (git-ignored): either an MIT Parley key
(`PARLEY_API_KEY`, with `PARLEY_MODEL`) or an Anthropic key (`ANTHROPIC_API_KEY`); Parley is used when its
key is set. Check the key with `npx tsx --env-file=.env.local scripts/check-claude.ts`.

## Daily practice (Hoje)

The app opens on **Hoje** (Today): a ~5-minute lesson of about 12 exercises, built fresh each day from
the word list, example sentences and stories (no AI, so it's free and works offline).

- **Theme:** chosen automatically. Themes take turns by date (all topics except "Function words"), but a
  theme with clearly more trouble words (3+ more than the scheduled one) goes first.
- **Review first:** up to 3 words you keep missing (2+ misses in 30 days), then missed, then due ones.
- **Theme words:** about 6 words from the theme you're learning or haven't seen, at the lowest
  switched-on level that still has unlearned words.
- **Short read:** a story from the theme with 2 questions (whole if it's short, otherwise the first
  ~120 words with "which of these happens?" questions); tap words for their meaning.
- **Exercises (typed):** say an English word in Portuguese (nouns with or without the article), fill in
  the missing form in a sentence (its dictionary form is the hint), and translate a sentence. Answers
  are checked like Cards (case and punctuation ignored; accents optional per the setting), and a wrong
  answer can be counted as right when it means the same. The read keeps multiple-choice questions.
- **Tap any word** in an answer or story for its meaning, dictionary form, other forms (verb tables), a
  hand-written usage note for tricky words (`data/word-notes.json`: lhe, se, a gente, contractions…)
  and **Ask the tutor**: an AI explanation of the word in that sentence, with follow-up questions
  (`POST /api/explain`, about 0.4¢ each; guests' questions share their chat budget). The Reading tab's
  word panel has the same notes and tutor.
- **Mistakes:** a wrong answer comes back once at the end of the lesson. Only the first answer counts
  on the word's schedule, so a missed word leads the next lessons until you get it right first time.
- **Same lesson all day** (it's seeded by the date); "Practice again" builds a new one. A lesson in
  progress resumes when you come back. Lessons use the same streak as Cards.

Planner: `src/lib/daily.ts` (pure, tested in `daily.test.ts`); lesson state: `src/lib/daily-store.ts`;
screens: `src/components/today/`.

## Flashcards

Tap **New session** and choose what to study (Words, Sentences, Grammar, Verbs or your chat Mistakes,
filtered by level, topic, direction or tense) and how many cards: 10–80, or **All**.

- **→ / "I know it"**: the card leaves the session.
- **← / "I don't know it"**: the card is shuffled back into the rest of the deck, and keeps coming back
  until you know it.
- **Space** (or tapping the card) flips it over, and again to flip it back.

When the deck is empty the session is complete; you can go over just the cards you missed, or start a new
session. A session survives switching tabs.

Every answer is remembered per word, grammar point or verb tense, so new sessions are picked in this order:
cards you missed last time, words you added from a story or chat, known cards due again (1, 3, 7, 14, 30,
then 60 days after each "know"), new cards in study order (A1 before A2, by topic), and finally known cards
not yet due. The chosen cards are shuffled.

Card types (keys in `src/lib/deck.ts`):

| Card | Front → back |
|---|---|
| Word | Português (nouns with o/a) → meaning, example; or English → Português (the **Direction** setting). Verbs also show their present and past conjugations |
| Sentence | example sentence → English; or English → Português |
| Grammar | pattern + English → Portuguese example (rotates through examples); or a typical mistake → correction |
| Conjugation | infinitive + tense + person → form, with the full table on the back; a drill's level is the harder of the verb's and the tense's (the subjunctive of an A1 verb is a B1 drill) |
| From your chat | your mistake → correction |

- **Typed answers** (settings) ignore case and punctuation; nouns are accepted with or without the article
  and verb forms with or without the pronoun.
- **Missing accents count as correct** (settings, on by default): a typed answer or chat message that only
  misses accents (nao, cafe) counts as right, and the accented spelling is shown. Turn it off to have
  accent slips flagged in cards and saved as chat mistakes.
- Audio uses the browser's pt-BR voice.

## Reading

- **Library**: A1 / A2 → 12 topics → stories (`data/stories.json`). Each card shows how much of the story's
  vocabulary you already know and whether you've read it.
- **Reader**: tap a word for its meaning in context plus its dictionary entry (conjugated verbs and plurals
  link to the infinitive or singular), and add it to your flashcards. Press and hold a sentence, or tap EN,
  for its translation; ▶ reads the story or sentence aloud. Words you don't know yet are underlined.
- After the story: 3 comprehension questions (tap EN for a translation) and "Mark as read".
- **New story** (per topic) asks Claude for a fresh story via `POST /api/stories`; it goes through the same
  vocabulary check and is saved in this browser.

## Chat

Pick a level and a scenario (a padaria in São Paulo, weekend plans, work, family, getting around Rio). The
partner replies in simple Brazilian Portuguese within your level's words; every message you send is
checked, mistakes (including missing accents and gender agreement) become flashcards, and English words
you used for gaps are looked up. "End chat" shows a summary.

**Owner and guests.** Logging in with the owner passcode gives unlimited chat, "New story" and synced
progress. The shared guest passcode gives a chat budget ($0.25 per login, $5 for all guests together),
shown on the chat screen, and keeps progress on the guest's device. See `docs/deploy.md` → Guests.

## Checks

```bash
npm test          # vitest
npm run typecheck
npm run lint
npm run build
```

## Content

Levels **A1, A2, B1 and B2**. The **Levels** button in the tab bar switches B1–B2 on or off across the
whole app (cards, reading and chat); it starts on A1–A2.

The content is written by hand as drafts and built into the app's data files:

| Source | Built into | Notes |
|---|---|---|
| `data/drafts/words/*.json` | `data/words.json` | words with gender, inflected forms and an example; duplicates across levels keep the lowest level, and ids stay stable across rebuilds |
| `data/irregular-verbs.json` + verbs in the word list | `data/verbs.json` | 8 tenses (present, preterite, imperfect, future, conditional, present/imperfect/future subjunctive), gerund and participle; regular verbs are computed by `regularForms` |
| `data/drafts/grammar/*.json` | `data/grammar.json` | the words each grammar point uses are filled in |
| `data/drafts/stories/*.json` | `data/stories.json` | tokenized; each sentence can gloss words in context, the rest get their dictionary meaning |
| `data/allowed-extras.json` | | names and places allowed in stories |

```bash
npx tsx scripts/build-content.ts            # rebuild the data files (refuses if anything fails a check)
npx tsx scripts/build-content.ts --check    # just report problems (e.g. a story word not in the list)
```

Every grammar example and story may only use words from the list at its level or below (any inflected
form), and the build checks that each word's example uses it.
