import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo d'équipe ou de compétition ; initiales si absent. */
export function TeamLogo({ name, src, size = 24, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  if (!src) {
    const initials = name
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size, fontSize: Math.max(9, size / 2.6) }}
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground", className)}
      >
        {initials}
      </span>
    );
  }
  return <Image src={src} alt="" width={size} height={size} className={cn("shrink-0 object-contain", className)} />;
}
