// POST /api/nex/webhooks/ses — Amazon SES receiver via SNS
//
// Verifies SNS signature (SigV1 or SigV2) using the cert at
// SigningCertURL (must be an amazonaws.com host) · auto-confirms
// SubscriptionConfirmation messages · translates SES notifications
// into canonical events.

import { NextResponse } from "next/server";
import { ingestEvent } from "@/lib/nex/analytics/ingest";
import { translateSes } from "@/lib/nex/delivery/webhook_translate";
import { verifySns } from "@/lib/nex/delivery/webhook_verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type SnsEnvelope = {
  Type?: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation";
  MessageId?: string;
  TopicArn?: string;
  Subject?: string;
  Message?: string;
  Timestamp?: string;
  SignatureVersion?: string;
  Signature?: string;
  SigningCertURL?: string;
  SubscribeURL?: string;
  Token?: string;
};

export async function POST(request: Request) {
  // SNS sends `application/json` OR `text/plain; charset=UTF-8` · handle both
  const rawBody = await request.text();
  let envelope: SnsEnvelope;
  try { envelope = JSON.parse(rawBody) as SnsEnvelope; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const check = await verifySns(envelope);
  if (!check.ok) return NextResponse.json({ ok: false, error: `signature_invalid · ${check.reason}` }, { status: 401 });

  // Auto-confirm subscription so admins never have to click through manually
  if (envelope.Type === "SubscriptionConfirmation" && envelope.SubscribeURL) {
    try { await fetch(envelope.SubscribeURL, { signal: AbortSignal.timeout(5000) }); }
    catch { /* SNS retries subscription requests · swallow */ }
    return NextResponse.json({ ok: true, confirmed: true });
  }

  if (envelope.Type !== "Notification" || !envelope.Message) {
    return NextResponse.json({ ok: true, ignored: true, type: envelope.Type ?? "unknown" });
  }

  let sesMessage: Record<string, unknown>;
  try { sesMessage = JSON.parse(envelope.Message) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "invalid_sns_message_json" }, { status: 400 }); }

  const events = translateSes(sesMessage);
  const results = await Promise.all(events.map((e) => ingestEvent(e)));
  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, ingested: okCount, translated: events.length });
}
