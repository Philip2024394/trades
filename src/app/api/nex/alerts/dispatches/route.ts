// GET /api/nex/alerts/dispatches?limit= — dispatch audit trail
import { NextResponse } from "next/server";
import { recentDispatches } from "@/lib/nex/alerts/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 100);
  return NextResponse.json({ ok: true, dispatches: await recentDispatches(limit) });
}
