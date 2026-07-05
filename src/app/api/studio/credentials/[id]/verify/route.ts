// Merchant-triggered credential re-check.
//
//   POST /api/studio/credentials/[id]/verify → { ok, status, displayLabel }
//
// The merchant taps "Verify now" in the manager. Runs the appropriate
// verifier synchronously (schemes with no auto-verifier return
// self-declared). Same orchestrator as the daily cron.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyOne } from "@/lib/studio/credentials/orchestrator";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const { id } = await ctx.params;

  const res = await supabaseAdmin
    .from("studio_brand_credentials")
    .select("id, brand_id, scheme, number, status, display_label")
    .eq("id", id)
    .eq("brand_id", session.brand.id)
    .maybeSingle();

  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  if (!res.data) {
    return NextResponse.json(
      { ok: false, error: "not-found" },
      { status: 404 }
    );
  }

  const outcome = await verifyOne(res.data);
  if (!outcome.ok) {
    return NextResponse.json(
      { ok: false, error: outcome.error },
      { status: 502 }
    );
  }
  return NextResponse.json({
    ok: true,
    status: outcome.status,
    displayLabel: outcome.displayLabel
  });
}
