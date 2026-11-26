import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-w-0 flex-1 space-y-4" aria-busy="true">
      <span className="sr-only">Chargement…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
