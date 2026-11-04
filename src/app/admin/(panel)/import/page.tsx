import { sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { ActionForm } from "@/components/admin/form-state";
import { Card, StatusBadge, fmtDate, input, td, th } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";
import { importAction } from "../../actions";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  await requireAdmin("editor");
  const db = await getDb();
  const batches = rows<{ id: number; kind: string; label: string; status: string; total: number; succeeded: number; failed: number; created_at: string; details: { errors?: { item: string; error: string }[] } | null }>(
    await db.execute(sql`select id, kind, label, status, total, succeeded, failed, created_at, details from import_batches order by id desc limit 20`),
  );
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Import manuel et groupé</h1>
      <Card title="Importer des vidéos YouTube">
        <p className="mb-3 text-sm text-muted">
          Collez une ou plusieurs URL (ou identifiants), une par ligne, 200 au maximum. Chaque vidéo est vérifiée, enrichie, classée et notée. Elle n&apos;est publiée que si elle atteint les seuils,
          sauf si vous la marquez comme sélection de la rédaction (preuve éditoriale enregistrée et affichée publiquement).
        </p>
        <ActionForm action={importAction} submitLabel="Importer" pendingLabel="Import et analyse en cours…">
          <textarea name="urls" rows={8} required placeholder={"https://www.youtube.com/watch?v=…\nhttps://youtu.be/…"} className={`${input} font-mono`} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Libellé du lot<input name="label" className={`${input} mt-1`} placeholder="ex. Sélection restauration octobre" /></label>
            <label className="text-sm">Note éditoriale (facultatif)<input name="note" className={`${input} mt-1`} /></label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="editorialPick" className="size-4 accent-[var(--accent)]" /> Sélection de la rédaction (validée par un humain)</label>
        </ActionForm>
      </Card>
      <Card title="Lots récents">
        <table className="w-full">
          <thead><tr><th className={th}>#</th><th className={th}>Libellé</th><th className={th}>Statut</th><th className={th}>Total</th><th className={th}>Réussis</th><th className={th}>Échecs</th><th className={th}>Date</th></tr></thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td className={td}>{b.id}</td>
                <td className={td}>{b.label}{b.details?.errors?.length ? <div className="text-xs text-danger">{b.details.errors.slice(0, 3).map((e) => `${e.item} : ${e.error}`).join(" ; ")}</div> : null}</td>
                <td className={td}><StatusBadge status={b.status} /></td>
                <td className={td}>{b.total}</td><td className={td}>{b.succeeded}</td><td className={td}>{b.failed}</td>
                <td className={td}>{fmtDate(b.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
