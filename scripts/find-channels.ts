import "./_env";
/**
 * Recherche de chaînes YouTube candidates dans une langue donnée, via l'API officielle (100 unités par requête).
 * Produit une liste à examiner : aucune chaîne n'est inscrite automatiquement.
 *
 * Usage : npm run channels:find -- [--limit 40]
 * Sortie : .data/review/chaines-fr-candidates.tsv
 */
import fs from "node:fs";
import path from "node:path";
import { closeDb, getDb, rows } from "@/db/client";
import { sql } from "drizzle-orm";
import { guessLanguage } from "@/lib/text";
import { EXCLUDED_CHANNEL_IDS } from "@/lib/taxonomy/sources";
import { apiChannels, apiSearchChannels, QuotaExceededError } from "@/server/ingest/youtube";

const QUERIES: [string, string][] = [
  ["essai voiture", "automobile"], ["essai auto nouveautés", "automobile"], ["mécanique auto tutoriel", "automobile"], ["réparation voiture garage", "automobile"],
  ["restauration voiture ancienne", "automobile"], ["voitures de collection youngtimer", "automobile"], ["histoire automobile documentaire", "automobile"],
  ["sport automobile rallye", "automobile"], ["formule 1 analyse", "automobile"], ["voiture électrique essai autonomie", "automobile"], ["préparation moteur tuning", "automobile"],
  ["magazine automobile émission", "automobile"], ["camping-car van aménagé", "automobile"],
  ["essai moto", "moto"], ["mécanique moto entretien", "moto"], ["enduro motocross", "moto"], ["moto ancienne restauration", "moto"], ["voyage à moto aventure", "moto"], ["vitesse motogp analyse", "moto"], ["magazine moto", "moto"],
  ["aviation pilote de ligne", "aviation"], ["avion de chasse armée de l'air", "aviation"], ["aéronautique histoire avions", "aviation"], ["pilotage avion léger aéroclub", "aviation"], ["hélicoptère pilote", "aviation"], ["analyse crash aérien", "aviation"],
  ["voilier navigation", "nautisme"], ["bateau à moteur essai", "nautisme"], ["marine nationale navires", "nautisme"], ["tour du monde à la voile", "nautisme"], ["course au large voile", "nautisme"], ["chantier naval construction bateau", "nautisme"],
  ["train locomotive SNCF", "autres-vehicules"], ["camion routier transport", "autres-vehicules"], ["tracteur agricole matériel", "autres-vehicules"], ["engins de chantier travaux publics", "autres-vehicules"], ["conquête spatiale fusée", "autres-vehicules"], ["char blindé histoire militaire", "autres-vehicules"], ["bus autocar tramway métro", "autres-vehicules"], ["ingénierie comment ça marche moteur", "autres-vehicules"],
];

const FRANCOPHONE = new Set(["FR", "BE", "CH", "CA", "LU", "MC", "MA", "DZ", "TN", "SN", "CI", "RE", "MQ", "GP", "NC", "PF"]);

async function main() {
  const limit = Number(process.argv[process.argv.indexOf("--limit") + 1]) || QUERIES.length;
  const hits = new Map<string, Set<string>>();
  const universes = new Map<string, Set<string>>();
  for (const [q, universe] of QUERIES.slice(0, limit)) {
    try {
      const ids = await apiSearchChannels(q, { maxResults: 50, relevanceLanguage: "fr", regionCode: "FR" });
      for (const id of ids) {
        hits.set(id, (hits.get(id) ?? new Set()).add(q));
        universes.set(id, (universes.get(id) ?? new Set()).add(universe));
      }
      console.log(`${q} : ${ids.length} (total ${hits.size})`);
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        console.warn(String(e));
        break;
      }
      console.warn(`Échec « ${q} » : ${String(e).slice(0, 200)}`);
    }
  }

  const db = await getDb();
  const known = new Set(rows<{ id: string }>(await db.execute(sql`select config->>'channelId' as id from sources where type = 'youtube_channel'`)).map((r) => r.id));
  const ids = [...hits.keys()].filter((id) => !known.has(id) && !EXCLUDED_CHANNEL_IDS[id]);
  const details = [];
  for (let i = 0; i < ids.length; i += 50) details.push(...(await apiChannels({ ids: ids.slice(i, i + 50) })));

  const clean = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();
  const kept = details
    .filter((c) => (c.videoCount ?? 0) >= 25 && (c.subscriberCount == null || c.subscriberCount >= 2000))
    .filter((c) => (c.country && FRANCOPHONE.has(c.country)) || guessLanguage(`${c.title} ${c.description}`) === "fr")
    .sort((a, b) => hits.get(b.id)!.size - hits.get(a.id)!.size || (b.subscriberCount ?? 0) - (a.subscriberCount ?? 0));

  const file = path.resolve(".data/review/chaines-fr-candidates.tsv");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    kept.map((c) => [c.id, clean(c.title), c.country ?? "-", c.subscriberCount ?? "-", c.videoCount ?? "-", hits.get(c.id)!.size, [...universes.get(c.id)!].join(","), clean(c.description).slice(0, 90)].join("\t")).join("\n") + "\n",
  );
  console.log(`${details.length} chaînes examinées, ${kept.length} candidates → ${file}`);
  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
