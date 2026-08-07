// GET /api/nex/imports/session/{id} — current session state (no raw rows)

import { NextResponse } from "next/server";
import { getSession } from "@/lib/nex/imports/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = getSession(id);
  if (!session) return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, session });
}
