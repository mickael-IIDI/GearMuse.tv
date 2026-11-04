import { NextResponse, type NextRequest } from "next/server";
import { videosByExternalIds } from "@/server/queries/videos";

/** Cartes des vidéos de la bibliothèque locale (favoris, historique…). Aucun identifiant n'est conservé. */
export async function POST(req: NextRequest) {
  let ids: string[] = [];
  try {
    const body = (await req.json()) as { ids?: unknown };
    ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 500) : [];
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  return NextResponse.json({ items: await videosByExternalIds(ids) }, { headers: { "Cache-Control": "no-store" } });
}
