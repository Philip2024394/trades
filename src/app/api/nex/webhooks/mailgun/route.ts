// POST /api/nex/webhooks/mailgun — Mailgun webhook receiver
//
// Verifies signature (HMAC-SHA256 of timestamp+token) using the same
// API key configured on the outbound adapter · translates into the
// canonical event stream · ingests.

import { NextResponse } from "next/server";
import { ingestEvent } from "@/lib/nex/analytics/ingest";
import { translateMailgun } from "@/lib/nex/delivery/webhook_translate";
import { verifyMailgun } from "@/lib/nex/delivery/webhook_verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  let body: { signature?: { timestamp?: string; token?: string; signature?: string } };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const check = verifyMailgun(body);
  if (!check.ok) return NextResponse.json({ ok: false, error: `signature_invalid · ${check.reason}` }, { status: 401 });

  const events = translateMailgun(body);
  const results = await Promise.all(events.map((e) => ingestEvent(e)));
  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, ingested: okCount, translated: events.length });
}
