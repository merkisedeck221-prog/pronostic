import Link from "next/link";
import type { ReactNode } from "react";
import { HelpCircleIcon, PlusIcon, ShieldAlertIcon } from "lucide-react";
import type { LandingData } from "@/lib/catalog/landing";

/**
 * FAQ de la landing (brief, partie 12) : 10 questions, réponses conformes au
 * fonctionnement réel (marchés, prix et réglages lus en base). Accordéons
 * natifs <details name="faq"> (une seule réponse ouverte à la fois, sans
 * JavaScript) + données structurées FAQPage pour les moteurs de recherche.
 */
type Faq = { q: string; a: string; highlight?: boolean };

export type FaqContext = {
  marketLabels: string[];
  pricing: LandingData["pricing"];
  packs: LandingData["packs"];
  refundOnCancel: boolean;
  revealAfterMatch: boolean;
};

export function faqItems({ marketLabels, pricing, packs, refundOnCancel, revealAfterMatch }: FaqContext): Faq[] {
  const marketCount = marketLabels.length;
  const priceText = pricing
    ? `${pricing.marketMin === pricing.marketMax ? pricing.marketMin : `${pricing.marketMin} ou ${pricing.marketMax}`} crédits selon le type de pronostic${
        pricing.bundle ? `, ou ${pricing.bundle} crédits pour le match complet (moins ce que vous avez déjà payé sur ce match)` : ""
      }`
    : "un nombre de crédits indiqué avant chaque confirmation";
  const packText = packs.length
    ? packs.map((p) => `${p.name} : ${new Intl.NumberFormat("fr-FR").format(p.price_xof)} FCFA pour ${p.credits} crédits`).join(" ; ")
    : "";

  return [
    {
      q: "Qu'est-ce que PRONEX ?",
      a: "PRONEX est une plateforme de pronostics football assistés par intelligence artificielle. Pour chaque match analysé, PRONEX AI propose une sélection, une probabilité estimée, un niveau de confiance et une explication. Ce sont des estimations : elles aident à comprendre une rencontre, elles ne garantissent aucun résultat.",
    },
    {
      q: "Comment fonctionne PRONEX AI ?",
      a: "Pour chaque match, PRONEX AI rassemble les données disponibles (forme récente, classement, confrontations directes, absences signalées, statistiques) puis analyse la rencontre une seule fois. Chaque pronostic est contrôlé automatiquement avant d'être publié : cohérence des probabilités, niveau de confiance abaissé quand les données sont insuffisantes, aucune formulation de certitude.",
    },
    {
      q: "Quels types de pronostics sont disponibles ?",
      a: marketCount
        ? `${marketCount} types de pronostics par match : ${marketLabels.join(", ")}. Le Combiné IA réunit 2 ou 3 sélections d'un même match ; PRONEX ne propose pas de tickets mélangeant plusieurs matchs.`
        : "Plusieurs types de pronostics par match, dont le résultat (1N2), le nombre de buts et le score exact.",
    },
    {
      q: "Comment obtenir des crédits ?",
      a: `Une fois inscrit, vous achetez un pack depuis la page Recharger${packText ? ` (${packText})` : ""}. Chaque pack donne exactement les crédits annoncés, sans abonnement. Les crédits sont ajoutés uniquement après la confirmation du paiement, n'expirent pas, et un reçu est disponible pour chaque achat. Ils ne sont ni remboursables en argent ni convertibles.`,
    },
    {
      q: "Comment débloquer un pronostic ?",
      a: `Ouvrez la fiche d'un match, choisissez un pronostic ou le match complet, puis confirmez. Le prix (${priceText}) est affiché avant la confirmation, avec votre solde avant et après. Les crédits sont débités une seule fois et l'analyse s'affiche aussitôt.`,
    },
    {
      q: "Puis-je consulter mes pronostics achetés ?",
      a: "Oui. La page « Mes pronostics » rassemble tous vos pronostics débloqués, avec leur statut (à venir, gagné, perdu ou annulé), le score final et les crédits dépensés. Votre portefeuille retrace aussi chaque mouvement de crédits et vos reçus.",
    },
    {
      q: "Comment sont calculées les performances ?",
      a: `Après chaque match, les pronostics sont vérifiés automatiquement à partir du score officiel au temps réglementaire : gagné, perdu ou annulé. Le taux de réussite est égal aux gagnés divisés par (gagnés + perdus) ; les annulés en sont exclus. Les résultats publiés sur la page Performances incluent toujours les pronostics perdus.${
        refundOnCancel ? " Si un match est annulé ou reporté de plus de 48 heures, les crédits dépensés sur ce match sont rendus automatiquement." : ""
      }${revealAfterMatch ? " Une fois un match terminé, ses pronostics deviennent visibles par tous." : ""}`,
    },
    {
      q: "PRONEX garantit-il des gains ?",
      a: "Non. Un pronostic de PRONEX AI est une estimation fondée sur des données : il peut être perdu, même avec un niveau de confiance élevé. PRONEX ne garantit aucun gain et ne doit pas être utilisé comme une source de revenus. Ne misez jamais plus que ce que vous pouvez vous permettre de perdre. Réservé aux personnes de 18 ans ou plus.",
      highlight: true,
    },
    {
      q: "Puis-je utiliser PRONEX sur mon smartphone ?",
      a: "Oui. PRONEX est un site web conçu d'abord pour le téléphone : il fonctionne dans le navigateur de votre smartphone, de votre tablette ou de votre ordinateur, sans application à installer.",
    },
    {
      q: "Comment créer un compte ?",
      a: "Cliquez sur « Créer mon compte », puis renseignez un nom d'affichage, votre adresse e-mail, votre pays et un mot de passe (le téléphone est facultatif). Vous confirmez avoir 18 ans ou plus et acceptez les conditions générales. L'inscription est gratuite : vous n'achetez des crédits que si vous le souhaitez.",
    },
  ];
}

