"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-items";

/** Desktop: Navigation links (wie eine Bibliotheks-App). */
export function SideNav() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-surface lg:flex">
      <Link href="/" className="px-5 pt-6 pb-7">
        <Logo subtitle />
      </Link>
      <nav aria-label="Hauptnavigation" className="flex flex-col gap-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.95rem] transition-colors",
                active ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand-mid" aria-hidden />}
              <item.icon className="size-[1.15rem]" strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto px-5 pb-5 text-[0.7rem] leading-snug text-muted-foreground">
        Inoffizielles, privates Studienwerkzeug. Nicht mit Jehovas Zeugen oder jw.org verbunden.
      </p>
    </aside>
  );
}

/** Mobil: kompakte untere Navigation, einhändig bedienbar. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Hauptnavigation"
      className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85 lg:hidden"
    >
      <ul className="grid h-[3.75rem] grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-full flex-col items-center justify-center gap-0.5 text-[0.68rem]", active ? "font-semibold text-brand-mid" : "text-muted-foreground")}
              >
                <item.icon className="size-[1.35rem]" strokeWidth={active ? 2.2 : 1.8} />
                {item.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
