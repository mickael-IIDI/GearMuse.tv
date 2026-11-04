import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sources } from "@/db/schema";
import { ActionForm } from "@/components/admin/form-state";
import { Card, btnGhost, fmtDate, input, td, th } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";
import { addSourceAction, toggleSourceAction, updateSourceAction } from "../../actions";

export const metadata = { title: "Sources" };
const UNIS = ["", "automobile", "moto", "aviation", "nautisme", "autres-vehicules"];
const TYPES: Record<string, string> = { youtube_channel: "Chaîne YouTube", hn_query: "Requête Hacker News", hn_youtube_index: "Index Hacker News", reddit_subreddit: "Subreddit", youtube_search: "Recherche YouTube", blog_rss: "Blog / RSS" };

export default async function SourcesPage() {
  await requireAdmin("viewer");
  const db = await getDb();
  const list = await db.select().from(sources).orderBy(asc(sources.type), asc(sources.name));
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Sources de découverte</h1>
      <Card title="Ajouter une source">
        <ActionForm action={addSourceAction} submitLabel="Vérifier et ajouter">
          <div className="grid gap-3 sm:grid-cols-5">
            <label className="text-sm">Type
              <select name="type" className={`${input} mt-1`}>
                <option value="youtube_channel">Chaîne YouTube (identifiant UC…)</option>
                <option value="hn_query">Requête Hacker News</option>
                <option value="reddit_subreddit">Subreddit (OAuth requis)</option>
              </select>
            </label>
            <label className="text-sm sm:col-span-2">Valeur<input name="value" required className={`${input} mt-1`} placeholder="UCxxxxxxxxxxxxxxxxxxxxxx, terme ou nom de subreddit" /></label>
            <label className="text-sm">Univers indicatif<select name="universe" className={`${input} mt-1`}>{UNIS.map((u) => <option key={u} value={u}>{u || "aucun"}</option>)}</select></label>
            <label className="text-sm">Confiance (0-100)<input name="trust" type="number" min={0} max={100} defaultValue={60} className={`${input} mt-1`} /></label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="official" className="size-4 accent-[var(--accent)]" /> Chaîne officielle (constructeur, institution, compétition)</label>
        </ActionForm>
      </Card>
      <Card title={`Sources configurées (${list.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr><th className={th}>Source</th><th className={th}>Type</th><th className={th}>Paramètres</th><th className={th}>Dernière exécution</th><th className={th}>Trouvées</th><th className={th}>Actions</th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className={s.enabled ? "" : "opacity-50"}>
                  <td className={td}><div className="font-medium">{s.name}</div>{s.isOfficial && <div className="text-xs text-muted">officielle</div>}{s.verifiedAt && <div className="text-xs text-success">vérifiée le {fmtDate(s.verifiedAt)}</div>}</td>
                  <td className={td}>{TYPES[s.type] ?? s.type}</td>
                  <td className={`${td} text-xs text-muted`}>{Object.entries(s.config).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</td>
                  <td className={td}>{fmtDate(s.lastRunAt)}<div className={`text-xs ${s.lastStatus === "error" ? "text-danger" : "text-muted"}`}>{s.lastStatus}{s.lastError ? ` — ${s.lastError.slice(0, 80)}` : ""}</div></td>
                  <td className={`${td} tabular-nums`}>{s.itemsFound}</td>
                  <td className={td}>
                    <form action={updateSourceAction} className="mb-2 flex items-center gap-1.5">
                      <input type="hidden" name="id" value={s.id} />
                      <select name="universe" defaultValue={s.universeHint ?? ""} className={`${input} w-32 py-1`} aria-label="Univers">{UNIS.map((u) => <option key={u} value={u}>{u || "aucun"}</option>)}</select>
                      <input name="trust" type="number" min={0} max={100} defaultValue={s.trustLevel} className={`${input} w-16 py-1`} aria-label="Confiance" />
                      <button className={btnGhost}>OK</button>
                    </form>
                    <form action={toggleSourceAction}><input type="hidden" name="id" value={s.id} /><button className={btnGhost}>{s.enabled ? "Désactiver" : "Activer"}</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
