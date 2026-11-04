import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { DAILY_STEPS, JOB_TYPES, runJob, runSteps } from "@/server/ingest/jobs";

/**
 * Point d'entrée des tâches planifiées (Vercel Cron, ou tout ordonnanceur externe).
 * Authentification : en-tête « Authorization: Bearer <CRON_SECRET> ».
 *   /api/cron/daily               → toutes les étapes incrémentales
 *   /api/cron/<type de tâche>     → une seule étape (ex. refresh_availability)
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ task: string }> }) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { task } = await params;
  if (task === "daily") return NextResponse.json({ results: await runSteps(DAILY_STEPS, {}, "cron") });
  if (!JOB_TYPES[task]) return NextResponse.json({ error: "Tâche inconnue" }, { status: 404 });
  return NextResponse.json(await runJob(task, {}, "cron"));
}
