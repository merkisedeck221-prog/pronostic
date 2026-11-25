import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/app-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signOutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { countUnreadNotifications } from "@/lib/notifications/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Espace connecté. Vérifications CÔTÉ SERVEUR à chaque requête :
 *  - pas de session  → /connexion?next=<page demandée> ;
 *  - compte suspendu → message, aucune page de l'espace n'est affichée (RG-F1-2).
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser({ allowBanned: true });

  if (user.profile.is_banned) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-xl font-semibold">Compte suspendu</h1>
            </CardTitle>
            <CardDescription>
              Votre compte a été suspendu. Vous ne pouvez plus accéder à l&apos;espace membre ni débloquer de
              pronostic. Pour toute question, contactez le support.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signOutAction}>
              <Button type="submit" variant="outline">
                Se déconnecter
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  const supabase = await createClient();
  const [{ data: wallet }, { data: isAdmin }, unreadCount] = await Promise.all([
    supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("is_admin"),
    countUnreadNotifications(user.id),
  ]);

  return (
    <>
      <AppHeader
        displayName={user.profile.display_name}
        balance={wallet?.balance ?? null}
        isAdmin={isAdmin === true}
        unreadCount={unreadCount}
      />
      <div className="flex flex-1 flex-col">{children}</div>
      {/* Espace réservé à la barre de navigation mobile (fixe en bas). */}
      <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <SiteFooter />
      </div>
      <BottomNav />
    </>
  );
}
