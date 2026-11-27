import Link from "next/link";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminContent } from "@/components/admin/table-labels";
import { Brand } from "@/components/layout/brand";
import { DesignScope } from "@/components/layout/design-scope";
import { requireAdmin } from "@/lib/auth/session";

/**
 * Back-office. Rôle admin vérifié CÔTÉ SERVEUR par la fonction SQL is_admin()
 * à chaque requête (et de nouveau dans chaque page et chaque Server Action).
 * Visiteur, utilisateur ou admin suspendu : 404.
 * Design PRONEX (zone `.pxa`, 27/11/2026) : en-tête en pilule bleu nuit,
 * barre latérale en carte blanche, comme la landing et l'espace utilisateur.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();

  return (
    <div className="pxa flex min-h-full flex-1 flex-col">
      <DesignScope />
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="pxa-dark mx-auto flex h-[58px] w-full max-w-7xl items-center justify-between gap-3 rounded-[30px] bg-[#042644]/95 pr-2 pl-4 shadow-[0_18px_40px_-24px_rgb(4_38_68/0.7)] backdrop-blur-md sm:pl-5">
          <div className="flex min-w-0 items-center gap-3">
            <Brand href="/admin" compact className="text-[#fff]" />
            <Link href="/admin" className="flex h-8 items-center rounded-full bg-[#c9f13e] px-3 text-xs font-semibold tracking-wider text-[#000] uppercase">
              Administration
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 text-sm text-[#fff]/80 sm:flex">
              <span aria-hidden className="size-2 rounded-full bg-[#c9f13e]" />
              {admin.profile.display_name}
            </span>
            <Link
              href="/tableau-de-bord"
              className="flex h-[42px] items-center rounded-full bg-[#fff] px-4 text-sm font-medium text-[#000] transition-colors hover:bg-[#c9f13e]"
            >
              <span className="sm:hidden">Application</span>
              <span className="hidden sm:inline">Retour à l&apos;application</span>
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        <aside className="md:w-60 md:shrink-0">
          <AdminSidebar />
        </aside>
        <AdminContent>{children}</AdminContent>
      </div>
    </div>
  );
}
