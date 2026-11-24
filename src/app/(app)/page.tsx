"use client";

import Link from "next/link";
import { BookMarked, BookOpenText, CalendarClock, ChevronRight, Settings, Star, User } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LoadError, Loading } from "@/components/study/loading";
import { PrepareButton } from "@/components/study/prepare-button";
import { StatusDot } from "@/components/study/status-dot";
import { Container, ProgressBar } from "@/components/study/ui";
import { useData } from "@/lib/client/use-data";
import { store } from "@/lib/data";
import { weekHref } from "@/lib/routes";
import { loadWeek } from "@/lib/study/load";
import { currentWeek, formatLong, formatRange, nextMeeting } from "@/lib/week";

function greeting(name: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Vienna", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .find((p) => p.type === "hour")?.value ?? 12,
  );
  const base = hour < 11 ? "Guten Morgen" : hour < 18 ? "Willkommen zurück" : "Guten Abend";
  return name ? `${base}, ${name}!` : `${base}!`;
}

export default function HomePage() {
  const cw = currentWeek();
  const { data, error } = useData(async () => {
    const [week, weeks, favorites] = await Promise.all([loadWeek(cw.year, cw.week), store.listWeeks(), store.listFavorites()]);
    return { ...week, weeks, favorites };
  }, [cw.year, cw.week]);

  if (error) return <Container><LoadError error={error} /></Container>;
  if (!data) return <Loading />;

  const { settings, week, article, workbook, summary, weeks, favorites } = data;
  const meeting = nextMeeting(settings.midweekDay, settings.weekendDay);
  const others = weeks.filter((w) => w.id !== week?.id);
  const lastPrepared = others.find((w) => w.status === "vorbereitet") ?? null;
  const initial = settings.displayName.slice(0, 1).toUpperCase();

  return (
    <Container>
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/" className="lg:hidden">
          <Logo />
        </Link>
        <div className="hidden lg:block">
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
            KW {cw.week} · {formatRange(cw.start, cw.end)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href="/einstellungen/" aria-label="Einstellungen" className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <Settings className="size-5" />
          </Link>
          <Link
            href="/einstellungen/#profil"
            aria-label="Benutzerprofil"
            className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-primary-foreground"
          >
            {initial || <User className="size-4" />}
          </Link>
        </div>
      </div>

      <section className="fade-in mb-6">
        <h1 className="text-[1.6rem] font-semibold tracking-tight sm:text-3xl">{greeting(settings.displayName)}</h1>
        <p className="mt-1 text-muted-foreground">Deine nächste Zusammenkunft wartet auf dich.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-secondary px-3 py-1 font-medium text-secondary-foreground lg:hidden">
            KW {cw.week} · {formatRange(cw.start, cw.end)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-3 py-1">
            <CalendarClock className="size-4 text-gold" />
            {meeting.label}: <strong className="font-semibold">{formatLong(meeting.date)}</strong>
          </span>
        </div>
      </section>

      <section className="fade-in overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]" aria-labelledby="prep-title">
        <div className="border-b bg-gradient-to-br from-accent/70 to-transparent px-5 pt-5 pb-4">
          <p className="eyebrow text-gold">Diese Woche</p>
          <h2 id="prep-title" className="mt-1 text-xl font-semibold">
            Deine Vorbereitung für diese Woche
          </h2>
        </div>
        <ul className="divide-y">
          <PrepRow
            href={weekHref("/arbeitsheft", cw.year, cw.week)}
            icon={BookOpenText}
            title="Arbeitsheft"
            subtitle={workbook ? workbook.bibleReading || workbook.title : "Noch nicht importiert"}
            done={summary.workbookDone}
            total={summary.workbookTotal}
            unit="Punkten"
          />
          <PrepRow
            href={weekHref("/wachtturm", cw.year, cw.week)}
            icon={BookMarked}
            title="Wachtturm-Studium"
            subtitle={article ? article.title : "Noch nicht importiert"}
            done={summary.watchtowerDone}
            total={summary.watchtowerTotal}
            unit="Absätzen"
          />
        </ul>
        <div className="space-y-4 px-5 pt-4 pb-5">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-medium">Gesamtfortschritt</span>
              <span className="font-semibold text-brand-mid tabular-nums">{summary.percent} %</span>
            </div>
            <ProgressBar value={summary.percent} label="Gesamtfortschritt" />
          </div>
          <PrepareButton year={cw.year} week={cw.week} notify={settings.notifications} initialJob={week?.prepJob} weekId={week?.id} />
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <QuickTile href={weekHref("/arbeitsheft", cw.year, cw.week)} icon={BookOpenText} title="Arbeitsheft" text="Unser Leben und Dienst" />
        <QuickTile href={weekHref("/wachtturm", cw.year, cw.week)} icon={BookMarked} title="Wachtturm" text="Studienartikel der Woche" />
      </section>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="eyebrow mb-2 text-muted-foreground">Letzte vorbereitete Woche</h2>
          {lastPrepared ? (
            <Link
              href={weekHref("/zusammenkuenfte", lastPrepared.year, lastPrepared.week)}
              className="group flex items-center justify-between rounded-xl border bg-surface px-4 py-3 hover:border-brand-mid/40"
            >
              <span>
                <span className="block font-medium">
                  KW {lastPrepared.week}/{lastPrepared.year}
                </span>
                <span className="text-sm text-muted-foreground">{formatRange(lastPrepared.start, lastPrepared.end)}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground" />
            </Link>
          ) : (
            <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Noch keine frühere Woche vorbereitet.</p>
          )}

          <h2 className="eyebrow mt-6 mb-2 text-muted-foreground">Frühere Wochen</h2>
          {others.length ? (
            <ul className="divide-y rounded-xl border bg-surface">
              {others.slice(0, 4).map((w) => (
                <li key={w.id}>
                  <Link href={weekHref("/zusammenkuenfte", w.year, w.week)} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/60">
                    <span>
                      KW {w.week}/{w.year} <span className="text-muted-foreground">· {formatRange(w.start, w.end)}</span>
                    </span>
                    <StatusDot status={w.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Dein Wochenarchiv füllt sich mit jeder vorbereiteten Woche.</p>
          )}
          <Link href="/archiv/" className="mt-2 inline-block text-sm font-medium text-brand-mid hover:underline">
            Zum Wochenarchiv
          </Link>
        </section>

        <section>
          <h2 className="eyebrow mb-2 text-muted-foreground">Gespeicherte Favoriten</h2>
          {favorites.length ? (
            <ul className="space-y-2">
              {favorites.slice(0, 3).map((f) => (
                <li key={f.id}>
                  <Link href={f.href} className="block rounded-xl border bg-surface px-4 py-3 hover:border-brand-mid/40">
                    <span className="eyebrow text-gold">{f.label}</span>
                    <span className="reading-sm mt-1 line-clamp-2 block">{f.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              <Star className="size-4" /> Markiere Antworten mit dem Stern, um sie hier zu sammeln.
            </p>
          )}
          <Link href="/favoriten/" className="mt-2 inline-block text-sm font-medium text-brand-mid hover:underline">
            Alle Favoriten
          </Link>
        </section>
      </div>
    </Container>
  );
}

function PrepRow(props: { href: string; icon: React.ElementType; title: string; subtitle: string; done: number; total: number; unit: string }) {
  const Icon = props.icon;
  return (
    <li>
      <Link href={props.href} className="group flex items-center gap-4 px-5 py-4 hover:bg-muted/50">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{props.title}</span>
          <span className="block truncate text-sm text-muted-foreground">{props.subtitle}</span>
          {props.total > 0 && (
            <span className="mt-1.5 flex items-center gap-2">
              <ProgressBar value={(props.done / props.total) * 100} className="max-w-40" label={`${props.title} Fortschritt`} />
              <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {props.done} von {props.total} {props.unit} vorbereitet
              </span>
            </span>
          )}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
      </Link>
    </li>
  );
}

function QuickTile({ href, icon: Icon, title, text }: { href: string; icon: React.ElementType; title: string; text: string }) {
  return (
    <Link href={href} className="group rounded-xl border bg-surface p-4 transition-colors hover:border-brand-mid/40 hover:bg-accent/40">
      <Icon className="mb-3 size-5 text-brand-mid" />
      <span className="block font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </Link>
  );
}
