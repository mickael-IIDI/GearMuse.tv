import "./_env";
import { closeDb, databaseDriver } from "@/db/client";
import { runMigrations } from "@/db/migrate";

async function main() {
  console.log(`[migrate] pilote : ${databaseDriver()}`);
  await runMigrations();
  console.log("[migrate] migrations appliquées");
  await closeDb();
}
main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
