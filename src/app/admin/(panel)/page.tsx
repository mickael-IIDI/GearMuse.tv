import Link from "next/link";
import { sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { Card, Stat, StatusBadge, fmtDate, td, th } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";
import { youtubeApiEnabled } from "@/server/ingest/youtube";
import { redditEnabled } from "@/server/ingest/reddit";
import { aiEnabled, monthSpendUsd } from "@/server/ingest/ai";
import { getSetting } from "@/server/settings";
import { catalogCounts } from "@/server/queries/videos";

export const metadata = { title: "Tableau de bord" };

export default async function Dashboard() {
  await requireAdmin("viewer");
  const db = await getDb();
  const [counts, ai, spend, aiOn] = await Promise.all([catalogCounts(), getSetting("ai"), monthSpendUsd(), aiEnabled()]);
  const coverage = rows<{ slug: string; label: string; published: number; pending: number }>(
    await db.execute(sql`select c.slug, c.labels->>'fr' as label,
      count(*) filter (where v.status = 'published')::int as published, count(*) filter (where v.status = 'pending_review')::int as pending
      from categories c left join video_categories vc on vc.category_id = c.id and vc.is_primary left join videos v on v.id = vc.video_id
      where c.kind = 'universe' group by c.slug, c.labels, c.sort_order order by c.sort_order`),
  );
  const subsEmpty = Number(rows<{ n: number }>(await db.execute(sql`select count(*)::int as n from subcategories where video_count = 0 and is_active`))[0]?.n ?? 0);
  const subsTotal = Number(rows<{ n: number }>(await db.execute(sql`select count(*)::int as n from subcategories where is_active`))[0]?.n ?? 0);
  const meta = rows<{ api: number; oembed: number; rss: number; none: number; duration: number }>(
    await db.execute(sql`select count(*) filter (where metadata_source = 'youtube_api')::int as api, count(*) filter (where metadata_source = 'oembed')::int as oembed,
      count(*) filter (where metadata_source = 'rss')::int as rss, count(*) filter (where metadata_source is null)::int as none, count(*) filter (where duration_seconds is not null)::int as duration from videos`),
  )[0];
  const usage = rows<{ provider: string; units: number; requests: number; errors: number; cost: string }>(
    await db.execute(sql`select provider, units, requests, errors, cost_usd::text as cost from api_usage where day = ${new Date().toISOString().slice(0, 10)} order by provider`),
  );
  const jobs = rows<{ id: number; type: string; status: string; started_at: string; finished_at: string | null; triggered_by: string }>(
    await db.execute(sql`select id, type, status, started_at, finished_at, triggered_by from ingestion_jobs order by id desc limit 8`),
  );
  const open = rows<{ reports: number; suggestions: number }>(
    await db.execute(sql`select (select count(*)::int from content_reports where status = 'open') as reports, (select count(*)::int from video_suggestions where status = 'pending') as suggestions`),
  )[0];
  const quota = Number(process.env.YOUTUBE_DAILY_QUOTA || 10000);
  const yt = usage.find((u) => u.provider === "youtube_data_api");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Tableau de bord</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Publiées" value={counts.published} href="/admin/videos?statut=published" />
        <Stat label="À valider" value={counts.pending} href="/admin/moderation" />
        <Stat label="Découvertes" value={counts.discovered} hint="en attente d'analyse" href="/admin/videos?statut=discovered" />
        <Stat label="Rejetées" value={counts.rejected} href="/admin/videos?statut=rejected" />
        <Stat label="Indisponibles" value={counts.unavailable} href="/admin/videos?statut=unavailable" />
        <Stat label="Signalements" value={open?.reports ?? 0} hint={`${open?.suggestions ?? 0} proposition(s)`} href="/admin/moderation#signalements" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Couverture du catalogue par univers">
          <table className="w-full">
            <thead><tr><th className={th}>Univers</th><th className={th}>Publiées</th><th className={th}>À valider</th></tr></thead>
            <tbody>
              {coverage.map((c) => (
                <tr key={c.slug}>
                  <td className={td}><Link href={`/admin/videos?univers=${c.slug}`} className="hover:text-accent">{c.label}</Link></td>
                  <td className={`${td} tabular-nums`}>{c.published}</td>
                  <td className={`${td} tabular-nums`}>{c.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">{subsEmpty} sous-catégorie(s) sur {subsTotal} n&apos;ont encore aucune vidéo publiée.</p>
        </Card>

        <Card title="Métadonnées et accès externes">
          <ul className="space-y-1.5 text-sm">
            <li>YouTube Data API : {youtubeApiEnabled() ? <strong className="text-success">configurée</strong> : <strong className="text-danger">non configurée</strong>} — {meta.api} vidéo(s) enrichies via l&apos;API, {meta.oembed} via oEmbed, {meta.rss} via RSS, {meta.none} sans métadonnées.</li>
            <li>Durée connue : {meta.duration} vidéo(s){!youtubeApiEnabled() && " (la durée exige l'API YouTube)"}.</li>
            <li>Quota YouTube aujourd&apos;hui : {yt?.units ?? 0} / {quota} unités.</li>
            <li>Reddit : {redditEnabled() ? "configuré" : "non configuré (REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET)"}.</li>
            <li>Analyse IA : {aiOn ? `active (${ai.model})` : process.env.ANTHROPIC_API_KEY ? "clé présente, désactivée dans les réglages" : "non configurée (ANTHROPIC_API_KEY) — classifieur à règles utilisé"} · dépenses du mois : {spend.toFixed(4)} $ / {ai.monthlyBudgetUsd} $.</li>
          </ul>
          <table className="mt-4 w-full">
            <thead><tr><th className={th}>API (aujourd&apos;hui)</th><th className={th}>Requêtes</th><th className={th}>Unités</th><th className={th}>Erreurs</th><th className={th}>Coût</th></tr></thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.provider}><td className={td}>{u.provider}</td><td className={td}>{u.requests}</td><td className={td}>{u.units}</td><td className={td}>{u.errors}</td><td className={td}>{Number(u.cost).toFixed(4)} $</td></tr>
              ))}
              {!usage.length && <tr><td className={td} colSpan={5}>Aucun appel aujourd&apos;hui.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Dernières tâches" actions={<Link href="/admin/taches" className="text-sm text-muted hover:text-fg">Superviser →</Link>}>
        <table className="w-full">
          <thead><tr><th className={th}>#</th><th className={th}>Type</th><th className={th}>Statut</th><th className={th}>Début</th><th className={th}>Fin</th><th className={th}>Par</th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td className={td}><Link href={`/admin/taches/${j.id}`} className="hover:text-accent">{j.id}</Link></td>
                <td className={td}>{j.type}</td>
                <td className={td}><StatusBadge status={j.status} /></td>
                <td className={td}>{fmtDate(j.started_at)}</td>
                <td className={td}>{fmtDate(j.finished_at)}</td>
                <td className={td}>{j.triggered_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
