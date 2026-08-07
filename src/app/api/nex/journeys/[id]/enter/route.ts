// POST /api/nex/journeys/{id}/enter  · enter every eligible contact via the trigger segment
import { NextResponse } from "next/server";
import { enterSegmentContacts } from "@/lib/nex/journeys/entry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return NextResponse.json(await enterSegmentContacts(id));
}
