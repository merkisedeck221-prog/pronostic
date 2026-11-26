import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logo PRONEX : icône (« P » au ballon) + logotype. Images issues du logo
 * fourni par le porteur (public/brand/, fond transparent).
 */
export function Brand({ href = "/", className, compact = false }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("flex min-h-11 shrink-0 items-center gap-2", className)} aria-label="PRONEX, accueil">
      <Image src="/brand/pronex-symbol.webp" alt="" width={240} height={113} priority className="h-6 w-auto sm:h-7" />
      <Image
        src="/brand/pronex-wordmark.webp"
        alt="PRONEX"
        width={600}
        height={96}
        priority
        className={cn("h-5 w-auto", compact && "hidden sm:block")}
      />
    </Link>
  );
}
