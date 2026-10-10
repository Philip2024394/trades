// POST /api/nex/founder/marketing/campaigns/[id]/test
//
// Test-email endpoint · sends an actual compiled email to a Founder-supplied
// address · marked X-NEX-Test-Send · not added to contact db · not accounted.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth, sendFounderTestEmail } from "@/lib/nex/marketing/founder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({} as any));
  const recipient = String(body.test_recipient ?? "");
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const out = await sendFounderTestEmail(client, auth, { campaign_id: id, test_recipient: recipient });
    if (out.kind === "test_refused") return NextResponse.json({ ok: false, error: "test_refused", detail: out.reason }, { status: 400 });
    return NextResponse.json({ ok: true, result: out });
  } finally {
    client.release();
  }
}
