// GET /api/nex/shadow/records?limit=25&filter=SHADOW_FAILURE
// Founder-only observation surface · recent records.

import { NextResponse } from "next/server";
import { readRecent } from "@/lib/nex-shadow/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")) || 25));
  const filter = url.searchParams.get("filter");
  let records = readRecent(limit * 3); // over-read then filter
  if (filter) records = records.filter((r) => r.examiner.evaluation === filter);
  return NextResponse.json({
    at: new Date().toISOString(),
    count: records.length,
    records: records.slice(0, limit),
    taught_by: "master_ai_engineer",
  }, { headers: { "Cache-Control": "no-store" } });
}
