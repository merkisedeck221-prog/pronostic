"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Erreur dans une page (étape 7) : l'en-tête, la navigation et le pied de page
 * restent visibles ; message clair, référence technique, bouton « Réessayer ».
 */
export function SegmentError({ error, reset, homeHref, homeLabel }: { error: Error & { digest?: string }; reset: () => void; homeHref: string; homeLabel: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="contenu" className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-warning/15 text-warning">
        <TriangleAlertIcon className="size-6" aria-hidden />
      </span>
      <h1 className="text-2xl font-bold">Cette page n&apos;a pas pu être chargée</h1>
      <p className="text-sm text-muted-foreground">
        Les données sont momentanément indisponibles. Aucun crédit n&apos;a été débité. Réessayez dans quelques instants.
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground">Référence : {error.digest}</p> : null}
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>
          <RefreshCwIcon aria-hidden />
          Réessayer
        </Button>
        <Link href={homeHref} className={buttonVariants({ variant: "outline" })}>
          {homeLabel}
        </Link>
      </div>
    </main>
  );
}
