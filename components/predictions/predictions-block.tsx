import { LockIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RESULT_BADGE_CLASSES } from "@/components/settle/result-badge";
import { confidenceLabel } from "@/lib/credits/labels";
import type { FixturePredictions, MarketView } from "@/lib/credits/schemas";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/utils/format";
import { UnlockButton } from "./unlock-button";

type Props = {
  fixtureId: number;
  homeName: string;
  awayName: string;
  data: FixturePredictions;
  balance: number;
  /** Match pas encore commencé (pour distinguer « fermé » de « suspendu »). */
  upcoming: boolean;
};

const RESULT_LABELS = { won: "Gagné", lost: "Perdu", void: "Annulé" } as const;

const CONFIDENCE_CLASSES: Record<string, string> = {
  low: "border-white/15 bg-white/5 text-muted-foreground",
  medium: "border-pronex-violet/40 bg-pronex-violet/15 text-violet-200",
  high: "border-pronex-pink/40 bg-pronex-pink/15 text-pink-200",
};

/** Badge de résultat une fois le pronostic résolu (Gagné, Perdu, Annulé). */
function ResultBadge({ result }: { result: MarketView["result"] }) {
  if (!result || result === "pending") return null;
  return (
    <Badge variant="outline" className={RESULT_BADGE_CLASSES[result]}>
      {RESULT_LABELS[result]}
    </Badge>
  );
}

function ProbabilityBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold text-foreground tabular-nums">{value} %</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10" role="presentation">
        <div
          className="h-full rounded-full bg-pronex-violet"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function RevealedContent({ market, homeName, awayName }: { market: MarketView; homeName: string; awayName: string }) {
  return (
    <div className="space-y-4">
      <p className="font-heading text-lg leading-snug font-bold">{market.selection_label}</p>
      {market.confidence ? (
        <Badge variant="outline" className={CONFIDENCE_CLASSES[market.confidence]}>
          Confiance : {confidenceLabel(market.confidence)}
        </Badge>
      ) : null}
      {market.code === "MATCH_RESULT" && market.probabilities ? (
        <div className="space-y-2">
          <ProbabilityBar label={`Victoire ${homeName}`} value={market.probabilities.home} />
          <ProbabilityBar label="Match nul" value={market.probabilities.draw} />
          <ProbabilityBar label={`Victoire ${awayName}`} value={market.probabilities.away} />
        </div>
      ) : market.code === "HT_RESULT" && market.probabilities ? (
        <div className="space-y-2">
          <ProbabilityBar label={`${homeName} mène à la pause`} value={market.probabilities.home} />
          <ProbabilityBar label="Égalité à la pause" value={market.probabilities.draw} />
          <ProbabilityBar label={`${awayName} mène à la pause`} value={market.probabilities.away} />
        </div>
      ) : market.probability !== undefined ? (
        <ProbabilityBar label="Probabilité estimée par l'IA" value={market.probability} />
      ) : null}
      {market.reasoning ? <p className="text-sm leading-relaxed text-muted-foreground">{market.reasoning}</p> : null}
    </div>
  );
}

/** Aperçu décoratif d'une carte verrouillée : formes floues, AUCUNE donnée du pronostic. */
function LockedPreview() {
  return (
    <div aria-hidden className="space-y-2 blur-[3px] select-none">
      <div className="h-4 w-2/3 rounded bg-white/15" />
      <div className="h-2 w-full rounded-full bg-linear-to-r from-pronex-pink/40 to-pronex-violet/40" />
      <div className="h-2 w-5/6 rounded bg-white/10" />
      <div className="h-2 w-3/5 rounded bg-white/10" />
    </div>
  );
}

const unlockClasses = "h-10 w-full";

