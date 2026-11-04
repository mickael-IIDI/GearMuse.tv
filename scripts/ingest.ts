import "./_env";
import { sql } from "drizzle-orm";
import { closeDb, getDb, rows } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { importUrls } from "@/server/ingest/discovery";
import { DAILY_STEPS, JOB_TYPES, PIPELINE_STEPS, recoverStaleJobs, runJob, runSteps } from "@/server/ingest/jobs";

/**
 * Ingestion en ligne de commande (relançable, incrémentale).
 *   npm run ingest -- pipeline            pipeline complet (premier catalogue)
 *   npm run ingest -- daily               mise à jour incrémentale
 *   npm run ingest -- step <type> [json]  une étape (ex. step discover_hn_stories '{"fromYear":2015}')
 *   npm run ingest -- import <url…>       import manuel d'URL YouTube
 *   npm run ingest -- stats               état du catalogue
 * Avec PGlite (sans DATABASE_URL), arrêtez d'abord le serveur de développement.
 */
async function stats() {
  const db = await getDb();
  const r = rows<{ status: string; n: number }>(await db.execute(sql`select status, count(*)::int as n from videos group by status order by status`));
  console.table(r);
  const u = rows<{ slug: string; n: number }>(
    await db.execute(sql`select c.slug, count(*)::int as n from video_categories vc join categories c on c.id = vc.category_id join videos v on v.id = vc.video_id where v.status = 'published' and c.kind = 'universe' and vc.is_primary group by c.slug order by n desc`),
  );
  console.table(u);
  const m = rows<{ source: string; n: number }>(await db.execute(sql`select coalesce(metadata_source, 'aucune') as source, count(*)::int as n from videos group by 1`));
  console.table(m);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  await runMigrations();
  await recoverStaleJobs(0);
  switch (cmd) {
    case "pipeline": {
      const res = await runSteps(["seed_taxonomy", "resolve_sources", ...PIPELINE_STEPS.slice(1)], {}, "cli", { echo: true });
      console.table(res.map((r) => ({ step: r.step, status: r.status, ...r.stats })));
      await stats();
      break;
    }
    case "daily": {
      const res = await runSteps(DAILY_STEPS, {}, "cli", { echo: true });
      console.table(res.map((r) => ({ step: r.step, status: r.status })));
      break;
    }
    case "step": {
      if (!args[0] || !JOB_TYPES[args[0]]) {
        console.log("Étapes disponibles :", Object.keys(JOB_TYPES).join(", "));
        process.exitCode = 1;
        break;
      }
      const r = await runJob(args[0], args[1] ? JSON.parse(args[1]) : {}, "cli", { echo: true });
      console.log(r);
      break;
    }
    case "import": {
      const r = await importUrls(args, { label: "Import CLI" });
      console.table(r.result);
      if (r.invalid.length) console.warn("Entrées invalides :", r.invalid);
      break;
    }
    case "stats":
      await stats();
      break;
    default:
      console.log("Commandes : pipeline | daily | step <type> [json] | import <url…> | stats");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
