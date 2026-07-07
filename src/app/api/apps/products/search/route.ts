// GET /api/apps/products/search?q=... — public canonical search.
// Used by merchant "add offer" flow to find existing canonicals and by
// AI Visualiser scope picker to bind leaves to real products.
import { NextResponse, type NextRequest } from "next/server";
import { searchCanonicals } from "@/lib/products/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const leaf = req.nextUrl.searchParams.get("leaf");
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(50, parseInt(limitParam, 10) || 25) : 25;
  if (q.trim().length < 2) {
    return NextResponse.json({ ok: true, results: [] });
  }
  const results = await searchCanonicals({
    q,
    taxonomyLeafSlug: leaf ?? null,
    limit
  });
  return NextResponse.json({ ok: true, results });
}
