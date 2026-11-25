import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page introuvable · PRONEX" };

/** 404 en français (pages inexistantes, matchs non publiés, accès admin refusé). */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">Erreur 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="text-sm text-muted-foreground">Cette page n&apos;existe pas ou n&apos;est plus disponible.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/" className={buttonVariants()}>
          Retour à l&apos;accueil
        </Link>
        <Link href="/matchs" className={buttonVariants({ variant: "outline" })}>
          Voir les matchs
        </Link>
      </div>
    </main>
  );
}
