"use client";

import { useEffect, useRef, useState } from "react";
import { ChatSetup } from "./ChatSetup";
import { PronunciationPractice } from "./PronunciationPractice";
import { MicButton } from "../MicButton";
import { useDictation } from "../useDictation";
import { speakPortuguese } from "@/lib/speech";
import { ChatSummaryView } from "./ChatSummaryView";
import { PartnerMessage, UserMessage, type GapWord } from "./Messages";
import { BudgetNote } from "./BudgetNote";
import { BudgetError, openChat, sendMessage } from "./tutor-api";
import { setMe, useMe } from "../useMe";
import type { Me } from "@/lib/me";
import {
  chooseTargetWords,
  findScenario,
  loadConversation,
  MAX_MESSAGE_CHARS,
  mistakeFromTurn,
  saveConversation,
  type ChatMessage,
  type ChatRequest,
  type Conversation,
} from "@/lib/chat";
import { itemKey } from "@/lib/deck";
import { addMistake, localDay, saveProgress } from "@/lib/progress-store";
import { newItem, type Progress } from "@/lib/srs";
import { findWord, LEVEL_NAMES, WORDS, type Level } from "@/lib/words";
import { useProgress, useSettings } from "../useSettings";


function joinDraft(typed: string, spoken: string): string {
  return [typed.trim(), spoken.trim()].filter(Boolean).join(" ");
}

