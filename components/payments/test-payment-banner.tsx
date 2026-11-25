import { FlaskConicalIcon } from "lucide-react";

/** Bandeau affiché partout où le fournisseur simulé est utilisé (RG-F6-3). */
export function TestPaymentBanner() {
  return (
    <div role="note" className="flex items-start gap-3 rounded-xl border border-dashed border-pronex-violet/50 bg-pronex-violet/10 p-3 text-sm">
      <FlaskConicalIcon className="mt-0.5 size-4 shrink-0 text-violet-200" aria-hidden />
      <div>
        <p className="font-medium">Paiement de test</p>
        <p className="text-muted-foreground">Aucun argent réel n&apos;est débité : le paiement est simulé.</p>
      </div>
    </div>
  );
}
