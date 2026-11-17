import { Skeleton } from "@/components/ui/skeleton";
import { PageSkeleton } from "@/components/matches/skeletons";

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Chargement des compétitions">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </PageSkeleton>
  );
}
