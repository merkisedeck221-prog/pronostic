import Image from "next/image";
import Link from "next/link";

const COLUMNS = [
  {
    title: "Plateforme",
    links: [
      { href: "/matchs", label: "Matchs" },
      { href: "/performances", label: "Performances de l'IA" },
      { href: "/recharger", label: "Acheter des crédits" },
    ],
  },
  {
    title: "Compte",
    links: [
      { href: "/connexion", label: "Connexion" },
      { href: "/inscription", label: "Inscription" },
      { href: "/mot-de-passe-oublie", label: "Mot de passe oublié" },
    ],
  },
  {
    title: "Informations",
    links: [
      { href: "/cgu", label: "Conditions générales" },
      { href: "/jeu-responsable", label: "Jeu responsable" },
    ],
  },
] as const;

/** Pied de page commun : identité PRONEX, liens, mention obligatoire (section 11 : 18+, sans garantie). */
export function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-black/10">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 text-sm lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="col-span-2 space-y-3 lg:col-span-1">
          <Image src="/brand/pronex-symbol.webp" alt="PRONEX" width={240} height={113} className="h-8 w-auto" />
          <p className="font-heading font-semibold italic">Prédisez. Analysez. Dominez.</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Analyses et pronostics football par intelligence artificielle. Les pronostics sont des estimations, sans garantie de
            résultat.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="space-y-3">
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">{column.title}</p>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} PRONEX</p>
          <p className="flex items-center gap-2">
            <span className="rounded-md border border-white/15 px-1.5 py-0.5 font-semibold text-foreground">18+</span>
            Réservé aux personnes majeures. Jouez de façon responsable.
          </p>
        </div>
      </div>
    </footer>
  );
}
