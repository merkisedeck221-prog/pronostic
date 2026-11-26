import Link from "next/link";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminContent } from "@/components/admin/table-labels";
import { Brand } from "@/components/layout/brand";
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
      <header className="sticky top-0 z-40 border-b border-white/10 bg-pronex-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Brand href="/admin" compact />
            <Link href="/admin" className="rounded-md border border-pronex-violet/40 bg-pronex-violet/15 px-2 py-0.5 text-xs font-semibold tracking-wider text-white uppercase">
              Administration
            </Link>
          </div>
          <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
            <span aria-hidden className="size-2 rounded-full bg-success" />
            {admin.profile.display_name}
          </span>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        <aside className="md:w-56 md:shrink-0">
          <AdminSidebar />
        </aside>
        <AdminContent>{children}</AdminContent>
      </div>
      <SiteFooter />
    </>
  );
}
