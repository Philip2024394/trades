// GET /api/nex/journeys/{id}   single journey + first N states
import { NextResponse } from "next/server";
import { getJourney, listStatesForJourney } from "@/lib/nex/journeys/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const journey = await getJourney(id);
  if (!journey) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const states = await listStatesForJourney(id, 100);
  return NextResponse.json({ ok: true, journey, states });
}
