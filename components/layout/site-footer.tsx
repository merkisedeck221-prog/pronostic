import Image from "next/image";
import Link from "next/link";

/** Pied de page commun : identité PRONEX, mention obligatoire (section 11) et liens légaux. */
export function SiteFooter() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/brand/pronex-icon.png" alt="" width={32} height={32} className="size-8 opacity-90" />
          <div className="space-y-0.5">
            <p className="font-heading text-sm font-semibold text-foreground italic">Prédisez. Analysez. Dominez.</p>
            <p>Les pronostics sont des estimations, sans garantie de résultat. Réservé aux 18 ans et plus.</p>
          </div>
        </div>
        <nav aria-label="Liens utiles" className="flex gap-4">
          <Link href="/performances" className="transition-colors hover:text-foreground">
            Performances
          </Link>
          <Link href="/cgu" className="transition-colors hover:text-foreground">
            CGU
          </Link>
          <Link href="/jeu-responsable" className="transition-colors hover:text-foreground">
            Jeu responsable
          </Link>
        </nav>
      </div>
    </footer>
  );
}
