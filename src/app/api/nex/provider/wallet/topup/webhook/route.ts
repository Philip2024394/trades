// POST /api/nex/provider/wallet/topup/webhook · Philip 2026-08-29
//
// Midtrans → NEX authoritative payment result handler.
// Thin adapter around handleMidtransWebhook().
//
// Auth: SHA-512 signature (verifyMidtransSignature) · rejects on mismatch.
// Response contract per Midtrans docs: return 200 quickly (<5s ideal, <15s
// hard cap). Any 5xx triggers Midtrans retry (up to 5 attempts over ~5.5h).
// A 403 tells Midtrans the request is bogus — they will not retry.
//
// This endpoint is idempotent by design (see integration tests).

import { NextRequest, NextResponse } from "next/server";
import { getMobilityPool } from "@/lib/nex-mobility/pool";
import { handleMidtransWebhook, type MidtransWebhookBody } from "@/lib/nex-midtrans/handle-webhook";
import { readMidtransConfig } from "@/lib/nex-midtrans/config";

export async function POST(req: NextRequest) {
  const cfg = readMidtransConfig();
  if (!cfg.configured) {
    // Refuse gracefully · 503 tells Midtrans to retry (correct for genuine
    // config regressions where the operator forgot to redeploy the key).
    return NextResponse.json({ ok: false, error: "midtrans_not_configured" }, { status: 503 });
  }

  let body: MidtransWebhookBody;
  try {
    body = (await req.json()) as MidtransWebhookBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const result = await handleMidtransWebhook({
    pool: getMobilityPool(),
    serverKey: cfg.server_key,
    body,
  });

  if (result.ok) return NextResponse.json(result);
  const { status, ...err } = result;
  return NextResponse.json(err, { status });
}

// Reject other verbs explicitly so a stray GET doesn't get a Next default 405
export function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
