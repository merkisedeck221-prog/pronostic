import type { ReactNode } from "react";
import {
  BrainCircuitIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  GaugeIcon,
  HistoryIcon,
  LayoutGridIcon,
  SmartphoneIcon,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { cn } from "@/lib/utils";

/**
 * « Pourquoi PRONEX ? » (brief, partie 10) : six avantages réels, chacun
 * illustré par un petit composant d'interface plutôt qu'un long paragraphe.
 * Les illustrations ne portent aucun chiffre de résultat (aucune statistique
 * inventée) ; les valeurs de probabilité sont marquées « exemple ».
 */
export function LandingAdvantages({ marketCount }: { marketCount: number }) {
  const markets = marketCount > 0 ? marketCount : 13;
  return (
    <section id="avantages" aria-labelledby="avantages-titre" className="scroll-mt-16">
      <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-16 sm:py-20">
        <SectionHeading id="avantages-titre" eyebrow="Pourquoi PRONEX ?" title="Tout ce qu'il faut, rien de superflu" />

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card index={0} icon={BrainCircuitIcon} title="Analyse assistée par IA" text="Les données disponibles sont étudiées pour produire des analyses structurées." wide>
            <div className="flex flex-wrap items-center gap-2">
              {["Forme", "Classement", "Confrontations", "Absences", "Statistiques"].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-muted-foreground">
                  {item}
                </span>
              ))}
              <span aria-hidden className="h-px w-6 bg-linear-to-r from-white/20 to-pronex-pink" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-pronex-pink/15 px-2.5 py-1 text-[11px] font-semibold text-pronex-pink">
                <BrainCircuitIcon className="size-3" aria-hidden />
                Analyse PRONEX AI
              </span>
            </div>
          </Card>

          <Card index={1} icon={LayoutGridIcon} title="Plusieurs marchés football" text={`${markets} types de pronostics sont disponibles sur chaque match.`}>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-semibold">
              {["1N2", "BTTS", "Score exact", "Corners", "Mi-temps"].map((m) => (
                <span key={m} className="flex items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] px-1 py-1.5 leading-tight text-muted-foreground">
                  {m}
                </span>
              ))}
              <span className="flex items-center justify-center rounded-lg bg-pronex-violet/20 px-1 py-1.5 text-violet-100">+{Math.max(0, markets - 5)}</span>
            </div>
          </Card>

          <Card index={2} icon={GaugeIcon} title="Probabilités et confiance" text="Chaque analyse présente une estimation et un niveau de confiance.">
            <div className="space-y-2 rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Probabilité estimée (exemple)</span>
                <span className="font-heading font-bold tabular-nums">52 %</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <div className="h-full w-[52%] rounded-full bg-pronex-pink" />
              </div>
              <div className="flex gap-1.5 pt-1 text-[11px] font-semibold">
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-muted-foreground">Faible</span>
                <span className="rounded-full bg-pronex-violet/25 px-2 py-0.5 text-violet-100">Moyen</span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-muted-foreground">Élevé</span>
              </div>
            </div>
          </Card>

          <Card index={3} icon={EyeIcon} title="Transparence des performances" text="Les résultats sont consultables à partir des données réellement enregistrées, pronostics perdus compris." wide>
            <div className="flex items-end gap-3">
              <div aria-hidden className="flex h-16 flex-1 items-end gap-1 lg:gap-1.5">
                {[60, 85, 45, 70, 90, 55, 75, 65, 95, 50, 80, 70].map((h, i) => (
                  <div key={i} className={cn("flex flex-1 flex-col gap-[2px]", i >= 7 && "hidden lg:flex")} style={{ height: `${h}%` }}>
                    <div className="rounded-[3px] bg-[#f87171]/70" style={{ flexGrow: 1 }} />
                    <div className="rounded-[3px] bg-[#4ade80]/80" style={{ flexGrow: 2 }} />
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#4ade80]" /> Gagnés
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#f87171]" /> Perdus
                </p>
              </div>
            </div>
          </Card>

          <Card index={4} icon={SmartphoneIcon} title="Interface moderne" text="Une expérience simple et fluide, sur mobile comme sur ordinateur.">
            <div aria-hidden className="flex items-end justify-center gap-3">
              <div className="flex h-16 w-28 flex-col rounded-lg border border-white/15 bg-pronex-night p-1.5">
                <div className="h-1.5 w-10 rounded-full bg-pronex-pink/70" />
                <div className="mt-1.5 grid flex-1 grid-cols-3 gap-1">
                  <div className="rounded-sm bg-white/8" />
                  <div className="rounded-sm bg-white/8" />
                  <div className="rounded-sm bg-pronex-violet/30" />
                </div>
              </div>
              <div className="flex h-20 w-11 flex-col rounded-xl border border-white/15 bg-pronex-night p-1">
                <div className="h-1 w-5 rounded-full bg-pronex-pink/70" />
                <div className="mt-1 flex-1 space-y-1">
                  <div className="h-3 rounded-sm bg-white/8" />
                  <div className="h-3 rounded-sm bg-pronex-violet/30" />
                  <div className="h-3 rounded-sm bg-white/8" />
                </div>
              </div>
            </div>
          </Card>

          <Card index={5} icon={HistoryIcon} title="Historique personnel" text="Retrouvez tous les pronostics que vous avez débloqués, avec leur statut." wide>
            <ul className="space-y-1.5">
              {[
                { market: "Résultat du match", status: "Gagné", tone: "won" as const },
                { market: "Les deux équipes marquent", status: "En attente", tone: "pending" as const },
              ].map((row) => (
                <li key={row.market} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="min-w-0 leading-snug">{row.market}</span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      row.tone === "won" ? "bg-success/15 text-success" : "bg-white/8 text-muted-foreground",
                    )}
                  >
                    {row.tone === "won" ? <CheckIcon className="size-3" aria-hidden /> : <ClockIcon className="size-3" aria-hidden />}
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </ul>
      </div>
    </section>
  );
}

function Card({
  index,
  icon: Icon,
  title,
  text,
  wide = false,
  children,
}: {
  index: number;
  icon: LucideIcon;
  title: string;
  text: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <li className={cn(wide && "lg:col-span-2")}>
      <Reveal delay={(index % 3) * 100} className="h-full">
        <div className="pronex-lift group flex h-full flex-col gap-5 rounded-3xl border border-white/8 bg-card p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pronex-violet/15 text-violet-200 transition-colors duration-200 group-hover:bg-pronex-pink/15 group-hover:text-pronex-pink">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-heading text-base font-bold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </div>
          <div className="mt-auto rounded-2xl border border-white/[0.06] bg-pronex-night/60 p-4">{children}</div>
        </div>
      </Reveal>
    </li>
  );
}
