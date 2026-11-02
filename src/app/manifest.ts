import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Português",
    short_name: "Português",
    description: "Flashcards, reading and chat for Brazilian Portuguese, A1–A2",
    start_url: "/today",
    display: "standalone",
    background_color: "#f3ede1",
    theme_color: "#c23b22",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
