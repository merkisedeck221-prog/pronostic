import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getLandingData } from "@/lib/catalog/landing";
import { PronexLanding } from "@/components/landing-v2/pronex-landing";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, siteUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "PRONEX — Le football analysé par l'intelligence artificielle",
  description:
    "Analyses et pronostics football par PRONEX AI : 13 types de pronostics, probabilités, niveau de confiance et explication pour chaque match. Performances publiques, paiement à l'unité, sans abonnement.",
  alternates: { canonical: "/" },
  // Les métadonnées Open Graph d'une page remplacent celles du site : on les redonne en entier.
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE_NAME,
    url: "/",
    title: "PRONEX — Le football analysé par l'intelligence artificielle",
    description: SITE_DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "PRONEX — Prédisez. Analysez. Dominez." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PRONEX — Le football analysé par l'intelligence artificielle",
    description: SITE_DESCRIPTION,
    images: ["/twitter-image"],
  },
};

function structuredData() {
  const base = siteUrl();
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: base.origin,
      logo: new URL("/brand/pronex-logo.png", base).toString(),
      slogan: SITE_TAGLINE,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: base.origin,
      inLanguage: "fr",
      description: SITE_DESCRIPTION,
    },
  ];
}

export default async function HomePage() {
  // Un utilisateur connecté va directement à son tableau de bord.
  if (await getCurrentUser()) redirect("/tableau-de-bord");
  // Packs, prix et marchés réels (lus en base) : aucune valeur inventée.
  const { markets, packs, pricing } = await getLandingData();

  return (
    <>
      <PronexLanding marketCodes={markets.map((m) => m.code)} packs={packs} pricing={pricing} />
      {/* Données structurées : identité du site, sans note ni avis (aucune donnée inventée). */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }} />
    </>
  );
}
