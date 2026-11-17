import { NextResponse, type NextRequest } from "next/server";
import { getServerEnvKeys } from "@/lib/env";
import { isSyncJobName, runSyncJob } from "@/lib/sync";
import { isAuthorizedCronRequest } from "@/lib/sync/cron-auth";

/**
 * Tâches planifiées, déclenchées par Supabase Cron (pg_cron + pg_net).
 * GET ou POST, en-tête « Authorization: Bearer <CRON_SECRET> » obligatoire.
 *
 * maxDuration = 60 s (maximum de l'offre Vercel Hobby). Chaque tâche s'arrête
 * d'elle-même après 50 s et ne lance plus d'appel API sous 17 s restantes
 * (délai de 15 s par appel), le reste étant repris à l'exécution suivante.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function handle(request: NextRequest, context: RouteContext<"/api/cron/[job]">) {
  let secret: string;
  try {
    secret = getServerEnvKeys(["CRON_SECRET"]).CRON_SECRET;
  } catch {
    console.error("[cron] CRON_SECRET absent ou invalide : toutes les requêtes sont refusées.");
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!isAuthorizedCronRequest(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { job } = await context.params;
  if (!isSyncJobName(job)) {
    return NextResponse.json({ error: `Tâche inconnue : ${job}` }, { status: 404 });
  }

  try {
    const summary = await runSyncJob(job);
    return NextResponse.json(summary, { status: summary.status === "failed" ? 500 : 200 });
  } catch (error) {
    console.error(`[cron] ${job} :`, (error as Error).message);
    return NextResponse.json({ job, status: "failed", error: (error as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
