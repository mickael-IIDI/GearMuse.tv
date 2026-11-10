import Link from "next/link";
import { sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { Card, StatusBadge, btnGhost, btnPrimary, fmtDate, input, td, th } from "@/components/admin/ui";
import { can, requireAdmin } from "@/server/auth/session";
import { JOB_TYPES } from "@/server/ingest/jobs";
import { runJobAction } from "../../actions";

export const metadata = { title: "Tâches automatiques" };

export default async function JobsPage() {
  const s = await requireAdmin("viewer");
  const db = await getDb();
  const jobs = rows<{ id: number; type: string; status: string; stats: Record<string, number>; error: string | null; started_at: string; finished_at: string | null; triggered_by: string }>(
    await db.execute(sql`select id, type, status, stats, error, started_at, finished_at, triggered_by from ingestion_jobs order by id desc limit 60`),
  );
  const admin = can(s.role, "admin");
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Tâches automatiques</h1>
      <Card title="Lancer une tâche">
        <p className="mb-3 text-sm text-muted">
          Les tâches s&apos;exécutent en arrière-plan ; rechargez la page pour suivre leur avancement. En production, la mise à jour quotidienne est planifiée (GitHub Actions ou Vercel Cron, voir docs/DEPLOIEMENT.md).
          {!admin && " Rôle « admin » requis pour lancer une tâche."}
        </p>
        {admin && (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <form action={runJobAction} className="flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent-soft p-3">
              <div><div className="text-sm font-semibold">Mise à jour quotidienne complète</div><div className="text-xs text-muted">Toutes les étapes incrémentales, dans l&apos;ordre</div></div>
              <input type="hidden" name="type" value="daily" /><button className={btnPrimary}>Lancer</button>
            </form>
            {Object.entries(JOB_TYPES).map(([type, d]) => (
              <form key={type} action={runJobAction} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                <div className="min-w-0"><div className="text-sm font-medium">{d.label}</div><div className="text-xs text-muted">{d.description}</div>
                  {(type === "analyze" || type === "score" || type === "discover_hn_stories" || type === "discover_channels") && (
                    <input name="params" placeholder={type === "analyze" ? '{"force":true}' : type === "score" ? '{"full":true}' : type === "discover_channels" ? '{"backfillPages":2}' : '{"fromYear":2024}'} className={`${input} mt-1 py-1 font-mono text-xs`} />
                  )}
                </div>
                <input type="hidden" name="type" value={type} /><button className={btnGhost}>Lancer</button>
              </form>
            ))}
          </div>
        )}
      </Card>
      <Card title="Historique">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead><tr><th className={th}>#</th><th className={th}>Type</th><th className={th}>Statut</th><th className={th}>Statistiques</th><th className={th}>Début</th><th className={th}>Fin</th><th className={th}>Par</th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className={td}><Link href={`/admin/taches/${j.id}`} className="hover:text-accent">{j.id}</Link></td>
                  <td className={td}>{JOB_TYPES[j.type]?.label ?? j.type}</td>
                  <td className={td}><StatusBadge status={j.status} />{j.error && <div className="mt-1 max-w-xs text-xs text-danger">{j.error.slice(0, 160)}</div>}</td>
                  <td className={`${td} text-xs text-muted`}>{Object.entries(j.stats ?? {}).map(([k, v]) => `${k}: ${v}`).join(" · ")}</td>
                  <td className={td}>{fmtDate(j.started_at)}</td>
                  <td className={td}>{fmtDate(j.finished_at)}</td>
                  <td className={td}>{j.triggered_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
