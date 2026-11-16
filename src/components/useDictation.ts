import { useEffect, useRef, useState } from "react";
import { browserRecognizer, speechInputSupported, type Recognizer } from "@/lib/recognizer";

export interface Dictation {
  supported: boolean;
  listening: boolean;
  /** What's been heard in the current (or last) recording. */
  text: string;
  alternatives: string[];
  error: string | null;
  start: () => void;
  stop: () => void;
}

/**
 * Speech to text for one input. `onDone` gets the final text (and other guesses) when listening stops.
 * The engine comes from `recognizer.ts`; swap `browserRecognizer` there to change it everywhere.
 */
export function useDictation(onDone?: (text: string, alternatives: string[]) => void): Dictation {
  const recognizer = useRef<Recognizer | null>(null);
  const heard = useRef<{ text: string; alternatives: string[] }>({ text: "", alternatives: [] });
  const done = useRef(onDone);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => () => recognizer.current?.stop(), []);

  function start() {
    recognizer.current?.stop();
    const r = browserRecognizer();
    recognizer.current = r;
    heard.current = { text: "", alternatives: [] };
    setText("");
    setAlternatives([]);
    setError(null);
    setListening(true);
    r.start({
      onResult(t, _final, alts) {
        heard.current = { text: t, alternatives: alts };
        setText(t);
        setAlternatives(alts);
      },
      onError: setError,
      onEnd() {
        if (recognizer.current !== r) return;
        recognizer.current = null;
        setListening(false);
        if (heard.current.text) done.current?.(heard.current.text, heard.current.alternatives);
      },
    });
  }

  return {
    supported: speechInputSupported(),
    listening,
    text,
    alternatives,
    error,
    start,
    stop: () => recognizer.current?.stop(),
  };
}
