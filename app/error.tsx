"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

/** Erreur inattendue (500) en français ; le détail reste dans les journaux du serveur. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">Erreur 500</p>
      <h1 className="text-2xl font-semibold tracking-tight">Une erreur est survenue</h1>
      <p className="text-sm text-muted-foreground">
        Le service est momentanément indisponible. Aucun crédit n&apos;a été débité. Réessayez dans quelques instants.
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground">Référence : {error.digest}</p> : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => reset()}>Réessayer</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
