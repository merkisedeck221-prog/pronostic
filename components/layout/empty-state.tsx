import type { ReactNode } from "react";
import { InboxIcon, type LucideIcon } from "lucide-react";

/** État vide explicite (aucune donnée à afficher) : jamais de donnée inventée à la place. */
export function EmptyState({ title, children, icon: Icon = InboxIcon }: { title: string; children?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-[#c9f13e]/40 text-pronex-pink">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="max-w-md font-medium">{title}</p>
      {children ? <div className="max-w-md text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}
