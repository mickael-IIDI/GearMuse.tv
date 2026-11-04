import { NextResponse, type NextRequest } from "next/server";
import { parseFilters } from "@/lib/filters";
import { listVideos, searchVideos } from "@/server/queries/videos";

export async function GET(req: NextRequest) {
  const { filters, sort, page, q } = parseFilters(req.nextUrl.searchParams);
  const r = q ? await searchVideos(q, { filters, sort, page }) : await listVideos({ filters, sort, page });
  return NextResponse.json({ items: r.items, hasMore: r.hasMore }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
