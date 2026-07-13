// GET /api/studio/ai/hero-candidates?trade=<slug>
//
// Returns hero library entries ranked for the given trade so the
// Inspector's Hero panel can offer them as swap options. Server-only
// because heroLibrary reads from disk.

import { NextResponse } from "next/server";
import { heroesForTrade } from "@/lib/heroLibrary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const trade = (url.searchParams.get("trade") ?? "").trim();
  if (!trade) {
    return NextResponse.json({ ok: false, error: "trade-required" }, { status: 400 });
  }
  const results = heroesForTrade(trade).slice(0, 24).map(({ entry, score }) => ({
    id: entry.id,
    imageUrl: entry.image_url,
    subject: entry.subject,
    score
  }));
  return NextResponse.json({ ok: true, results });
}
