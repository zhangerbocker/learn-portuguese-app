"use client";

import dynamic from "next/dynamic";
import { whenSynced } from "../sync";

// Lessons are built from progress in localStorage (synced with the server first), so this renders only in the browser.
export const TodayLoader = dynamic(() => whenSynced().then(() => import("./TodayApp")).then((m) => m.TodayApp), {
  ssr: false,
  loading: () => <p className="m-auto text-stone-400">Loading…</p>,
});