export function LandingFaq(context: FaqContext) {
  const items = faqItems(context);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
  };

  return (
    <section id="faq" aria-labelledby="faq-titre" className="scroll-mt-16">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1fr_1.6fr] lg:gap-14">
        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold tracking-[0.2em] text-pronex-pink uppercase">FAQ</p>
          <h2 id="faq-titre" className="font-heading text-2xl font-bold sm:text-3xl">
            Questions fréquentes
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Tout ce qu&apos;il faut savoir avant de commencer : fonctionnement de l&apos;IA, crédits, performances.
          </p>
          <div className="flex gap-3 rounded-2xl border border-warning/30 bg-warning/[0.06] p-4">
            <ShieldAlertIcon className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <p className="text-sm leading-relaxed text-foreground/90">
              Les pronostics de PRONEX AI sont des <strong>estimations</strong>. Ils ne garantissent <strong>aucun gain</strong>.
            </p>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <HelpCircleIcon className="size-4 text-pronex-violet" aria-hidden />
            En savoir plus :{" "}
            <Link href="/jeu-responsable" className="tap-target font-medium text-foreground underline-offset-4 hover:underline">
              jeu responsable
            </Link>{" "}
            ·{" "}
            <Link href="/cgu" className="tap-target font-medium text-foreground underline-offset-4 hover:underline">
              CGU
            </Link>
          </p>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <FaqItem key={item.q} index={index} question={item.q} highlight={item.highlight}>
              {item.a}
            </FaqItem>
          ))}
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </section>
  );
}

function FaqItem({ index, question, highlight, children }: { index: number; question: string; highlight?: boolean; children: ReactNode }) {
  return (
    <details
      name="faq"
      className={
        highlight
          ? "pronex-faq group rounded-2xl border border-warning/30 bg-card transition-colors open:border-warning/50"
          : "pronex-faq group rounded-2xl border border-white/8 bg-card transition-colors open:border-pronex-violet/40 open:bg-pronex-violet/[0.04] hover:border-white/15"
      }
    >
      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="font-heading text-xs font-bold text-white/25 tabular-nums group-open:text-pronex-pink" aria-hidden>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex-1 font-semibold">{question}</span>
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-pronex-pink transition-transform duration-300 group-open:rotate-45 group-open:border-pronex-pink/40 group-open:bg-pronex-pink/10"
        >
          <PlusIcon className="size-4" />
        </span>
      </summary>
      <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:pl-14">{children}</p>
    </details>
  );
}
