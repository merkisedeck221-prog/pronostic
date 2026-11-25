import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { SiteFooter } from "@/components/layout/site-footer";
import { buttonVariants } from "@/components/ui/button";

/** Pages accessibles sans compte. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-pronex-night/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <Brand href="/" compact />
          <nav aria-label="Compte" className="flex items-center gap-2 text-sm">
            <Link href="/connexion" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Se connecter
            </Link>
            <Link
              href="/inscription"
              className="rounded-lg bg-linear-to-r from-pronex-pink/85 to-pronex-violet px-3 py-1.5 font-semibold text-white transition hover:brightness-110"
            >
              S&apos;inscrire
            </Link>
          </nav>
        </div>
      </header>
      <div id="contenu" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </div>
      <SiteFooter />
    </>
  );
}
