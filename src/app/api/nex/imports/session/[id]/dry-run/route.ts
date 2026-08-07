// POST /api/nex/imports/session/{id}/dry-run — validate + predict, no writes

import { NextResponse } from "next/server";
import { dryRun, getSession } from "@/lib/nex/imports/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const summary = await dryRun(id);
  if (!summary) return NextResponse.json({ ok: false, error: "session_not_found_or_failed" }, { status: 404 });
  const session = getSession(id);
  return NextResponse.json({ ok: true, session, dry_run: summary });
}
