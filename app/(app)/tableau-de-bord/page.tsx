import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3Icon,
  BellIcon,
  CalendarDaysIcon,
  CoinsIcon,
  HistoryIcon,
  ReceiptTextIcon,
  SparklesIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { FixtureRow } from "@/components/matches/fixture-row";
import { PredictionResultBadge } from "@/components/settle/result-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getPredictionFlags, listFixtures } from "@/lib/catalog/queries";
import { formatSignedAmount, transactionTypeLabel } from "@/lib/credits/labels";
import { getWalletBalance, listTransactions } from "@/lib/credits/queries";
import { listNotifications } from "@/lib/notifications/queries";
import { formatRate } from "@/lib/settle/labels";
import { getMyPredictions, getPerformanceStats } from "@/lib/settle/queries";
import { cn } from "@/lib/utils";
import { formatDateTime, formatShortDate, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Tableau de bord · PRONEX" };

const UPCOMING_WINDOW_HOURS = 48;
const UPCOMING_MAX = 6;
const RECENT_PREDICTIONS = 5;

const QUICK_ACTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/matchs", label: "Matchs", icon: CalendarDaysIcon },
  { href: "/mes-pronostics", label: "Mes pronostics", icon: TargetIcon },
  { href: "/portefeuille", label: "Portefeuille", icon: HistoryIcon },
  { href: "/portefeuille/recus", label: "Reçus", icon: ReceiptTextIcon },
  { href: "/performances", label: "Performances", icon: BarChart3Icon },
  { href: "/notifications", label: "Notifications", icon: BellIcon },
];

