import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SegmentedNav } from "@/components/layout/segmented-nav";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { markAllNotificationsReadAction } from "@/lib/notifications/actions";
import { safeNotificationLink } from "@/lib/notifications/links";
import { listNotifications } from "@/lib/notifications/queries";
import { cn } from "@/lib/utils";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Notifications · PRONEX" };

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);
  const onlyUnread = (await searchParams).filtre === "non-lues";
  const all = await listNotifications(user.id);
  const unread = all.filter((n) => !n.read_at).length;
  const notifications = onlyUnread ? all.filter((n) => !n.read_at) : all;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6 sm:py-8">
      <PageHeader
        title="Notifications"
        description="Recharges, remboursements, ajustements et résultats de vos pronostics."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedNav
          label="Filtre"
          items={[
            { href: "/notifications", label: "Toutes", active: !onlyUnread, count: all.length },
            { href: "/notifications?filtre=non-lues", label: "Non lues", active: onlyUnread, count: unread },
          ]}
        />
        {unread > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="outline" size="sm">
              Tout marquer comme lu
            </Button>
          </form>
        ) : null}
      </div>
      <Card>
        <CardContent>
          {notifications.length === 0 ? (
            <EmptyState icon={BellIcon} title={onlyUnread ? "Aucune notification non lue." : "Aucune notification pour le moment."}>
              Vous serez prévenu ici des achats de crédits, remboursements, ajustements et résultats de vos pronostics.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-white/5">
              {notifications.map((n) => {
                const href = safeNotificationLink(n.link);
                return (
                  <li key={n.id} className={cn("relative py-3 pl-5", !n.read_at && "font-medium")}>
                    {!n.read_at ? (
                      <span aria-hidden className="absolute top-[1.15rem] left-0 size-2 rounded-full bg-pronex-pink shadow-[0_0_8px] shadow-pronex-pink" />
                    ) : null}
                    <div className="flex items-start justify-between gap-3">
                      <p>
                        {!n.read_at ? <span className="sr-only">Non lue : </span> : null}
                        {n.title}
                      </p>
                      <time className="shrink-0 text-xs font-normal text-muted-foreground" dateTime={n.created_at}>
                        {formatDateTime(n.created_at, timezone)}
                      </time>
                    </div>
                    <p className="text-sm font-normal text-muted-foreground">{n.body}</p>
                    {href ? (
                      <Link href={href} className="tap-target text-sm font-semibold text-pronex-pink hover:underline">
                        Voir
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
