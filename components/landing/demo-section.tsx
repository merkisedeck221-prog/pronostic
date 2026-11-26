import { AiDemo } from "@/components/landing/ai-demo";
import { SectionHeading } from "@/components/layout/section-heading";

/** Section « Découvrez la puissance de PRONEX AI » (brief, partie 6) : démonstration locale, sans crédit ni IA réelle. */
export function LandingDemo({ marketCount }: { marketCount: number }) {
  return (
    <section id="analyses" aria-labelledby="demo-titre" className="scroll-mt-16 border-y border-white/5 bg-white/[0.015]">
      <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-16 sm:py-20">
        <SectionHeading
          id="demo-titre"
          eyebrow="PRONEX AI"
          title="Découvrez la puissance de PRONEX AI"
          description="Une intelligence artificielle qui étudie les données disponibles pour produire des analyses structurées de chaque rencontre."
        />
        <AiDemo marketCount={marketCount} />
      </div>
    </section>
  );
}
