import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { generationProgressSchema } from "@/lib/generation/stages";
import { createClient } from "@/lib/supabase/server";

/**
 * Suivi d'une génération à la demande (animation PRONEX AI) : statut et phase
 * RÉELS lus en base avec la session de l'utilisateur (RLS : ses demandes
 * uniquement). Route de lecture : une Server Action serait mise en file
 * derrière l'action de génération en cours et ne pourrait pas être interrogée
 * pendant le traitement. Ne renvoie jamais de contenu de pronostic.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/generation/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Demande invalide." }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const supabase = await createClient();
  const { data } = await supabase
    .from("generation_requests")
    .select("status, stage, market_code")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const parsed = generationProgressSchema.safeParse(data ? { status: data.status, stage: data.stage, marketCode: data.market_code } : null);
  if (!parsed.success) return NextResponse.json({ error: "Demande introuvable." }, { status: 404, headers: { "Cache-Control": "no-store" } });

  return NextResponse.json(parsed.data, { headers: { "Cache-Control": "no-store" } });
}
