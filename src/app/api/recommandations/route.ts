import { NextResponse, type NextRequest } from "next/server";
import { ProfileSchema, recommend } from "@/server/recommend";
import { rateLimit } from "@/server/security/rate-limit";

/** Recommandations « Pour vous ». Le profil envoyé n'est ni stocké ni journalisé. */
export async function POST(req: NextRequest) {
  if (!rateLimit(req, "reco", 60, 60_000)) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Profil invalide" }, { status: 400 });
  const r = await recommend(parsed.data);
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}
