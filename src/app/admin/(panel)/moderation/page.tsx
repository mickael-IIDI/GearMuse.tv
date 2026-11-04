import Link from "next/link";
import { sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { Card, Empty, StatusBadge, btnDanger, btnGhost, btnPrimary, fmtDate, td, th } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";
import { handleReportAction, handleSuggestionAction, moderateAction } from "../../actions";

export const metadata = { title: "File de modération" };

export default async function Moderation() {
  await requireAdmin("viewer");
  const db = await getDb();
  const queue = rows<{ id: number; external_id: string; title: string; quality_score: number | null; score_confidence: number | null; status_reason: string | null; recommender_count: number; creator: string | null; universe: string | null; subs: string | null }>(
    await db.execute(sql`select v.id, v.external_id, v.title, v.quality_score, v.score_confidence, v.status_reason, v.recommender_count, cr.name as creator,
      (select c.labels->>'fr' from video_categories vc join categories c on c.id = vc.category_id where vc.video_id = v.id and vc.is_primary limit 1) as universe,
      (select string_agg(s.labels->>'fr', ', ') from video_subcategories vs join subcategories s on s.id = vs.subcategory_id where vs.video_id = v.id) as subs
      from videos v left join creators cr on cr.id = v.creator_id where v.status = 'pending_review' order by v.quality_score desc nulls last, v.recommender_count desc limit 100`),
  );
  const pendingTotal = Number(rows<{ n: number }>(await db.execute(sql`select count(*)::int as n from videos where status = 'pending_review'`))[0]?.n ?? 0);
  const suggestions = rows<{ id: number; url: string; external_id: string | null; note: string | null; created_at: string; status: string }>(
    await db.execute(sql`select id, url, external_id, note, created_at, status from video_suggestions order by (status = 'pending') desc, id desc limit 30`),
  );
  const reports = rows<{ id: number; url: string | null; reason: string; message: string; contact: string | null; status: string; created_at: string; video_id: number | null; title: string | null }>(
    await db.execute(sql`select r.id, r.url, r.reason, r.message, r.contact, r.status, r.created_at, r.video_id, v.title from content_reports r left join videos v on v.id = r.video_id order by (r.status = 'open') desc, r.id desc limit 30`),
  );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">File de modération</h1>
      <Card title={`Vidéos à valider (${pendingTotal}) — les 100 mieux notées`}>
        <p className="mb-3 text-sm text-muted">Cas incertains : note entre le seuil de validation et le seuil de publication automatique, ou confiance insuffisante. Valider publie la vidéo et fige son statut.</p>
        {queue.length ? (
          <form action={moderateAction}>
            <div className="mb-3 flex flex-wrap gap-2">
              <button name="decision" value="approve" className={btnPrimary}>Publier la sélection</button>
              <button name="decision" value="reject" className={btnGhost}>Rejeter la sélection</button>
              <button name="decision" value="exclude" className={btnDanger}>Exclure</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead><tr><th className={th}></th><th className={th}>Vidéo</th><th className={th}>Classement</th><th className={th}>Note</th><th className={th}>Motif</th></tr></thead>
                <tbody>
                  {queue.map((v) => (
                    <tr key={v.id}>
                      <td className={td}><input type="checkbox" name="id" value={v.id} className="size-4 accent-[var(--accent)]" aria-label={`Sélectionner ${v.title}`} /></td>
                      <td className={td}>
                        <div className="flex gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element -- miniature officielle */}
                          <img src={`https://i.ytimg.com/vi/${v.external_id}/mqdefault.jpg`} alt="" className="h-12 w-[85px] shrink-0 rounded object-cover" loading="lazy" referrerPolicy="no-referrer" />
                          <div>
                            <Link href={`/admin/videos/${v.id}`} className="font-medium hover:text-accent">{v.title}</Link>
                            <div className="text-xs text-muted">{v.creator} · <a className="underline" href={`https://www.youtube.com/watch?v=${v.external_id}`} target="_blank" rel="noopener noreferrer">YouTube</a></div>
                          </div>
                        </div>
                      </td>
                      <td className={td}>{v.universe}<div className="text-xs text-muted">{v.subs}</div></td>
                      <td className={`${td} tabular-nums`}>{v.quality_score}<div className="text-xs text-faint">conf. {v.score_confidence} · {v.recommender_count} rec.</div></td>
                      <td className={`${td} text-xs text-muted`}>{v.status_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </form>
        ) : <Empty>Aucune vidéo en attente.</Empty>}
      </Card>

      <Card title="Propositions des visiteurs">
        {suggestions.length ? (
          <table className="w-full">
            <tbody>
              {suggestions.map((s) => (
                <tr key={s.id}>
                  <td className={td}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-link underline">{s.external_id ?? s.url}</a><div className="text-xs text-muted">{s.note}</div></td>
                  <td className={td}>{fmtDate(s.created_at)}</td>
                  <td className={td}><StatusBadge status={s.status} /></td>
                  <td className={td}>
                    {s.status === "pending" && (
                      <form action={handleSuggestionAction} className="flex gap-2">
                        <input type="hidden" name="id" value={s.id} />
                        <button name="decision" value="import" className={btnPrimary}>Importer et analyser</button>
                        <button name="decision" value="reject" className={btnGhost}>Refuser</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>Aucune proposition.</Empty>}
      </Card>

      <Card title="Signalements et demandes de retrait">
        <div id="signalements" />
        {reports.length ? (
          <table className="w-full">
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className={td}>
                    <div className="font-medium">{r.reason}{r.title ? ` — ${r.title}` : r.url ? ` — ${r.url}` : ""}</div>
                    <div className="mt-1 whitespace-pre-line text-xs text-muted">{r.message}</div>
                    {r.contact && <div className="mt-1 text-xs">Contact : {r.contact}</div>}
                  </td>
                  <td className={td}>{fmtDate(r.created_at)}</td>
                  <td className={td}><StatusBadge status={r.status} /></td>
                  <td className={td}>
                    {r.status === "open" && (
                      <form action={handleReportAction} className="flex flex-wrap gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        {r.video_id && <button name="decision" value="exclude" className={btnDanger}>Exclure la vidéo</button>}
                        <button name="decision" value="resolve" className={btnGhost}>Marquer traité</button>
                        <button name="decision" value="dismiss" className={btnGhost}>Sans suite</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>Aucun signalement.</Empty>}
      </Card>
    </div>
  );
}
