// POST /api/nex/journeys/{id}/simulate
// Body: { branch_overrides?: {[nodeId]: 'yes' | 'no'}, wait_and_wait_behavior?: 'assume_completion'|'assume_failure' }
// Dry-run · pure · never touches storage.
import { NextResponse } from "next/server";
import { getJourney } from "@/lib/nex/journeys/registry";
import { simulateJourney, type SimulateOptions } from "@/lib/nex/journeys/simulate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: SimulateOptions = {};
  try { body = await request.json() as SimulateOptions; } catch { /* body optional */ }
  const j = await getJourney(id);
  if (!j) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const result = simulateJourney(j.definition, body);
  return NextResponse.json({ ok: true, journey_id: id, ...result });
}
