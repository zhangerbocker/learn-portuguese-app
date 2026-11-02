"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { logIn } from "./login";

export function LoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await logIn(passcode);
      if (result.ok) {
        router.replace("/today");
        return;
      }
      setError(result.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <h1 className="font-pt text-center text-4xl text-red-700 dark:text-red-400">Português</h1>
      <div className="relative">
        <input
          type={shown ? "text" : "password"}
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          aria-label="Passcode"
          // Room on the right for the eye button (a password manager's icon sits just left of it).
          className="w-full rounded-2xl border border-stone-300 bg-white py-3 pl-4 pr-12 text-lg dark:border-stone-700 dark:bg-stone-900"
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide passcode" : "Show passcode"}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {shown && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || !passcode}
        className="rounded-full py-3 font-medium bg-red-700 text-white hover:bg-red-800 dark:bg-red-500 dark:text-white dark:hover:bg-red-400 disabled:opacity-40"
      >
        {busy ? "Checking…" : "Open"}
      </button>
    </form>
  );
}
