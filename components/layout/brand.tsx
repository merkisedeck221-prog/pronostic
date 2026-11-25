import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logo PRONEX : icône (« P » au ballon) + logotype. Images issues du logo
 * fourni par le porteur (public/brand/, fond transparent).
 */
export function Brand({ href = "/", className, compact = false }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("flex shrink-0 items-center gap-1.5", className)} aria-label="PRONEX, accueil">
      <Image src="/brand/pronex-icon.png" alt="" width={36} height={36} priority className="size-9" />
      <Image
        src="/brand/pronex-wordmark.png"
        alt="PRONEX"
        width={600}
        height={90}
        priority
        className={cn("h-5 w-auto", compact && "hidden sm:block")}
      />
    </Link>
  );
}
