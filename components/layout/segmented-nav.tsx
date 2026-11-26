import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Onglets en pastilles (design system PRONEX) : liens d'URL, l'actif en
 * surface claire. Défile horizontalement sur mobile sans couper le texte.
 */
export function SegmentedNav({
  label,
  items,
  className,
}: {
  label: string;
  items: { href: string; label: string; active: boolean; count?: number }[];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <div className="inline-flex gap-1 rounded-xl bg-muted p-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
              item.active && "bg-accent font-semibold text-foreground shadow-[inset_0_-2px_0] shadow-pronex-pink",
            )}
          >
            {item.label}
            {item.count !== undefined ? <span className="text-xs text-muted-foreground tabular-nums">{item.count}</span> : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}
