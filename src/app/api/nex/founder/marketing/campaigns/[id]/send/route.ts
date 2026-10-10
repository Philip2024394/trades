// POST /api/nex/founder/marketing/campaigns/[id]/send
//
// Founder-lane send · shared executor · NO member package touch.
// Body: { mode: "send_to_selected" | "auto_send" }

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth, sendFounderCampaign, FounderValidationError, FounderLaneViolationError } from "@/lib/nex/marketing/founder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({} as any));
  const mode = body.mode === "auto_send" ? "auto_send" : "send_to_selected";
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const out = await sendFounderCampaign(client, auth, id, mode);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    if (e instanceof FounderValidationError) return NextResponse.json({ ok: false, error: e.reason, detail: e.detail }, { status: 400 });
    if (e instanceof FounderLaneViolationError) return NextResponse.json({ ok: false, error: "lane_violation" }, { status: 403 });
    throw e;
  } finally {
    client.release();
  }
}
