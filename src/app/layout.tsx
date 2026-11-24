import type { Metadata, Viewport } from "next";
import { Noto_Serif, Source_Sans_3 } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorker } from "@/components/pwa/service-worker";
import { asset } from "@/lib/routes";
import "./globals.css";

const ui = Source_Sans_3({ variable: "--font-ui", subsets: ["latin", "latin-ext"] });
const reading = Noto_Serif({ variable: "--font-reading", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: { default: "JW+ Study Companion", template: "%s · JW+ Study" },
  description: "Dein persönlicher Studienbegleiter – privates, inoffizielles Studienwerkzeug.",
  applicationName: "JW+ Study",
  appleWebApp: { capable: true, title: "JW+ Study", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false, nocache: true },
  icons: {
    icon: [{ url: asset("/icons/icon.svg"), type: "image/svg+xml" }],
    apple: [{ url: asset("/icons/apple-touch-icon.png"), sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#14171c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning className={`${ui.variable} ${reading.variable} h-full`}>
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="jwps-theme" disableTransitionOnChange>
          {children}
          <Toaster position="top-center" />
        </ThemeProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
