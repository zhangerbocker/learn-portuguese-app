import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

// The type of gxzhang.com: Inter for the interface, Cormorant Garamond for Portuguese text (self-hosted by next/font).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Português",
  description: "Flashcards, reading and chat for Brazilian Portuguese, A1–A2",
  appleWebApp: { capable: true, title: "Português", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3ede1" },
    { media: "(prefers-color-scheme: dark)", color: "#14120f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The boot script sets the `dark` class before hydration, so the class may differ from the server HTML.
    <html lang="en" className={`h-full antialiased ${inter.variable} ${cormorant.variable}`} suppressHydrationWarning>
      <head>
        {/* Runs synchronously while the page is parsed, before first paint, so a dark page never flashes light. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
        {children}
        <ServiceWorker />
        {/* Vercel Web Analytics: cookieless page-view counts; only sends data on Vercel deployments. */}
        <Analytics />
      </body>
    </html>
  );
}
