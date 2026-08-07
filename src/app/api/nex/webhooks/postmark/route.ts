// POST /api/nex/webhooks/postmark — Postmark webhook receiver
//
// Verifies HTTP Basic Auth against configured user/password ·
// translates into canonical event stream · ingests.

import { NextResponse } from "next/server";
import { ingestEvent } from "@/lib/nex/analytics/ingest";
import { translatePostmark } from "@/lib/nex/delivery/webhook_translate";
import { verifyPostmark } from "@/lib/nex/delivery/webhook_verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const check = verifyPostmark(request.headers.get("authorization"));
  if (!check.ok) return NextResponse.json({ ok: false, error: `auth_invalid · ${check.reason}` }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const events = translatePostmark(body);
  const results = await Promise.all(events.map((e) => ingestEvent(e)));
  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, ingested: okCount, translated: events.length });
}
