import { LockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { confidenceLabel } from "@/lib/credits/labels";
import type { FixturePredictions, MarketView } from "@/lib/credits/schemas";
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

/** Badge de résultat une fois le pronostic résolu (Gagné, Perdu, Annulé). */
function ResultBadge({ result }: { result: MarketView["result"] }) {
  if (!result || result === "pending") return null;
  return <Badge variant={result === "won" ? "default" : result === "lost" ? "destructive" : "outline"}>{RESULT_LABELS[result]}</Badge>;
}

function ProbabilityBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value} %</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function RevealedContent({ market, homeName, awayName }: { market: MarketView; homeName: string; awayName: string }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-base font-semibold">{market.selection_label}</p>
        {market.confidence ? <Badge variant="secondary">Confiance : {confidenceLabel(market.confidence)}</Badge> : null}
        <ResultBadge result={market.result} />
      </div>
      {market.code === "MATCH_RESULT" && market.probabilities ? (
        <div className="space-y-2">
          <ProbabilityBar label={`Victoire ${homeName}`} value={market.probabilities.home} />
          <ProbabilityBar label="Match nul" value={market.probabilities.draw} />
          <ProbabilityBar label={`Victoire ${awayName}`} value={market.probabilities.away} />
        </div>
      ) : market.probability !== undefined ? (
        <ProbabilityBar label="Probabilité estimée" value={market.probability} />
      ) : null}
      {market.reasoning ? <p className="text-sm text-muted-foreground">{market.reasoning}</p> : null}
    </div>
  );
}

export function PredictionsBlock({ fixtureId, homeName, awayName, data, balance, upcoming }: Props) {
  const bundle = data.match_bundle;
  const showBundle = bundle.offered && !bundle.unlocked && bundle.price !== null && data.markets.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pronostics IA</CardTitle>
        <CardDescription>
          {bundle.unlocked
            ? "Vous avez débloqué le match complet."
            : data.is_finished
              ? "Match terminé : les pronostics sont visibles par tous."
              : "Débloquez un pronostic ou le match complet avec vos crédits."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!data.unlocks_open ? (
          <p className="rounded-md border p-3 text-sm text-muted-foreground">
            {upcoming
              ? "Les déblocages sont momentanément suspendus. Réessayez plus tard."
              : "Les déblocages sont fermés pour ce match."}
          </p>
        ) : null}

        {showBundle && bundle.purchasable && bundle.price !== null ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div className="text-sm">
              <p className="font-medium">Match complet : tous les pronostics et l&apos;analyse</p>
              <p className="text-muted-foreground">
                {formatCredits(bundle.price)}
                {bundle.base_price !== null && bundle.base_price > bundle.price
                  ? ` (au lieu de ${formatCredits(bundle.base_price)}, déjà payé déduit)`
                  : ""}
              </p>
            </div>
            <UnlockButton
              fixtureId={fixtureId}
              marketCode={null}
              label="le match complet"
              price={bundle.price}
              balance={balance}
              buttonLabel={`Débloquer le match complet (${formatCredits(bundle.price)})`}
            />
          </div>
        ) : null}

        <div className="grid gap-3">
          {data.markets.map((market) => (
            <div key={market.code} className="space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  {!market.revealed ? <LockIcon className="size-4" aria-label="Verrouillé" /> : null}
                  {market.label}
                </h3>
                {!market.revealed && market.result && market.result !== "pending" ? (
                  <ResultBadge result={market.result} />
                ) : market.unlocked ? (
                  <Badge variant="outline">Débloqué</Badge>
                ) : !market.revealed && market.price !== null ? (
                  <span className="text-sm tabular-nums text-muted-foreground">{formatCredits(market.price)}</span>
                ) : null}
              </div>
              {market.revealed ? (
                <RevealedContent market={market} homeName={homeName} awayName={awayName} />
              ) : market.purchasable && market.price !== null ? (
                <UnlockButton
                  fixtureId={fixtureId}
                  marketCode={market.code}
                  label={market.label}
                  price={market.price}
                  balance={balance}
                  buttonLabel="Débloquer"
                  variant="outline"
                />
              ) : null}
            </div>
          ))}
        </div>

        {data.analysis ? (
          <div className="space-y-2 rounded-md border p-4">
            <h3 className="text-sm font-medium">Analyse du match</h3>
            <p className="text-sm text-muted-foreground">{data.analysis.summary}</p>
            {data.analysis.key_factors.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {data.analysis.key_factors.map((factor) => (
                  <li key={factor}>{factor}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
