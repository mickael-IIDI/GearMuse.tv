import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { aiAnalysis, editorialReviews, recommendationEvidence, videoSources, videos } from "@/db/schema";
import { ActionForm } from "@/components/admin/form-state";
import { Card, StatusBadge, btnDanger, btnGhost, btnPrimary, fmtDate, input, td, th } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";
import { moderateAction, reanalyzeAction, updateVideoAction } from "../../../actions";

export const metadata = { title: "Fiche vidéo" };

export default async function AdminVideo({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("viewer");
  const id = Number((await params).id);
  const db = await getDb();
  const v = await db.query.videos.findFirst({ where: eq(videos.id, id) });
  if (!v) notFound();
  const get = async (q: ReturnType<typeof sql>) => rows<{ s: string }>(await db.execute(q)).map((r) => r.s).join(", ");
  const [unis, subs, brandsS, modelsS, tagsS] = await Promise.all([
    get(sql`select c.slug as s from video_categories vc join categories c on c.id = vc.category_id where vc.video_id = ${id} and c.kind = 'universe' order by vc.is_primary desc`),
    get(sql`select s.slug as s from video_subcategories vs join subcategories s on s.id = vs.subcategory_id where vs.video_id = ${id}`),
    get(sql`select b.slug as s from video_brands vb join brands b on b.id = vb.brand_id where vb.video_id = ${id}`),
    get(sql`select b.slug || '/' || m.slug as s from video_models vm join vehicle_models m on m.id = vm.model_id join brands b on b.id = m.brand_id where vm.video_id = ${id}`),
    get(sql`select t.labels->>'fr' as s from video_tags vt join tags t on t.id = vt.tag_id where vt.video_id = ${id}`),
  ]);
  const others = rows<{ slug: string; kind: string; source: string; confidence: number }>(
    await db.execute(sql`select c.slug, c.kind, vc.source, vc.confidence from video_categories vc join categories c on c.id = vc.category_id where vc.video_id = ${id} and c.kind <> 'universe'`),
  );
  const evidence = await db.select().from(recommendationEvidence).where(eq(recommendationEvidence.videoId, id)).orderBy(desc(recommendationEvidence.occurredAt));
  const srcs = await db.select().from(videoSources).where(eq(videoSources.videoId, id));
  const analyses = await db.select().from(aiAnalysis).where(eq(aiAnalysis.videoId, id)).orderBy(desc(aiAnalysis.createdAt)).limit(5);
  const reviews = await db.select().from(editorialReviews).where(eq(editorialReviews.videoId, id)).orderBy(desc(editorialReviews.createdAt)).limit(10);
  const b = v.scoreBreakdown;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/videos" className="text-sm text-muted hover:text-fg">← Vidéos</Link>
        <h1 className="mt-1 font-display text-2xl font-bold">{v.title || v.externalId}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <StatusBadge status={v.status} /> {v.statusReason}
          {v.status === "published" && <Link href={`/video/${v.slug}`} className="text-link underline">Voir la page publique</Link>}
          <a href={`https://www.youtube.com/watch?v=${v.externalId}`} target="_blank" rel="noopener noreferrer" className="text-link underline">YouTube</a>
        </div>
      </div>

      <Card title="Décision éditoriale">
        <form action={moderateAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={v.id} />
          <label className="text-xs text-muted">Note interne (facultatif)<input name="note" className={`${input} mt-1 w-72`} /></label>
          <button name="decision" value="approve" className={btnPrimary}>Publier</button>
          <button name="decision" value="reject" className={btnGhost}>Rejeter</button>
          <button name="decision" value={v.editorialPick ? "unfeature" : "feature"} className={btnGhost}>{v.editorialPick ? "Retirer la sélection" : "Sélection de la rédaction"}</button>
          {v.statusLocked && <button name="decision" value="unlock" className={btnGhost}>Rendre au pipeline</button>}
          <button name="decision" value="exclude" className={btnDanger}>Exclure</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={reanalyzeAction}><input type="hidden" name="id" value={v.id} /><button className={btnGhost}>Forcer la réanalyse</button></form>
          <form action={reanalyzeAction}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="refresh" value="1" /><button className={btnGhost}>Actualiser les métadonnées</button></form>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Classement et contenu éditorial">
          <ActionForm action={updateVideoAction} className="space-y-3">
            <input type="hidden" name="id" value={v.id} />
            <label className="block text-sm">Résumé éditorial<textarea name="editorialSummary" defaultValue={v.editorialSummary ?? ""} rows={3} className={`${input} mt-1`} /></label>
            <label className="block text-sm">Justification de sélection (générée à partir des preuves ; modifiable)<textarea name="selectionReason" defaultValue={v.selectionReason ?? ""} rows={3} className={`${input} mt-1`} /></label>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm">Note forcée (0-100)<input name="scoreOverride" defaultValue={v.scoreOverride ?? ""} className={`${input} mt-1`} /></label>
              <label className="text-sm">Langue<input name="language" defaultValue={v.language ?? ""} className={`${input} mt-1`} /></label>
              <label className="text-sm">Format principal<input name="primaryFormat" defaultValue={v.primaryFormat ?? ""} className={`${input} mt-1`} /></label>
            </div>
            <label className="block text-sm">Univers (slugs, le premier est principal)<input name="universes" defaultValue={unis} className={`${input} mt-1`} /></label>
            <label className="block text-sm">Sous-catégories (slugs)<input name="subcategories" defaultValue={subs} className={`${input} mt-1`} /></label>
            <label className="block text-sm">Marques (slugs)<input name="brands" defaultValue={brandsS} className={`${input} mt-1`} /></label>
            <label className="block text-sm">Modèles (marque/modèle)<input name="models" defaultValue={modelsS} className={`${input} mt-1`} /></label>
            <label className="block text-sm">Tags<input name="tags" defaultValue={tagsS} className={`${input} mt-1`} /></label>
            <p className="text-xs text-muted">Thèmes, formats et technologies détectés : {others.map((o) => `${o.slug} (${o.source}, ${o.confidence})`).join(", ") || "—"}</p>
          </ActionForm>
        </Card>

        <Card title={`Note : ${v.qualityScore ?? "—"}/100 · confiance ${v.scoreConfidence ?? "—"}`}>
          {b ? (
            <table className="w-full">
              <tbody>
                {b.criteria.map((c) => (
                  <tr key={c.key}><td className={td}>{c.key}</td><td className={`${td} tabular-nums`}>{c.available ? `${Math.round(c.score * 100)} × ${c.weight}` : "n/m"}</td><td className={`${td} text-muted`}>{c.basis}</td></tr>
                ))}
                {b.penalties.map((p) => <tr key={p.key}><td className={td}>pénalité</td><td className={`${td} text-danger`}>−{p.points}</td><td className={td}>{p.basis}</td></tr>)}
              </tbody>
            </table>
          ) : <p className="text-sm text-muted">Pas encore notée.</p>}
          <p className="mt-3 text-xs text-muted">Version : {v.scoreVersion} · notée le {fmtDate(v.scoredAt)} · métadonnées : {v.metadataSource ?? "aucune"} ({fmtDate(v.metadataUpdatedAt)}) · disponibilité : {v.availability} ({fmtDate(v.availabilityCheckedAt)})</p>
        </Card>
      </div>

      <Card title={`Preuves de recommandation (${evidence.length})`}>
        <table className="w-full">
          <thead><tr><th className={th}>Type</th><th className={th}>Source</th><th className={th}>Détail</th><th className={th}>Date</th></tr></thead>
          <tbody>
            {evidence.map((e) => (
              <tr key={e.id}>
                <td className={td}>{e.kind}</td>
                <td className={td}>{e.url ? <a className="text-link underline" href={e.url} target="_blank" rel="noopener noreferrer">{e.sourceName}</a> : e.sourceName}</td>
                <td className={td}>{e.title ?? ""}{e.author ? ` — @${e.author}` : ""}{e.points != null ? ` — ${e.points} pts` : ""}{e.excerpt ? <div className="mt-1 text-xs text-muted">{e.excerpt}</div> : null}</td>
                <td className={td}>{fmtDate(e.occurredAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">Sources de découverte : {srcs.map((s) => `${s.sourceType}:${s.sourceRef}`).join(", ")}</p>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Journal d'analyse">
          {analyses.map((a) => (
            <details key={a.id} className="border-b border-line/60 py-2 text-sm">
              <summary className="cursor-pointer">{fmtDate(a.createdAt)} — {a.provider} · {a.modelVersion}{a.error ? ` — erreur` : ""}{a.costUsd ? ` — ${a.costUsd} $` : ""}</summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-bg p-3 text-xs">{JSON.stringify(a.error ?? a.output, null, 2)}</pre>
            </details>
          ))}
        </Card>
        <Card title="Historique éditorial">
          {reviews.length ? reviews.map((r) => <div key={r.id} className="border-b border-line/60 py-1.5 text-sm">{fmtDate(r.createdAt)} — {r.decision}{r.notes ? ` — ${r.notes}` : ""}</div>) : <p className="text-sm text-muted">Aucune intervention.</p>}
        </Card>
      </div>
    </div>
  );
}
