// GET /api/nex/journeys/states/{id}  · single execution state + full event history
import { NextResponse } from "next/server";
import { getState } from "@/lib/nex/journeys/registry";
import { listEventsForState } from "@/lib/nex/journeys/events/emitted";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const state = await getState(id);
  if (!state) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const events = await listEventsForState(id);
  return NextResponse.json({ ok: true, state, events });
}
