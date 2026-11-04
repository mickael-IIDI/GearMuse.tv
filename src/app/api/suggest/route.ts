import { NextResponse, type NextRequest } from "next/server";
import { suggest } from "@/server/queries/suggest";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  const locale = req.cookies.get("lang")?.value === "en" ? "en" : "fr";
  return NextResponse.json({ items: await suggest(q, locale) }, { headers: { "Cache-Control": "public, s-maxage=120" } });
}
