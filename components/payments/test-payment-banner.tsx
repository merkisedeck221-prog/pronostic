/** Bandeau affiché partout où le fournisseur simulé est utilisé (RG-F6-3). */
export function TestPaymentBanner() {
  return (
    <div role="note" className="rounded-md border border-dashed p-3 text-sm">
      <p className="font-medium">Paiement de test</p>
      <p className="text-muted-foreground">Aucun argent réel n&apos;est débité : le paiement est simulé.</p>
    </div>
  );
}
