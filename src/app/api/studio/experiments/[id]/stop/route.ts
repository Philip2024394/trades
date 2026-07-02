// POST /api/studio/experiments/:id/stop
//
// Marks the experiment `stopped` without promoting a variant. Existing
// live layout unchanged. Useful when the merchant wants to bail out of
// a bad test, or when the results are inconclusive.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await params;
  const upd = await supabaseAdmin
    .from("studio_experiments")
    .update({ status: "stopped", ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("brand_id", session.brand.id)
    .eq("status", "running");
  if (upd.error) {
    return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
