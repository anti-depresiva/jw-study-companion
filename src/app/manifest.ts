import type { MetadataRoute } from "next";
import { asset } from "@/lib/routes";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: asset("/"),
    name: "JW+ Study Companion",
    short_name: "JW+ Study",
    description: "Dein persönlicher Studienbegleiter – privates, inoffizielles Studienwerkzeug.",
    lang: "de",
    start_url: asset("/"),
    scope: asset("/"),
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f5f6f8",
    theme_color: "#1e3a6b",
    categories: ["education", "books"],
    icons: [
      { src: asset("/icons/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: asset("/icons/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: asset("/icons/maskable-192.png"), sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: asset("/icons/maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
