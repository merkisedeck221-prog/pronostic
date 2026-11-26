"use client";

import { SegmentError } from "@/components/layout/segment-error";

/** Erreur d'une page de cet espace : la mise en page (en-tête, navigation) reste affichée. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <SegmentError error={error} reset={reset} homeHref="/" homeLabel="Accueil" />;
}
