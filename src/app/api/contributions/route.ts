import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { contentReports, videos, videoSuggestions } from "@/db/schema";
import { parseYouTubeId } from "@/lib/text";
import { ipHash, rateLimit } from "@/server/security/rate-limit";

/**
 * Contributions publiques : propositions de vidéos et signalements.
 * Validation stricte, champ piège anti-robots, limitation de débit par IP hachée.
 * Rien n'est publié automatiquement : tout passe par la file de modération.
 */
const Suggestion = z.object({ kind: z.literal("suggestion"), url: z.string().min(5).max(300), note: z.string().max(1000).optional().default(""), website: z.string().max(0).optional() });
const Report = z.object({
  kind: z.literal("report"),
  video: z.string().max(300).optional().default(""),
  reason: z.enum(["rights_holder", "unavailable", "wrong_category", "inappropriate", "other"]),
  message: z.string().min(10).max(3000),
  contact: z.string().max(200).optional().default(""),
  website: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  if (!rateLimit(req, "contrib", 8, 10 * 60_000)) return NextResponse.json({ error: "Trop de soumissions, réessayez plus tard." }, { status: 429 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const db = await getDb();
  const kind = (body as { kind?: string })?.kind;
  if (kind === "suggestion") {
    const p = Suggestion.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "Champs invalides" }, { status: 400 });
    const externalId = parseYouTubeId(p.data.url);
    if (!externalId) return NextResponse.json({ error: "URL YouTube invalide" }, { status: 400 });
    await db.insert(videoSuggestions).values({ url: p.data.url.trim(), externalId, note: p.data.note || null, ipHash: ipHash(req) });
    return NextResponse.json({ ok: true });
  }
  if (kind === "report") {
    const p = Report.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "Champs invalides (message de 10 caractères minimum)" }, { status: 400 });
    const ext = p.data.video ? parseYouTubeId(p.data.video) : null;
    const v = ext ? await db.query.videos.findFirst({ where: eq(videos.externalId, ext), columns: { id: true } }) : null;
    await db.insert(contentReports).values({ videoId: v?.id ?? null, url: p.data.video || null, reason: p.data.reason, message: p.data.message, contact: p.data.contact || null, ipHash: ipHash(req) });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Type inconnu" }, { status: 400 });
}
