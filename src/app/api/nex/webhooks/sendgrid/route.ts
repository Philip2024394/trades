// POST /api/nex/webhooks/sendgrid — SendGrid Event Webhook receiver
//
// Verifies X-Twilio-Email-Event-Webhook-Signature (ECDSA-P256) using
// the public key configured in the SendGrid UI · translates into the
// canonical event stream · ingests via analytics/ingest.

import { NextResponse } from "next/server";
import { ingestEvent } from "@/lib/nex/analytics/ingest";
import { translateSendGrid } from "@/lib/nex/delivery/webhook_translate";
import { verifySendGrid } from "@/lib/nex/delivery/webhook_verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("x-twilio-email-event-webhook-signature");
  const ts  = request.headers.get("x-twilio-email-event-webhook-timestamp");

  const check = verifySendGrid(rawBody, { signature: sig, timestamp: ts });
  if (!check.ok) return NextResponse.json({ ok: false, error: `signature_invalid · ${check.reason}` }, { status: 401 });

  let body: unknown;
  try { body = JSON.parse(rawBody); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const events = translateSendGrid(body);
  const results = await Promise.all(events.map((e) => ingestEvent(e)));
  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, ingested: okCount, translated: events.length });
}