/** Carte de section du tableau de bord : titre, lien « Tout voir », contenu. */
function Panel({ title, icon: Icon, href, linkLabel, children, className }: {
  title: string;
  icon: LucideIcon;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-4 rounded-2xl border border-white/8 bg-card p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Icon className="size-4 text-pronex-pink" aria-hidden />
          {title}
        </h2>
        {href ? (
          <Link href={href} className="text-sm font-medium text-pronex-pink hover:underline">
            {linkLabel ?? "Tout voir"}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);
  const now = new Date();

  const [balance, fixtures, myPredictions, history, notifications, performance] = await Promise.all([
    getWalletBalance(user.id),
    listFixtures({ from: now, to: new Date(now.getTime() + UPCOMING_WINDOW_HOURS * 3600 * 1000) }),
    getMyPredictions(RECENT_PREDICTIONS),
    listTransactions(user.id, 1),
    listNotifications(user.id),
    getPerformanceStats().catch(() => null),
  ]);
  const notStarted = fixtures.filter((f) => f.status_short === "NS" || f.status_short === "TBD");
  const flags = await getPredictionFlags(notStarted.map((f) => f.id));
  const analysed = notStarted.filter((f) => flags.has(f.id));
  const upcoming = analysed.slice(0, UPCOMING_MAX);
  const recentTx = history.rows.slice(0, 4);
  const recentNotifications = notifications.slice(0, 3);
  const unread = notifications.filter((n) => !n.read_at).length;
  const resolved = performance ? performance.global.won + performance.global.lost : 0;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:py-8">
      {/* Essentiel visible immédiatement : solde, analyses disponibles, action principale. */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-linear-to-br from-pronex-violet/20 via-card to-pronex-pink/10 p-6 sm:p-8">
          <h1 className="text-sm font-normal text-muted-foreground">Bonjour {user.profile.display_name}<span className="sr-only"> · tableau de bord</span></h1>
          <p className="mt-4 text-xs tracking-wider text-muted-foreground uppercase">Votre solde</p>
          <p className="font-heading text-5xl font-extrabold tabular-nums">{balance !== null ? balance : "—"}</p>
          <p className="text-sm text-muted-foreground">crédit{balance !== null && Math.abs(balance) > 1 ? "s" : ""} disponible{balance !== null && Math.abs(balance) > 1 ? "s" : ""}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/recharger?next=/tableau-de-bord" className={buttonVariants({ variant: "hero" })}>
              <CoinsIcon aria-hidden />
              Acheter des crédits
            </Link>
            <Link href="/portefeuille" className={buttonVariants({ variant: "outline" })}>
              Historique
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col justify-between rounded-2xl border border-white/8 bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SparklesIcon className="size-3.5 text-pronex-pink" aria-hidden />
              Analyses disponibles
            </p>
            <p className="font-heading text-3xl font-extrabold tabular-nums">{analysed.length}</p>
            <p className="text-xs text-muted-foreground">Matchs des {UPCOMING_WINDOW_HOURS} prochaines heures</p>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-white/8 bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BarChart3Icon className="size-3.5 text-pronex-pink" aria-hidden />
              Réussite PRONEX AI
            </p>
            <p className="font-heading text-3xl font-extrabold tabular-nums">
              {performance && resolved > 0 ? formatRate(performance.global.won, performance.global.lost) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {resolved > 0 ? `Sur ${resolved} pronostic${resolved > 1 ? "s" : ""} terminé${resolved > 1 ? "s" : ""}` : "Aucun résultat pour l'instant"}
            </p>
          </div>
          <nav aria-label="Accès rapide" className="col-span-2 grid grid-cols-3 gap-2">
            {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-white/8 bg-card px-2 py-3 text-center text-xs font-medium text-muted-foreground transition-colors hover:border-pronex-violet/40 hover:text-foreground"
              >
                <Icon className="size-5 text-pronex-pink" aria-hidden />
                {label}
                {href === "/notifications" && unread > 0 ? <span className="sr-only">({unread} non lues)</span> : null}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Prochains matchs analysés" icon={CalendarDaysIcon} href="/matchs" linkLabel="Tous les matchs">
          {upcoming.length === 0 ? (
            <EmptyState title="Aucune analyse disponible dans les 48 prochaines heures." icon={CalendarDaysIcon}>
              Les pronostics apparaissent dès que les prochains matchs sont analysés.
            </EmptyState>
          ) : (
            <div className="-mx-2 divide-y divide-white/5">
              {upcoming.map((fixture) => (
                <FixtureRow key={fixture.id} fixture={fixture} timezone={timezone} hasPrediction showDate />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Mes derniers pronostics" icon={TargetIcon} href="/mes-pronostics">
          {myPredictions.length === 0 ? (
            <EmptyState title="Vous n'avez encore débloqué aucun pronostic." icon={TargetIcon}>
              Ouvrez un match pour découvrir l&apos;analyse de PRONEX AI.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {myPredictions.map((p) => (
                <li key={p.prediction_id}>
                  <Link href={`/matchs/${p.fixture_id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-90">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {p.home_name} – {p.away_name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatShortDate(p.kickoff_at, timezone)} · {p.market_label} : {p.selection_label}
                      </span>
                    </span>
                    <PredictionResultBadge result={p.result} refunded={p.refunded} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Historique récent" icon={HistoryIcon} href="/portefeuille">
          {recentTx.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun mouvement pour le moment.</p>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {recentTx.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{transactionTypeLabel(tx.type)}</span>
                    <span className="block text-xs text-muted-foreground">{formatDateTime(tx.created_at, timezone)}</span>
                  </span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", tx.amount > 0 ? "text-success" : "text-pronex-pink")}>
                    {formatSignedAmount(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Notifications" icon={BellIcon} href="/notifications">
          {recentNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune notification.</p>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {recentNotifications.map((n) => (
                <li key={n.id} className="flex gap-2.5 py-2.5">
                  <span
                    aria-hidden
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-white/15" : "bg-pronex-pink")}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {n.title}
                      {!n.read_at ? <span className="sr-only"> (non lue)</span> : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">{formatDateTime(n.created_at, timezone)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Performances de l'IA" icon={BarChart3Icon} href="/performances" linkLabel="Détails">
          {performance && resolved > 0 ? (
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-muted p-3">
                <dt className="text-xs text-muted-foreground">Gagnés</dt>
                <dd className="font-heading text-xl font-bold text-success tabular-nums">{performance.global.won}</dd>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <dt className="text-xs text-muted-foreground">Perdus</dt>
                <dd className="font-heading text-xl font-bold text-red-400 tabular-nums">{performance.global.lost}</dd>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <dt className="text-xs text-muted-foreground">30 jours</dt>
                <dd className="font-heading text-xl font-bold tabular-nums">
                  {formatRate(performance.last_30_days.won, performance.last_30_days.lost)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Les statistiques apparaîtront après les premiers matchs analysés et terminés. Aucun chiffre n&apos;est inventé.
            </p>
          )}
        </Panel>
      </div>

      {balance !== null && balance <= 0 ? (
        <p className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          Votre solde est vide. <Link href="/recharger?next=/tableau-de-bord" className="font-semibold text-warning underline-offset-4 hover:underline">Achetez des crédits</Link>{" "}
          pour débloquer vos prochains pronostics.
        </p>
      ) : null}
    </main>
  );
}
