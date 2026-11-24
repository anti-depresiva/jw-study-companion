import { Archive, BookMarked, BookOpenText, CalendarDays, Home, Settings, Star, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Pfad-Präfixe, für die der Eintrag als aktiv gilt */
  match: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Startseite", short: "Start", icon: Home, match: ["/"] },
  { href: "/zusammenkuenfte", label: "Zusammenkünfte", short: "Woche", icon: CalendarDays, match: ["/zusammenkuenfte", "/import"] },
  { href: "/arbeitsheft", label: "Arbeitsheft", short: "Arbeitsheft", icon: BookOpenText, match: ["/arbeitsheft"] },
  { href: "/wachtturm", label: "Wachtturm", short: "Wachtturm", icon: BookMarked, match: ["/wachtturm"] },
  { href: "/favoriten", label: "Favoriten", short: "Favoriten", icon: Star, match: ["/favoriten"] },
  { href: "/archiv", label: "Wochenarchiv", short: "Archiv", icon: Archive, match: ["/archiv", "/quellen"] },
  { href: "/einstellungen", label: "Einstellungen", short: "Einstellungen", icon: Settings, match: ["/einstellungen"] },
];

export function isActive(item: NavItem, rawPath: string) {
  const pathname = rawPath.length > 1 && rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;
  return item.match.some((m) => (m === "/" ? pathname === "/" : pathname === m || pathname.startsWith(`${m}/`)));
}