export function ChatApp() {
  // Rendered client-only (see ChatLoader), so browser storage is available at init.
  const [conversation, setConversation] = useState<Conversation | null>(() => loadConversation(window.localStorage));
  const progress = useProgress();
  const [{ accentsOptional }] = useSettings();
  const me = useMe();
  const outOfBudget = me?.role === "guest" && me.budget !== null && !me.budget.allowed;

  /** Shows a reply's budget, or the budget a refusal reports (no retry: it wouldn't help). */
  function noteBudget(budget: Me["budget"]) {
    if (budget) setMe({ role: "guest", budget });
  }
  const [draft, setDraft] = useState("");
  const [practice, setPractice] = useState<Level | null>(null);
  // Speech fills the message box (added after anything already typed) so it can be fixed before sending.
  const draftBeforeSpeech = useRef("");
  // When a message was spoken, the reply is read aloud too.
  const spoken = useRef(false);
  // Sending while still listening sends what was heard so far; the late final result is dropped.
  const sentWhileListening = useRef(false);
  const dictation = useDictation((text) => {
    if (sentWhileListening.current) {
      sentWhileListening.current = false;
      return;
    }
    setDraft(joinDraft(draftBeforeSpeech.current, text));
    spoken.current = true;
  });
  const shownDraft = dictation.listening ? joinDraft(draftBeforeSpeech.current, dictation.text) : draft;
  const [pending, setPending] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<{ message: string; retry: () => void } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation?.messages.length, pending]);

  function update(next: Conversation | null) {
    saveConversation(window.localStorage, next);
    setConversation(next);
  }

  function request(level: Level, scenarioId: string, messages: ChatMessage[], message?: string): ChatRequest {
    const targets = chooseTargetWords(progress, WORDS, level, findScenario(scenarioId)!, new Date());
    return {
      level,
      scenario: scenarioId,
      targetWordIds: targets.map((w) => w.id),
      history: messages.map((m) => ({ role: m.role, text: m.text })),
      ...(message === undefined ? {} : { message }),
    };
  }

  async function start(level: Level, scenarioId: string) {
    setStarting(true);
    setError(null);
    try {
      const { partner: line, budget } = await openChat(request(level, scenarioId, []));
      noteBudget(budget);
      update({ level, scenario: scenarioId, messages: [{ role: "partner", text: line.reply, en: line.replyEn }] });
    } catch (err) {
      if (!(err instanceof Error)) throw err;
      if (err instanceof BudgetError) return noteBudget(err.budget);
      setError({ message: err.message, retry: () => void start(level, scenarioId) });
    } finally {
      setStarting(false);
    }
  }

  async function send(text: string) {
    if (!conversation || pending !== null) return;
    const message = text.trim();
    if (!message) return;
    const readReply = spoken.current || dictation.listening;
    if (dictation.listening) {
      sentWhileListening.current = true;
      dictation.stop();
    }
    spoken.current = false;
    setPending(message);
    setDraft("");
    setError(null);
    try {
      const turn = await sendMessage(request(conversation.level, conversation.scenario, conversation.messages, message));
      noteBudget(turn.budget);
      const now = new Date();
      const mistake = mistakeFromTurn(message, turn.check, `chat-${now.getTime()}`, localDay(now), accentsOptional);
      if (mistake) addMistake(window.localStorage, mistake);
      if (readReply) speakPortuguese(turn.partner.reply);
      update({
        ...conversation,
        messages: [
          ...conversation.messages,
          { role: "user", text: message, check: turn.check },
          { role: "partner", text: turn.partner.reply, en: turn.partner.replyEn },
        ],
      });
    } catch (err) {
      if (!(err instanceof Error)) throw err;
      setDraft(message);
      if (err instanceof BudgetError) return noteBudget(err.budget);
      setError({ message: err.message, retry: () => void send(message) });
    } finally {
      setPending(null);
    }
  }

  function gapWord(pt: string): GapWord {
    const word = findWord(pt);
    return { word, status: word && progress.items[itemKey("word", word.id)] ? "studying" : "new" };
  }

  /** Adds words to the flashcards in one update (skipping any already there). */
  function addWords(wordIds: readonly number[]) {
    const now = new Date();
    const added = wordIds.map((id) => itemKey("word", id)).filter((key) => !progress.items[key]);
    if (added.length === 0) return;
    const updated: Progress = { items: { ...progress.items, ...Object.fromEntries(added.map((key) => [key, newItem(now, localDay(now))])) } };
    saveProgress(window.localStorage, updated);
  }
  const addWord = (wordId: number) => addWords([wordId]);

  const errorBanner = error && (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
      <span>{error.message}</span>
      <button type="button" onClick={error.retry} className="shrink-0 rounded-full bg-red-700 px-3 py-1 text-white dark:bg-red-500">
        Retry
      </button>
    </div>
  );

  if (!conversation && practice !== null) {
    return <PronunciationPractice level={practice} onBack={() => setPractice(null)} />;
  }
  if (!conversation) {
    return (
      <div className="flex flex-col gap-4">
        <ChatSetup starting={starting} me={me} onStart={(level, scenario) => void start(level, scenario)} onPronounce={setPractice} />
        {starting && <p className="text-center text-sm text-stone-500">Starting the conversation…</p>}
        {errorBanner}
      </div>
    );
  }

  const scenario = findScenario(conversation.scenario)!;
  const newChat = () => {
    update(null);
    setError(null);
    setDraft("");
  };
  if (conversation.ended) {
    return (
      <ChatSummaryView
        title={scenario.title}
        conversation={conversation}
        progress={progress}
        accentsOptional={accentsOptional}
        onAddWords={addWords}
        onKeepChatting={() => update({ ...conversation, ended: false })}
        onNewChat={newChat}
      />
    );
  }
  const hasUserMessages = conversation.messages.some((m) => m.role === "user");
  return (
    <div className="flex flex-1 flex-col gap-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-semibold">{scenario.title}</h1>
          <p className="text-xs text-stone-500">{LEVEL_NAMES[conversation.level]} · tap ? for English</p>
        </div>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => (hasUserMessages ? update({ ...conversation, ended: true }) : newChat())}
          className="rounded-full border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-stone-700"
        >
          {hasUserMessages ? "End chat" : "New chat"}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3">
        {conversation.messages.map((m, i) =>
          m.role === "partner" ? (
            <PartnerMessage key={i} text={m.text} en={m.en} />
          ) : (
            <UserMessage key={i} text={m.text} check={m.check} accentsOptional={accentsOptional} gapWord={gapWord} onAddWord={addWord} />
          ),
        )}
        {pending !== null && (
          <>
            <UserMessage text={pending} accentsOptional={accentsOptional} gapWord={gapWord} onAddWord={addWord} />
            <p className="self-start text-sm text-stone-400">…</p>
          </>
        )}
        <div ref={bottom} />
      </div>

      {errorBanner}
      {dictation.error && !dictation.listening && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {dictation.error}
        </p>
      )}
      <BudgetNote me={me} compact />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(shownDraft);
        }}
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex items-end gap-2 bg-stone-50 pt-1 dark:bg-stone-950"
      >
        <textarea
          value={shownDraft}
          readOnly={dictation.listening}
          onChange={(e) => {
            setDraft(e.target.value);
            if (!e.target.value.trim()) spoken.current = false;
          }}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter (and Enter while an IME is composing) doesn't.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(shownDraft);
            }
          }}
          rows={1}
          maxLength={MAX_MESSAGE_CHARS}
          placeholder={dictation.listening ? "Fale agora…" : "Em português…"}
          aria-label="Your message"
          className="font-pt max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-lg dark:border-stone-700 dark:bg-stone-900"
        />
        {dictation.supported && (
          <MicButton
            listening={dictation.listening}
            disabled={pending !== null || outOfBudget}
            onStart={() => {
              draftBeforeSpeech.current = draft;
              sentWhileListening.current = false;
              dictation.start();
            }}
            onStop={dictation.stop}
          />
        )}
        <button
          type="submit"
          disabled={pending !== null || !shownDraft.trim() || outOfBudget}
          className="h-11 shrink-0 rounded-full px-4 font-medium bg-red-700 text-white hover:bg-red-800 dark:bg-red-500 dark:text-white dark:hover:bg-red-400 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
