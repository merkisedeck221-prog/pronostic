import Link from "next/link";
import { PronexMark } from "@/components/layout/pronex-mark";
import { cn } from "@/lib/utils";

/** Logo PRONEX : symbole « P + ballon » et nom, dans la police du design. */
export function Brand({ href = "/", className, compact = false }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("flex min-h-11 shrink-0 items-center gap-2 text-foreground", className)} aria-label="PRONEX, accueil">
      <PronexMark className="h-7 w-auto" accent="currentColor" />
      <span className={cn("font-[family-name:var(--font-inter-tight)] text-xl font-semibold tracking-[-0.04em]", compact && "hidden sm:inline")}>PRONEX</span>
    </Link>
  );
}
