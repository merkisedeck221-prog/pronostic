import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Titre de section : sur-titre en petites majuscules, titre, description facultative. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  id,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("space-y-2", align === "center" && "mx-auto max-w-2xl text-center", className)}>
      {eyebrow ? <p className="text-xs font-semibold tracking-[0.2em] text-pronex-pink uppercase">{eyebrow}</p> : null}
      <h2 id={id} className="text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {description ? <p className="text-muted-foreground">{description}</p> : null}
    </div>
  );
}
