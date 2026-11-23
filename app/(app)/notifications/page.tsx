import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { markAllNotificationsReadAction } from "@/lib/notifications/actions";
import { safeNotificationLink } from "@/lib/notifications/links";
import { listNotifications } from "@/lib/notifications/queries";
import { cn } from "@/lib/utils";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Notifications · Pronostics IA" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);
  const notifications = await listNotifications(user.id);
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader
        title="Notifications"
        description="Recharges, remboursements, ajustements et résultats de vos pronostics."
      />
      {unread > 0 ? (
        <form action={markAllNotificationsReadAction}>
          <Button type="submit" variant="outline" size="sm">
            Tout marquer comme lu ({unread})
          </Button>
        </form>
      ) : null}
      <Card>
        <CardContent>
          {notifications.length === 0 ? (
            <EmptyState title="Aucune notification pour le moment." />
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => {
                const href = safeNotificationLink(n.link);
                return (
                  <li key={n.id} className={cn("py-3", !n.read_at && "font-medium")}>
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
                      <Link href={href} className="text-sm font-normal underline underline-offset-4">
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
