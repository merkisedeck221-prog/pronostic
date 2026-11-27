import { PronexMark } from "@/components/layout/pronex-mark";
import Link from "next/link";
import { ArrowUpIcon, ShieldAlertIcon } from "lucide-react";

type FooterLink = { href: string; label: string };
type Column = { title: string; links: readonly FooterLink[] };

/** Sections de la landing (pages publiques : la landing n'est visible que sans être connecté). */
const DISCOVER: Column = {
  title: "Découvrir",
  links: [
    { href: "/#fonctionnement", label: "Fonctionnement" },
    { href: "/#pronostics", label: "Types de pronostics" },
    { href: "/#tarifs", label: "Tarifs" },
    { href: "/#faq", label: "FAQ" },
  ],
};

/** Pages de l'application (utilisateur connecté). */
const PLATFORM: Column = {
  title: "Plateforme",
  links: [
    { href: "/matchs", label: "Matchs" },
    { href: "/mes-pronostics", label: "Mes pronostics" },
    { href: "/portefeuille", label: "Portefeuille" },
    { href: "/recharger", label: "Acheter des crédits" },
  ],
};

const RESULTS: Column = {
  title: "Résultats",
  links: [{ href: "/performances", label: "Performances de PRONEX AI" }],
};

const ACCOUNT: Column = {
  title: "Compte",
  links: [
    { href: "/connexion", label: "Connexion" },
    { href: "/inscription", label: "Créer un compte" },
    { href: "/mot-de-passe-oublie", label: "Mot de passe oublié" },
  ],
};

/**
 * Pages légales EXISTANTES uniquement. Pas de politique de confidentialité, de
 * contact officiel ni de réseaux sociaux tant qu'ils n'existent pas : rien n'est
 * inventé (brief, partie 14).
 */
const LEGAL: Column = {
  title: "Informations",
  links: [
    { href: "/cgu", label: "Conditions générales" },
    { href: "/jeu-responsable", label: "Jeu responsable" },
  ],
};

/**
 * Pied de page PRONEX : logo, slogan, présentation, navigation, mentions
 * légales, rappel 18+ / sans garantie (section 11), copyright à l'année en cours.
 * `variant="public"` : liens vers les sections de la landing ; `"app"` : pages
 * de l'application.
 */
export function SiteFooter({
  variant = "app",
}: {
  variant?: "public" | "app";
}) {
  const columns =
    variant === "public"
      ? [
          DISCOVER,
          {
            title: "Accès rapide",
            links: [...RESULTS.links, ...ACCOUNT.links],
          },
          LEGAL,
        ]
      : [PLATFORM, RESULTS, LEGAL];
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#c9f13e] text-[#000] [--muted-foreground:rgb(0_0_0/68%)]">
      <div className="mx-auto w-full max-w-[1140px] px-4 pt-6">
        <Link href="/" aria-label="PRONEX, accueil" className="flex items-center gap-4 sm:gap-8">
          <PronexMark body="#000" ball="#000" accent="#c9f13e" className="h-[18vw] w-auto max-h-36" />
          <span className="text-[22vw] leading-[0.85] font-medium tracking-[-0.05em] lg:text-[200px]">PRONEX</span>
        </Link>
        <div className="grid gap-8 pt-10 pb-12 lg:grid-cols-[1.4fr_2fr]">
          <div className="space-y-4">
            <p className="max-w-sm text-[17px] leading-relaxed">
              Plateforme de pronostics football assistés par intelligence
              artificielle&nbsp;: analyses match par match, probabilités, niveaux
              de confiance et résultats publiés en toute transparence.
            </p>
            <p className="flex max-w-sm items-start gap-3 text-sm leading-relaxed text-[#000]/75">
              <span className="flex h-7 shrink-0 items-center rounded-lg border border-[#000]/30 px-2 text-xs font-bold text-[#000]">18+</span>
              Réservé aux personnes majeures. Les pronostics sont des estimations,
              sans garantie de gain. Jouez de façon responsable.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title} className="space-y-3">
                <p className="text-xs font-semibold tracking-[0.2em] text-[#000]/70 uppercase">{column.title}</p>
                <ul className="space-y-1">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="tap-target text-[17px] font-medium text-[#000] underline-offset-4 hover:underline">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-[#000] text-[#fff]">
        <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-2 px-4 py-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} PRONEX. Tous droits réservés.</p>
          <p className="flex items-center gap-1.5 text-[#fff]/80">
            <ShieldAlertIcon className="size-3.5 text-[#c9f13e]" aria-hidden />
            Pronostics à titre informatif&nbsp;: aucun gain n&apos;est garanti.
          </p>
          <a href="#" className="tap-target inline-flex items-center gap-1.5 text-[#fff]/80 hover:text-[#fff]">
            <ArrowUpIcon className="size-3.5" aria-hidden />
            Haut de page
          </a>
        </div>
      </div>
    </footer>
  );
}
