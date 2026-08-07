// POST /api/nex/testing/stress — run one stress benchmark
// Body: { recipients?, max_ticks?, label?, cleanup? }
// Returns { ok, run_id, metrics, errors[] }
import { NextResponse } from "next/server";
import { runStress } from "@/lib/nex/testing/stress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;                          // stress runs can be long-lived

export async function POST(request: Request) {
  let body: { recipients?: number; max_ticks?: number; label?: string; cleanup?: boolean } = {};
  try { body = await request.json() as typeof body; } catch { /* body optional */ }
  const result = await runStress(body);
  return NextResponse.json(result);
}