export function PredictionsBlock({ fixtureId, homeName, awayName, data, balance, upcoming }: Props) {
  const bundle = data.match_bundle;
  const showBundle = bundle.offered && !bundle.unlocked && bundle.price !== null && data.markets.length > 0;

  return (
    <section aria-labelledby="pronex-ai" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <h2 id="pronex-ai" className="flex items-center gap-2 text-xl font-bold">
            <SparklesIcon className="size-5 text-pronex-pink" aria-hidden />
            Pronostics IA
          </h2>
          <p className="text-sm text-muted-foreground">
            {bundle.unlocked
              ? "Vous avez débloqué le match complet."
              : data.is_finished
                ? "Match terminé : les pronostics sont visibles par tous."
                : "Analyses PRONEX AI : débloquez un pronostic ou le match complet avec vos crédits."}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{data.markets.length} pronostics</span>
      </div>

      {!data.unlocks_open ? (
        <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-muted-foreground">
          {upcoming ? "Les déblocages sont momentanément suspendus. Réessayez plus tard." : "Les déblocages sont fermés pour ce match."}
        </p>
      ) : null}

      {showBundle && bundle.purchasable && bundle.price !== null ? (
        <div className="rounded-2xl bg-linear-to-r from-pronex-pink/60 to-pronex-violet/60 p-px">
          <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-heading text-lg font-bold">Match complet</p>
              <p className="text-sm text-muted-foreground">Les {data.markets.length} pronostics et l&apos;analyse du match.</p>
              <p className="text-sm">
                <span className="font-semibold tabular-nums">{formatCredits(bundle.price)}</span>
                {bundle.base_price !== null && bundle.base_price > bundle.price ? (
                  <span className="text-muted-foreground"> (au lieu de {formatCredits(bundle.base_price)}, déjà payé déduit)</span>
                ) : null}
              </p>
            </div>
            <UnlockButton
              fixtureId={fixtureId}
              marketCode={null}
              label="le match complet"
              price={bundle.price}
              balance={balance}
              buttonLabel={`Débloquer le match complet (${formatCredits(bundle.price)})`}
              variant="hero"
              className="h-11 px-5"
            />
          </div>
        </div>
      ) : null}

      <div className="pronex-stagger grid gap-3 sm:grid-cols-2">
        {data.markets.map((market) => (
          <article
            key={market.code}
            className={cn(
              "flex flex-col gap-4 rounded-2xl border bg-card p-5",
              market.revealed ? "border-pronex-violet/30" : "border-white/8",
            )}
          >
            <header className="flex items-start justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {!market.revealed ? <LockIcon className="size-4 text-pronex-pink" aria-label="Verrouillé" /> : null}
                {market.label}
              </h3>
              {market.result && market.result !== "pending" ? (
                <ResultBadge result={market.result} />
              ) : market.unlocked ? (
                <Badge variant="outline" className="border-success/40 text-success">
                  Débloqué
                </Badge>
              ) : !market.revealed && market.price !== null ? (
                <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-semibold tabular-nums">{formatCredits(market.price)}</span>
              ) : null}
            </header>
            {market.revealed ? (
              <RevealedContent market={market} homeName={homeName} awayName={awayName} />
            ) : (
              <>
                <LockedPreview />
                {market.purchasable && market.price !== null ? (
                  <UnlockButton
                    fixtureId={fixtureId}
                    marketCode={market.code}
                    label={market.label}
                    price={market.price}
                    balance={balance}
                    buttonLabel={`Débloquer · ${formatCredits(market.price)}`}
                    className={unlockClasses}
                  />
                ) : null}
              </>
            )}
          </article>
        ))}
      </div>

      {data.analysis ? (
        <div className="space-y-3 rounded-2xl border border-pronex-violet/30 bg-linear-to-br from-pronex-violet/10 to-transparent p-5">
          <h3 className="flex items-center gap-2 font-heading text-lg font-bold">
            <SparklesIcon className="size-4 text-pronex-violet" aria-hidden />
            Analyse du match
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{data.analysis.summary}</p>
          {data.analysis.key_factors.length > 0 ? (
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {data.analysis.key_factors.map((factor) => (
                <li key={factor} className="flex gap-2">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-pronex-pink" />
                  {factor}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
