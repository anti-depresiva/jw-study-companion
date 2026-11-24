import { cn } from "@/lib/utils";

/** App-Icon als Inline-SVG (identisch mit public/icons/icon.svg). */
export function AppIcon({ className, title = "JW+ Study Companion" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn("shrink-0", className)} role="img" aria-label={title}>
      <defs>
        <linearGradient id="jwps-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2d5aa0" />
          <stop offset="1" stopColor="#132a52" />
        </linearGradient>
        <linearGradient id="jwps-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2c27a" />
          <stop offset="1" stopColor="#c49a3e" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#jwps-bg)" />
      <path d="M256 170c-38-28-92-38-148-30v214c56-8 110 2 148 30z" fill="#fff" />
      <path d="M256 170c38-28 92-38 148-30v214c-56-8-110 2-148 30z" fill="#fff" />
      <path d="M256 170v214" stroke="#132a52" strokeOpacity=".22" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M140 196c36-4 70 2 92 14M140 238c36-4 70 2 92 14M140 280c36-4 70 2 92 14"
        stroke="#2d5aa0"
        strokeOpacity=".28"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M338 146v92l20-16 20 16v-96c-14-1-27 0-40 4z" fill="url(#jwps-gold)" />
    </svg>
  );
}

/** Wortmarke „JW+ Study“ mit goldenem Plus. */
export function Wordmark({ className, subtitle = false }: { className?: string; subtitle?: boolean }) {
  return (
    <span className={cn("flex flex-col leading-none", className)}>
      <span className="text-[1.05rem] font-semibold tracking-tight text-foreground">
        JW<span className="text-gold">+</span> Study
        <span className="font-normal text-muted-foreground"> Companion</span>
      </span>
      {subtitle && <span className="mt-1 text-xs text-muted-foreground">Dein persönlicher Studienbegleiter</span>}
    </span>
  );
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <AppIcon className="size-9 rounded-[10px] shadow-sm" />
      <Wordmark subtitle={subtitle} />
    </span>
  );
}
