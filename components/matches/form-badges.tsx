import { cn } from "@/lib/utils";

const LABELS = { W: { short: "V", long: "Victoire" }, D: { short: "N", long: "Nul" }, L: { short: "D", long: "Défaite" } } as const;

/** 5 pastilles V / N / D (du plus récent au plus ancien). */
export function FormBadges({ results, size = "md" }: { results: ("W" | "D" | "L")[]; size?: "sm" | "md" }) {
  if (results.length === 0) return <p className="text-sm text-muted-foreground">Forme indisponible.</p>;
  return (
    <ol className="flex gap-1" aria-label="Forme récente, du plus récent au plus ancien">
      {results.slice(0, 5).map((result, index) => (
        <li
          key={index}
          title={LABELS[result].long}
          aria-label={LABELS[result].long}
          className={cn(
            "inline-flex items-center justify-center rounded-md border font-semibold",
            size === "sm" ? "size-5 text-[10px]" : "size-7 text-xs",
            result === "W" && "border-success/50 bg-success/15 text-success",
            result === "D" && "border-white/15 bg-white/5 text-muted-foreground",
            result === "L" && "border-destructive/50 bg-destructive/15 text-red-400",
          )}
        >
          {LABELS[result].short}
        </li>
      ))}
    </ol>
  );
}
