import Link from "next/link";
import { sql, type SQL } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { Card, StatusBadge, btnGhost, btnPrimary, btnDanger, fmtDate, input, td, th } from "@/components/admin/ui";
import { normalize } from "@/lib/text";
import { requireAdmin } from "@/server/auth/session";
import { moderateAction } from "../../actions";

export const metadata = { title: "Vidéos" };
const STATUSES = ["", "published", "pending_review", "discovered", "rejected", "excluded", "unavailable"];
const PAGE = 50;

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function AdminVideos({ searchParams }: Props) {
  await requireAdmin("viewer");
  const sp = await searchParams;
  const statut = STATUSES.includes(sp.statut ?? "") ? sp.statut ?? "" : "";
  const q = (sp.q ?? "").slice(0, 100);
  const univers = /^[a-z-]{2,40}$/.test(sp.univers ?? "") ? sp.univers! : "";
  const tri = sp.tri === "recent" ? "recent" : sp.tri === "score_asc" ? "score_asc" : "score";
  const page = Math.max(1, Number(sp.page) || 1);
  const conds: SQL[] = [sql`true`];
  if (statut) conds.push(sql`v.status = ${statut}`);
  if (q) {
    const id = q.match(/^[A-Za-z0-9_-]{11}$/)?.[0];
    conds.push(id ? sql`(v.external_id = ${id} or v.search_title like ${"%" + normalize(q) + "%"})` : sql`v.search_title like ${"%" + normalize(q) + "%"}`);
  }
  if (univers) conds.push(sql`exists (select 1 from video_categories vc join categories c on c.id = vc.category_id where vc.video_id = v.id and c.slug = ${univers})`);
  const where = sql.join(conds, sql` and `);
  const order = tri === "recent" ? sql`v.id desc` : tri === "score_asc" ? sql`v.quality_score asc nulls first` : sql`v.quality_score desc nulls last`;
  const db = await getDb();
  const list = rows<{ id: number; external_id: string; title: string; status: string; status_reason: string | null; quality_score: number | null; score_confidence: number | null; recommender_count: number; creator: string | null; universe: string | null; editorial_pick: boolean; status_locked: boolean; first_seen_at: string }>(
    await db.execute(sql`select v.id, v.external_id, v.title, v.status, v.status_reason, v.quality_score, v.score_confidence, v.recommender_count, cr.name as creator, v.editorial_pick, v.status_locked, v.first_seen_at,
      (select c.labels->>'fr' from video_categories vc join categories c on c.id = vc.category_id where vc.video_id = v.id and vc.is_primary limit 1) as universe
      from videos v left join creators cr on cr.id = v.creator_id where ${where} order by ${order} limit ${PAGE + 1} offset ${(page - 1) * PAGE}`),
  );
  const total = Number(rows<{ n: number }>(await db.execute(sql`select count(*)::int as n from videos v where ${where}`))[0]?.n ?? 0);
  const qs = (extra: Record<string, string | number>) => new URLSearchParams({ ...(statut && { statut }), ...(q && { q }), ...(univers && { univers }), tri, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) }).toString();

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Vidéos <span className="text-base font-normal text-muted">({total})</span></h1>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="text-xs text-muted">Recherche<input name="q" defaultValue={q} placeholder="Titre ou identifiant" className={`${input} mt-1 w-64`} /></label>
        <label className="text-xs text-muted">Statut
          <select name="statut" defaultValue={statut} className={`${input} mt-1`}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || "Tous"}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">Univers
          <select name="univers" defaultValue={univers} className={`${input} mt-1`}>
            {["", "automobile", "moto", "aviation", "nautisme", "autres-vehicules"].map((s) => <option key={s} value={s}>{s || "Tous"}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">Tri
          <select name="tri" defaultValue={tri} className={`${input} mt-1`}>
            <option value="score">Note décroissante</option>
            <option value="score_asc">Note croissante</option>
            <option value="recent">Ajout récent</option>
          </select>
        </label>
        <button className={btnPrimary} type="submit">Filtrer</button>
      </form>

      <Card>
        <form action={moderateAction}>
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="self-center text-xs text-muted">Sur la sélection :</span>
            <button name="decision" value="approve" className={btnPrimary}>Publier</button>
            <button name="decision" value="reject" className={btnGhost}>Rejeter</button>
            <button name="decision" value="feature" className={btnGhost}>Sélection rédaction</button>
            <button name="decision" value="unlock" className={btnGhost}>Rendre au pipeline</button>
            <button name="decision" value="exclude" className={btnDanger}>Exclure</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead><tr><th className={th}></th><th className={th}>Vidéo</th><th className={th}>Univers</th><th className={th}>Note</th><th className={th}>Recomm.</th><th className={th}>Statut</th></tr></thead>
              <tbody>
                {list.slice(0, PAGE).map((v) => (
                  <tr key={v.id}>
                    <td className={td}><input type="checkbox" name="id" value={v.id} aria-label={`Sélectionner ${v.title}`} className="size-4 accent-[var(--accent)]" /></td>
                    <td className={td}>
                      <div className="flex gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element -- miniature officielle */}
                        <img src={`https://i.ytimg.com/vi/${v.external_id}/mqdefault.jpg`} alt="" className="h-12 w-[85px] shrink-0 rounded object-cover" loading="lazy" referrerPolicy="no-referrer" />
                        <div className="min-w-0">
                          <Link href={`/admin/videos/${v.id}`} className="line-clamp-2 font-medium hover:text-accent">{v.title || `(sans titre) ${v.external_id}`}</Link>
                          <div className="text-xs text-muted">{v.creator ?? "—"} · ajoutée le {fmtDate(v.first_seen_at)}{v.editorial_pick ? " · ★ sélection" : ""}{v.status_locked ? " · statut verrouillé" : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className={td}>{v.universe ?? "—"}</td>
                    <td className={`${td} tabular-nums`}>{v.quality_score ?? "—"}<div className="text-xs text-faint">conf. {v.score_confidence ?? "—"}</div></td>
                    <td className={`${td} tabular-nums`}>{v.recommender_count}</td>
                    <td className={td}><StatusBadge status={v.status} /><div className="mt-1 max-w-[220px] text-xs text-faint">{v.status_reason}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
        <div className="mt-4 flex justify-between text-sm">
          {page > 1 ? <Link className={btnGhost} href={`/admin/videos?${qs({ page: page - 1 })}`}>← Précédent</Link> : <span />}
          {list.length > PAGE && <Link className={btnGhost} href={`/admin/videos?${qs({ page: page + 1 })}`}>Suivant →</Link>}
        </div>
      </Card>
    </div>
  );
}
