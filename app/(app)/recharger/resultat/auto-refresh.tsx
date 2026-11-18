"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Recharge en attente : rafraîchit la page toutes les 3 s pendant 30 s au plus. */
export function AutoRefresh({ intervalMs = 3000, maxMs = 30_000 }: { intervalMs?: number; maxMs?: number }) {
  const router = useRouter();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started >= maxMs) {
        clearInterval(timer);
        setExpired(true);
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs, maxMs]);

  return expired ? (
    <p className="text-sm text-muted-foreground">
      Le paiement est toujours en attente de confirmation. Rechargez cette page dans quelques instants ou consultez votre
      portefeuille.
    </p>
  ) : (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      Vérification du paiement en cours…
    </p>
  );
}
