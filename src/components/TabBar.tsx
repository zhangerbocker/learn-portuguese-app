"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEM = "flex w-full flex-col items-center gap-0.5 py-2 text-xs";

// The saved theme lives in localStorage, so the button renders only in the browser.
const ThemeButton = dynamic(() => import("./ThemeButton").then((m) => m.ThemeButton), {
  ssr: false,
  loading: () => <span className={`${ITEM} invisible`}>Theme</span>,
});

const LevelButton = dynamic(() => import("./LevelButton").then((m) => m.LevelButton), {
  ssr: false,
  loading: () => <span className={`${ITEM} invisible`}>Levels</span>,
});

const TABS = [
  { href: "/today", label: "Today", pt: "Hoje" },
  { href: "/cards", label: "Cards", pt: "Cartões" },
  { href: "/read", label: "Read", pt: "Ler" },
  { href: "/chat", label: "Chat", pt: "Conversar" },
] as const;

/** The tab bar markup; `pathname` decides which tab is highlighted (none while unknown). */
export function TabBarView({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-stone-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`${ITEM} ${
                  active ? "text-red-700 dark:text-red-400" : "text-stone-500"
                }`}
              >
                <span className="font-pt text-base leading-none sm:text-lg">{tab.pt}</span>
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li className="w-14 shrink-0 sm:w-20">
          <LevelButton className={`${ITEM} text-stone-500`} />
        </li>
        <li className="w-14 shrink-0 sm:w-20">
          <ThemeButton className={`${ITEM} text-stone-500`} />
        </li>
      </ul>
    </nav>
  );
}

/** Reads the URL, so it must render inside <Suspense> (see layout.tsx). */
export function TabBar() {
  return <TabBarView pathname={usePathname()} />;
}
