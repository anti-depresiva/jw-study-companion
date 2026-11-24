import { AppIcon } from "@/components/brand/logo";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <AppIcon className="size-16 rounded-2xl" />
      <h1 className="text-xl font-semibold">Du bist offline</h1>
      <p className="text-muted-foreground">
        Bereits geöffnete Seiten stehen weiterhin zur Verfügung. Sobald du wieder online bist, wird alles aktualisiert.
      </p>
    </main>
  );
}
