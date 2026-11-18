import Link from "next/link";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { requireAdmin } from "@/lib/auth/session";

/**
 * Back-office. Rôle admin vérifié CÔTÉ SERVEUR par la fonction SQL is_admin()
 * à chaque requête (et de nouveau dans chaque page et chaque Server Action).
 * Visiteur, utilisateur ou admin suspendu : 404.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();

  return (
    <>
      <header className="border-b bg-muted/40">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-semibold tracking-tight">
            Pronostics IA · Administration
          </Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">{admin.profile.display_name}</span>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        <aside className="md:w-52 md:shrink-0">
          <AdminSidebar />
        </aside>
        {children}
      </div>
      <SiteFooter />
    </>
  );
}
