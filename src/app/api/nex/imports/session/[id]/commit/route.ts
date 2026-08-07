// POST /api/nex/imports/session/{id}/commit — real import through upsertContact()
//
// Body: { save_as_profile?: { label, description? }, apply_profile_id? }

import { NextResponse } from "next/server";
import { commit, getSession } from "@/lib/nex/imports/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { save_as_profile?: { label: string; description?: string | null }; apply_profile_id?: string } = {};
  try { body = await request.json(); }
  catch { body = {}; }

  const report = await commit(id, {
    save_as_profile: body.save_as_profile,
    apply_profile_id: body.apply_profile_id,
  });
  if (!report) return NextResponse.json({ ok: false, error: "session_not_found_or_failed" }, { status: 404 });
  const session = getSession(id);
  return NextResponse.json({ ok: report.errors === 0 || report.errors < report.records_processed, session, report });
}
