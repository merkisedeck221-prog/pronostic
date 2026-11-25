"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusScreen, statusPrimaryCta, statusSecondaryCta } from "@/components/layout/status-screen";

/** Erreur inattendue (500) en français ; le détail reste dans les journaux du serveur. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      code="500"
      title="Une erreur est survenue"
      actions={
        <>
          <button type="button" onClick={() => reset()} className={statusPrimaryCta}>
            Réessayer
          </button>
          <Link href="/" className={statusSecondaryCta}>
            Retour à l&apos;accueil
          </Link>
        </>
      }
    >
      <p>Le service est momentanément indisponible. Aucun crédit n&apos;a été débité. Réessayez dans quelques instants.</p>
      {error.digest ? <p className="text-xs">Référence : {error.digest}</p> : null}
    </StatusScreen>
  );
}
