import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getCompetitionBySlug } from "@/lib/catalog/queries";

/**
 * Contrôle d'existence AVANT le squelette de chargement (loading.tsx) :
 * une compétition inexistante ou inactive renvoie un vrai statut HTTP 404.
 */
export default async function CompetitionLayout({ children, params }: LayoutProps<"/competitions/[slug]">) {
  const { slug } = await params;
  // Visiteur : redirection vers la connexion (et non 404 dû à la RLS).
  await requireUser();
  if (!(await getCompetitionBySlug(slug))) notFound();
  return children;
}
