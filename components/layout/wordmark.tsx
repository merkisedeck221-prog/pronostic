import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logotype PRONEX adapté au thème : lettres « PRO » blanches sur le thème
 * sombre, noires sur le thème clair (dérivé du fichier fourni, couleurs de
 * « NEX » inchangées). Les deux images sont rendues ; le CSS masque l'autre.
 */
export function Wordmark({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <>
      <Image src="/brand/pronex-wordmark.webp" alt="PRONEX" width={995} height={138} priority={priority} className={cn("theme-dark-only", className)} />
      <Image src="/brand/pronex-wordmark-light.webp" alt="PRONEX" width={995} height={138} priority={priority} className={cn("theme-light-only", className)} />
    </>
  );
}
