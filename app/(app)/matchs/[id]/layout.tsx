import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getFixture } from "@/lib/catalog/queries";

/**
 * Contrôle d'existence AVANT le squelette de chargement (loading.tsx) :
 * match inexistant, non publié ou de compétition inactive → vrai statut HTTP 404.
 */
export default async function FixtureLayout({ children, params }: LayoutProps<"/matchs/[id]">) {
  const { id } = await params;
  await requireUser();
  if (!/^\d{1,12}$/.test(id) || !(await getFixture(Number(id)))) notFound();
  return children;
}
