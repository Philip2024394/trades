// POST /api/nex/contacts/duplicates/{id}/decide — merge or keep-separate
//
// Body: { decision: "merge" | "keep_separate", surviving_id?, absorbed_id?, decided_by?, rationale? }
// For merge · both surviving_id and absorbed_id are required
// For keep_separate · nothing else is needed

import { NextResponse } from "next/server";
import { decideKeepSeparate, executeMerge } from "@/lib/nex/contacts/merge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  decision: "merge" | "keep_separate";
  surviving_id?: string;
  absorbed_id?: string;
  decided_by?: string;
  rationale?: string;
};

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: Body;
  try { body = (await request.json()) as Body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  if (body.decision === "keep_separate") {
    const r = await decideKeepSeparate(id, body.decided_by);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  if (body.decision === "merge") {
    if (!body.surviving_id || !body.absorbed_id) {
      return NextResponse.json({ ok: false, error: "surviving_id and absorbed_id required for merge" }, { status: 400 });
    }
    const r = await executeMerge({
      suggestion_id: id,
      surviving_id: body.surviving_id,
      absorbed_id: body.absorbed_id,
      decided_by: body.decided_by,
      rationale: body.rationale,
    });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  return NextResponse.json({ ok: false, error: "unknown_decision" }, { status: 400 });
}
