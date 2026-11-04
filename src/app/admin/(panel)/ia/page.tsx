import Link from "next/link";
import { sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { Card, fmtDate, td, th } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";
import { aiEnabled, monthSpendUsd } from "@/server/ingest/ai";
import { getSetting } from "@/server/settings";

export const metadata = { title: "Analyses IA et coûts" };

export default async function AiLog() {
  await requireAdmin("viewer");
  const db = await getDb();
  const [spend, ai, on] = await Promise.all([monthSpendUsd(), getSetting("ai"), aiEnabled()]);
  const byModel = rows<{ provider: string; model_version: string; n: number; errors: number; tokens_in: number | null; tokens_out: number | null; cost: string | null }>(
    await db.execute(sql`select provider, model_version, count(*)::int as n, count(*) filter (where error is not null)::int as errors, sum(tokens_in)::int as tokens_in, sum(tokens_out)::int as tokens_out, sum(cost_usd)::text as cost from ai_analysis group by 1, 2 order by n desc`),
  );
  const recent = rows<{ id: number; video_id: number; title: string; provider: string; model_version: string; confidence: number | null; cost_usd: string | null; duration_ms: number | null; error: string | null; created_at: string; in_scope: string | null }>(
    await db.execute(sql`select a.id, a.video_id, v.title, a.provider, a.model_version, a.confidence, a.cost_usd, a.duration_ms, a.error, a.created_at, a.output->>'inScope' as in_scope from ai_analysis a join videos v on v.id = a.video_id order by a.id desc limit 80`),
  );
  const spendDaily = rows<{ day: string; cost: string; requests: number }>(await db.execute(sql`select day, cost_usd::text as cost, requests from api_usage where provider = 'anthropic' order by day desc limit 31`));
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Analyses IA et coûts</h1>
      <Card title="État">
        <p className="text-sm">
          Analyse par modèle de langage : <strong>{on ? `active (${ai.model})` : "inactive"}</strong>. Dépenses du mois : <strong>{spend.toFixed(4)} $</strong> sur un budget de {ai.monthlyBudgetUsd} $.
          {!process.env.ANTHROPIC_API_KEY && " Aucune clé ANTHROPIC_API_KEY : toutes les analyses ci-dessous proviennent du classifieur à règles (provider « heuristic », coût nul)."}
        </p>
        {spendDaily.length > 0 && <p className="mt-2 text-xs text-muted">{spendDaily.map((d) => `${d.day} : ${Number(d.cost).toFixed(3)} $ (${d.requests} req.)`).join(" · ")}</p>}
      </Card>
      <Card title="Par moteur et version">
        <table className="w-full">
          <thead><tr><th className={th}>Moteur</th><th className={th}>Version</th><th className={th}>Analyses</th><th className={th}>Erreurs</th><th className={th}>Jetons entrée / sortie</th><th className={th}>Coût</th></tr></thead>
          <tbody>{byModel.map((m) => <tr key={m.provider + m.model_version}><td className={td}>{m.provider}</td><td className={td}>{m.model_version}</td><td className={td}>{m.n}</td><td className={td}>{m.errors}</td><td className={td}>{m.tokens_in ?? 0} / {m.tokens_out ?? 0}</td><td className={td}>{Number(m.cost ?? 0).toFixed(4)} $</td></tr>)}</tbody>
        </table>
      </Card>
      <Card title="Dernières analyses">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead><tr><th className={th}>Date</th><th className={th}>Vidéo</th><th className={th}>Moteur</th><th className={th}>Périmètre</th><th className={th}>Confiance</th><th className={th}>Durée</th><th className={th}>Coût</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} whitespace-nowrap`}>{fmtDate(r.created_at)}</td>
                  <td className={td}><Link href={`/admin/videos/${r.video_id}`} className="hover:text-accent">{r.title}</Link>{r.error && <div className="text-xs text-danger">{r.error.slice(0, 120)}</div>}</td>
                  <td className={td}>{r.provider}<div className="text-xs text-faint">{r.model_version}</div></td>
                  <td className={td}>{r.in_scope === "true" ? "oui" : r.in_scope === "false" ? "non" : "—"}</td>
                  <td className={td}>{r.confidence ?? "—"}</td>
                  <td className={td}>{r.duration_ms ?? "—"} ms</td>
                  <td className={td}>{r.cost_usd ? `${Number(r.cost_usd).toFixed(5)} $` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
