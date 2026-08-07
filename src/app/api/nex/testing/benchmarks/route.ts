// GET /api/nex/testing/benchmarks?limit= — recent benchmark runs
import { NextResponse } from "next/server";
import { listRecentBenchmarks } from "@/lib/nex/testing/stress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 25);
  return NextResponse.json({ ok: true, runs: await listRecentBenchmarks(limit) });
}
