import Image from "next/image";
import Link from "next/link";
import { ArrowUpIcon, ShieldAlertIcon } from "lucide-react";

type FooterLink = { href: string; label: string };
type Column = { title: string; links: readonly FooterLink[] };

/** Sections de la landing (pages publiques : la landing n'est visible que sans être connecté). */
const DISCOVER: Column = {
  title: "Découvrir",
  links: [
    { href: "/#fonctionnement", label: "Fonctionnement" },
    { href: "/#analyses", label: "Analyses IA" },
    { href: "/#types-pronostics", label: "Types de pronostics" },
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
    <footer className="relative border-t border-white/8 bg-[#06081a]">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-pronex-pink/60 to-transparent"
      />
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-14 pb-10 lg:grid-cols-[1.5fr_2fr]">
        <div className="space-y-5">
          <Link
            href="/"
            aria-label="PRONEX, accueil"
            className="inline-flex min-h-11 items-center gap-3"
          >
            <Image
              src="/brand/pronex-symbol.webp"
              alt=""
              width={240}
              height={113}
              className="h-9 w-auto"
            />
            <Image
              src="/brand/pronex-wordmark.webp"
              alt="PRONEX"
              width={995}
              height={138}
              className="h-5 w-auto"
            />
          </Link>
          <p className="font-heading text-lg font-bold italic">
            Prédisez. <span className="text-pronex-pink">Analysez.</span>{" "}
            Dominez.
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Plateforme de pronostics football assistés par intelligence
            artificielle : analyses match par match, probabilités, niveaux de
            confiance et résultats publiés en toute transparence.
          </p>
          <div className="flex max-w-sm gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3.5">
            <span className="flex h-7 shrink-0 items-center rounded-lg border border-white/20 px-2 text-xs font-bold text-foreground">
              18+
            </span>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Réservé aux personnes majeures. Les pronostics sont des
              estimations, sans garantie de gain. Jouez de façon responsable.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
          {columns.map((column) => (
            <nav
              key={column.title}
              aria-label={column.title}
              className="space-y-4"
            >
              <p className="text-xs font-semibold tracking-[0.2em] text-foreground/80 uppercase">
                {column.title}
              </p>
              <ul className="space-y-1">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="tap-target text-sm text-muted-foreground transition-colors hover:text-pronex-pink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} PRONEX. Tous droits réservés.</p>
          <p className="flex items-center gap-1.5">
            <ShieldAlertIcon className="size-3.5 text-warning" aria-hidden />
            Pronostics à titre informatif : aucun gain n&apos;est garanti.
          </p>
          <a
            href="#"
            className="tap-target inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <ArrowUpIcon className="size-3.5" aria-hidden />
            Haut de page
          </a>
        </div>
      </div>
    </footer>
  );
}
