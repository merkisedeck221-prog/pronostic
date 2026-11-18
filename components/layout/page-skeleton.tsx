import { Skeleton } from "@/components/ui/skeleton";

/** État de chargement générique : titre, blocs et lignes. */
export function PageSkeleton({ rows = 6, wide = false }: { rows?: number; wide?: boolean }) {
  return (
    <div className={`mx-auto w-full ${wide ? "max-w-5xl" : "max-w-3xl"} flex-1 space-y-6 px-4 py-8`} aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-28 w-full" />
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
