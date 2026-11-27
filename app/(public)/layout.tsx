import { DesignScope } from "@/components/layout/design-scope";
import { PublicHeader } from "@/components/layout/public-header";

/** Pages accessibles sans compte. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="pxa flex min-h-full flex-1 flex-col">
      <DesignScope />
      <PublicHeader />
      <div id="contenu" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </div>
    </div>
  );
}
