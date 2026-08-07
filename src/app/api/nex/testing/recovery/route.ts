// POST /api/nex/testing/recovery — run the full recovery suite
// Returns machine-readable PASS/FAIL per scenario + aggregate.
import { NextResponse } from "next/server";
import { runRecoverySuite, listRecentRecoveryRuns } from "@/lib/nex/testing/recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: { label?: string } = {};
  try { body = await request.json() as typeof body; } catch { /* body optional */ }
  const result = await runRecoverySuite(body.label ?? null);
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({ ok: true, runs: await listRecentRecoveryRuns(25) });
}
