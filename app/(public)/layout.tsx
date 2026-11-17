import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";

/** Pages accessibles sans compte. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            Pronostics IA
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/connexion" className="underline-offset-4 hover:underline">
              Se connecter
            </Link>
            <Link href="/inscription" className="underline-offset-4 hover:underline">
              S&apos;inscrire
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </>
  );
}
