import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditLogs } from "@/db/schema";
import { Card, fmtDate, td, th } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";

export const metadata = { title: "Journal des opérations" };

export default async function AuditPage() {
  await requireAdmin("admin");
  const db = await getDb();
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(300);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Journal des opérations</h1>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead><tr><th className={th}>Date</th><th className={th}>Auteur</th><th className={th}>Action</th><th className={th}>Objet</th><th className={th}>Détail</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className={`${td} whitespace-nowrap`}>{fmtDate(l.createdAt)}</td>
                  <td className={td}>{l.actor}</td>
                  <td className={td}>{l.action}</td>
                  <td className={td}>{l.entityType ? `${l.entityType} ${l.entityId ?? ""}` : "—"}</td>
                  <td className={`${td} max-w-md truncate text-xs text-muted`}>{l.after ? JSON.stringify(l.after).slice(0, 200) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
