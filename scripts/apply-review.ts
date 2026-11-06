import "./_env";
import fs from "node:fs";
import path from "node:path";
import { inArray, sql } from "drizzle-orm";
import { closeDb, getDb, rows } from "@/db/client";
import { auditLogs, videos } from "@/db/schema";
import { refreshSmartPlaylists } from "@/server/catalog/playlists";
import { refreshCounts } from "@/server/catalog/seed";
import { applyEditorialDecisions, type DecisionItem } from "@/server/curation/decisions";
import { scoreVideos } from "@/server/ingest/pipeline";

/**
 * Applique une revue de la file de validation (fichiers .data/review/decisions-*.tsv, format
 * « id<TAB>A|R|P<TAB>CODE », codes de docs/REVUE-EDITORIALE.md) après contrôle complet.
 *   npm run review:apply -- --dry-run          contrôle et statistiques, sans écriture
 *   npm run review:apply -- --label "…"        application (libellé de provenance enregistré)
 * Seules les vidéos encore « pending_review » sont modifiées ; tout est réversible depuis l'administration.
 */
const CODES: Record<string, { letter: "A" | "R" | "P"; label: string }> = {
  "A-EXPL": { letter: "A", label: "explication technique" },
  "A-DOC": { letter: "A", label: "documentaire, histoire" },
  "A-ESSAI": { letter: "A", label: "essai approfondi" },
  "A-ATELIER": { letter: "A", label: "restauration, réparation, construction" },
  "A-REPORT": { letter: "A", label: "reportage, visite" },
  "A-PILOTE": { letter: "A", label: "technique de pilotage ou de navigation" },
  "A-VOYAGE": { letter: "A", label: "expédition, voyage" },
  "A-COURSE": { letter: "A", label: "compétition marquante" },
  "R-HS": { letter: "R", label: "hors sujet" },
  "R-ACTU": { letter: "R", label: "actualité éphémère" },
  "R-PROMO": { letter: "R", label: "contenu promotionnel" },
  "R-ACHAT": { letter: "R", label: "équipement, achat" },
  "R-VLOG": { letter: "R", label: "vlog sans contenu véhicule substantiel" },
  "R-FAIBLE": { letter: "R", label: "valeur faible" },
  "R-DOUBLON": { letter: "R", label: "fragment ou doublon" },
  "P-DOUTE": { letter: "P", label: "à trancher par un humain" },
  "P-RESERVE": { letter: "P", label: "réserve (plafond de diversité de la chaîne)" },
};

const dir = path.resolve(".data/review");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const labelArg = args[args.indexOf("--label") + 1];
const label = args.includes("--label") && labelArg ? labelArg : `Revue assistée (${new Date().toISOString().slice(0, 10)})`;

function readIds(file: string): number[] {
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^\d+\t/.test(l))
    .map((l) => Number(l.split("\t")[0]));
}

async function main() {
  const lots = fs.readdirSync(dir).filter((f) => /^lot-\d+\.tsv$/.test(f));
  const expected = new Set(lots.flatMap((f) => readIds(path.join(dir, f))));
  const decided = new Map<number, string>();
  const problems: string[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => /^decisions-\d+\.tsv$/.test(x))) {
    for (const [n, raw] of fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/).entries()) {
      const line = raw.trim();
      if (!line) continue;
      const [idS, letter, code] = line.split(/\t|\s+/);
      const id = Number(idS);
      const def = CODES[code];
      if (!Number.isInteger(id) || !def || def.letter !== letter) problems.push(`${f}:${n + 1} ligne invalide « ${line.slice(0, 60)} »`);
      else if (!expected.has(id)) problems.push(`${f}:${n + 1} identifiant ${id} absent des lots`);
      else if (decided.has(id)) problems.push(`${f}:${n + 1} identifiant ${id} en double`);
      else decided.set(id, code);
    }
  }
  const missing = [...expected].filter((id) => !decided.has(id));
  console.log(`Lots : ${expected.size} vidéos ; décisions valides : ${decided.size} ; manquantes : ${missing.length} ; anomalies : ${problems.length}`);
  for (const p of problems.slice(0, 20)) console.log("  -", p);

  const byCode = new Map<string, number>();
  for (const c of decided.values()) byCode.set(c, (byCode.get(c) ?? 0) + 1);
  console.table([...byCode.entries()].sort((a, b) => b[1] - a[1]).map(([code, n]) => ({ code, decision: CODES[code].letter, libelle: CODES[code].label, n })));

  const db = await getDb();
  const ids = [...decided.keys()];
  const pending = new Set(
    rows<{ id: number }>(await db.execute(sql`select id from videos where status = 'pending_review' and id in (${sql.join((ids.length ? ids : [-1]).map((i) => sql`${i}`), sql`, `)})`)).map((r) => Number(r.id)),
  );
  const items: DecisionItem[] = ids
    .filter((id) => pending.has(id))
    .map((id) => {
      const code = decided.get(id)!;
      const d = CODES[code];
      return { id, decision: d.letter === "A" ? "approve" : d.letter === "R" ? "reject" : "keep", note: `${code} (${d.label})` };
    });
  console.log(`Encore en attente et donc applicables : ${items.length}`);
  if (dryRun) return;

  const counts = await applyEditorialDecisions(items, { label, adminUserId: null });
  const approved = items.filter((i) => i.decision === "approve").map((i) => i.id);
  // Note et justification recalculées pour les vidéos approuvées (leur statut, verrouillé, ne change plus).
  for (let i = 0; i < approved.length; i += 500) await scoreVideos({ videoIds: approved.slice(i, i + 500) });
  await refreshSmartPlaylists();
  await refreshCounts();
  await db.insert(auditLogs).values({ actor: "claude-code", action: "editorial_review_batch", entityType: "video", entityId: `${items.length} vidéos`, after: { label, counts, missing: missing.length, anomalies: problems.length } });
  console.log("Appliqué :", counts);

  const over = rows<{ name: string; n: number }>(
    await db.execute(sql`select cr.name, count(*)::int n from videos v join creators cr on cr.id = v.creator_id where v.status = 'published' group by cr.name having count(*) > 40 order by n desc`),
  );
  if (over.length) console.log("Chaînes au-delà de 40 vidéos publiées :", over.map((o) => `${o.name} (${o.n})`).join(", "));
  const stillPending = await db.select({ id: videos.id }).from(videos).where(inArray(videos.id, missing.length ? missing : [-1]));
  if (stillPending.length) console.log(`${stillPending.length} vidéo(s) sans décision restent en attente.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
