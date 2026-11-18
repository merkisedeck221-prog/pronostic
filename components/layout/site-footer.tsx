import Link from "next/link";

/** Pied de page commun : mention obligatoire (section 11) et liens légaux. */
export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Les pronostics sont des estimations, sans garantie de résultat. Réservé aux 18 ans et plus.</p>
        <nav className="flex gap-4">
          <Link href="/performances" className="underline-offset-4 hover:underline">
            Performances
          </Link>
          <Link href="/cgu" className="underline-offset-4 hover:underline">
            CGU
          </Link>
          <Link href="/jeu-responsable" className="underline-offset-4 hover:underline">
            Jeu responsable
          </Link>
        </nav>
      </div>
    </footer>
  );
}
