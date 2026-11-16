/**
 * Speech to text, behind a small interface so the engine can be swapped. Today it's the browser's
 * built-in recognizer (free; Chrome, Edge and Safari). A paid engine such as Whisper would be another
 * `Recognizer`: record with MediaRecorder, then on stop() post the audio to a server route that holds
 * the key, and call onResult once with the final text.
 */

export interface RecognizerHandlers {
  /** What was heard so far (`final` once the engine is sure); `alternatives` are other guesses, best first. */
  onResult: (text: string, final: boolean, alternatives: string[]) => void;
  /** A message for the learner (no microphone, permission denied, nothing heard…). */
  onError: (message: string) => void;
  /** Listening stopped (after stop(), silence, or an error). */
  onEnd: () => void;
}

export interface Recognizer {
  start(handlers: RecognizerHandlers): void;
  stop(): void;
}

// The Web Speech API isn't in TypeScript's DOM types; this is the part used here.
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function browserEngine(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Whether this browser can turn speech into text. */
export function speechInputSupported(): boolean {
  return browserEngine() !== undefined;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings and try again.",
  "service-not-allowed": "Speech recognition isn't allowed in this browser.",
  "no-speech": "I didn't hear anything. Tap the microphone and try again.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs an internet connection.",
};

/** The browser's recognizer, listening for Brazilian Portuguese until stopped (or a pause, in some browsers). */
export function browserRecognizer(): Recognizer {
  let active: SpeechRecognitionLike | null = null;
  return {
    start(handlers) {
      const Engine = browserEngine();
      if (!Engine) {
        handlers.onError("This browser can't do speech recognition. Try Chrome, Edge or Safari.");
        handlers.onEnd();
        return;
      }
      const recognition = new Engine();
      recognition.lang = "pt-BR";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      recognition.onresult = (event) => {
        // Joins every phrase heard so far; the last one may still be interim.
        const results = Array.from(event.results);
        const best = results.map((r) => r[0].transcript).join(" ").replace(/\s+/g, " ").trim();
        const last = results[results.length - 1];
        const final = results.every((r) => r.isFinal);
        const earlier = results.slice(0, -1).map((r) => r[0].transcript).join(" ");
        const alternatives = Array.from(last)
          .slice(1)
          .map((a) => `${earlier} ${a.transcript}`.replace(/\s+/g, " ").trim());
        handlers.onResult(best, final, alternatives);
      };
      recognition.onerror = (event) => {
        if (event.error !== "aborted") handlers.onError(ERRORS[event.error] ?? `Speech recognition failed (${event.error}).`);
      };
      recognition.onend = () => {
        active = null;
        handlers.onEnd();
      };
      active = recognition;
      recognition.start();
    },
    stop() {
      active?.stop();
    },
  };
}
