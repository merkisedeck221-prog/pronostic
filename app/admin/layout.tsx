import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { requireAdmin } from "@/lib/auth/session";

/**
 * Back-office. Rôle admin vérifié CÔTÉ SERVEUR par la fonction SQL is_admin()
 * à chaque requête. Visiteur, utilisateur ou admin suspendu : 404.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();

  return (
    <>
      <header className="border-b bg-muted/40">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-semibold tracking-tight">
            Pronostics IA · Administration
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{admin.profile.display_name}</span>
            <Link href="/tableau-de-bord" className="underline-offset-4 hover:underline">
              Retour à l&apos;application
            </Link>
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </>
  );
}
