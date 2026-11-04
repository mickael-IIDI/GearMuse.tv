import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { databaseDriver, getDb } from "@/db/client";

export const dynamic = "force-dynamic";

/** Sonde de supervision : base joignable et nombre de vidéos publiées. */
export async function GET() {
  try {
    const db = await getDb();
    const r = (await db.execute(sql`select count(*)::int as n from videos where status = 'published'`)) as unknown as { rows: { n: number }[] };
    return NextResponse.json({ ok: true, driver: databaseDriver(), published: r.rows[0]?.n ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "health_check_failed", error: String(e) }));
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
