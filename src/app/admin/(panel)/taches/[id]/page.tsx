import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { ingestionJobs, jobEvents } from "@/db/schema";
import { Card, StatusBadge, fmtDate, td } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";

export const metadata = { title: "Détail de tâche" };

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("viewer");
  const id = Number((await params).id);
  const db = await getDb();
  const job = await db.query.ingestionJobs.findFirst({ where: eq(ingestionJobs.id, id) });
  if (!job) notFound();
  const events = await db.select().from(jobEvents).where(eq(jobEvents.jobId, id)).orderBy(asc(jobEvents.id)).limit(1000);
  return (
    <div className="space-y-5">
      <Link href="/admin/taches" className="text-sm text-muted hover:text-fg">← Tâches</Link>
      <h1 className="font-display text-2xl font-bold">Tâche n°{job.id} — {job.type}</h1>
      <div className="flex flex-wrap gap-3 text-sm"><StatusBadge status={job.status} /> début {fmtDate(job.startedAt)} · fin {fmtDate(job.finishedAt)} · par {job.triggeredBy}</div>
      <Card title="Statistiques">
        <pre className="overflow-auto rounded-lg bg-bg p-3 text-xs">{JSON.stringify({ params: job.params, stats: job.stats, error: job.error }, null, 2)}</pre>
      </Card>
      <Card title={`Journal (${events.length} événements)`}>
        <table className="w-full">
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className={`${td} w-40 whitespace-nowrap text-xs text-faint`}>{fmtDate(e.createdAt)}</td>
                <td className={`${td} w-16 text-xs ${e.level === "error" ? "text-danger" : e.level === "warn" ? "text-accent" : "text-muted"}`}>{e.level}</td>
                <td className={td}>{e.message}{e.data && <div className="text-xs text-faint">{JSON.stringify(e.data).slice(0, 300)}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
