// GET / POST /api/nex/webhooks/whatsapp
//
// Stage 3.39 · Meta Cloud API WhatsApp webhook (Philip 2026-08-31).
//
// GET  · subscription-verification handshake (Meta calls this once
//        when you subscribe · returns hub.challenge iff the token
//        matches).
// POST · delivery/read/failed status events. Verified with
//        HMAC-SHA256(app_secret, rawBody) === x-hub-signature-256.
//
// CONSTITUTIONAL:
//   · Always return 200 for POST once auth passes. Meta retries on
//     non-200 · we don't want a duplicate outbox update because our
//     handler happened to throw AFTER we already reconciled.
//   · HMAC compare in constant time · never string equality.
//   · Reconciliation is the ONLY code path that flips outbox rows
//     from ACCEPTED → CONFIRMED. This route just extracts events
//     from Meta's payload and hands them to reconcileMetaStatus.
//   · Unknown wamids are LOGGED (via the response body's `results`)
//     but NEVER inbox a new row · webhook is not source-of-truth.

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { loadWhatsAppConfig, canReceiveWhatsAppWebhooks } from "@/lib/nex/config/whatsapp";
import {
  extractStatusEvents,
  reconcileMetaStatus,
  type ReconciliationOutcome,
} from "@/lib/nex/brain/adapters/whatsapp-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── GET · subscription verification ─────────────────────────────

export async function GET(req: Request) {
  const cfg = loadWhatsAppConfig();
  if (!cfg.webhookVerifyToken) {
    // Not configured · refuse honestly rather than silently accepting.
    return new NextResponse("verify token not configured", { status: 403 });
  }
  const url = new URL(req.url);
  const mode      = url.searchParams.get("hub.mode");
  const token     = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || token !== cfg.webhookVerifyToken || !challenge) {
    return new NextResponse("bad verify", { status: 403 });
  }
  // Meta expects the raw challenge string echoed back.
  return new NextResponse(challenge, { status: 200 });
}

// ─── POST · status events ────────────────────────────────────────

/**
 * Constant-time HMAC compare. Both sides converted to Buffers of equal
 * length before timingSafeEqual (crypto throws on length mismatch).
 */
function verifySignature(rawBody: string, appSecret: string, header: string | null): boolean {
  if (!header) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const cfg = loadWhatsAppConfig();
  if (!canReceiveWhatsAppWebhooks(cfg)) {
    // Missing app secret or verify token · refuse ALL POSTs · never
    // silently accept unauthenticated events.
    return NextResponse.json({ ok: false, error: "webhook receiver not configured" }, { status: 401 });
  }

  // Read the raw body BEFORE parsing · HMAC must be over exact bytes.
  const rawBody = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, cfg.metaAppSecret!, sig)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Auth passed but body isn't JSON · return 200 so Meta doesn't
    // retry (our config is bad, not theirs).
    return NextResponse.json({ ok: true, ignored: "invalid-json" }, { status: 200 });
  }

  const events = extractStatusEvents(body);
  const results: Array<{ wamid: string; outcome: ReconciliationOutcome["kind"]; reason?: string }> = [];
  for (const ev of events) {
    try {
      const out = await reconcileMetaStatus(ev);
      results.push({
        wamid: ev.wamid,
        outcome: out.kind,
        reason: out.kind === "resolved" ? out.reason : (out.kind === "no_change" ? out.reason : out.reason),
      });
    } catch (err) {
      // Reconciliation failure MUST NOT trigger a Meta retry (would
      // duplicate resolution). Log via response body and continue.
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ wamid: ev.wamid, outcome: "no_change", reason: `reconciliation threw: ${msg}` });
    }
  }

  return NextResponse.json({ ok: true, count: events.length, results }, { status: 200 });
}
