// POST /api/nex/provider/wallet/topup/initiate · Philip 2026-08-29
//
// Thin HTTP adapter around initiateTopup(). Creates a top-up intent, calls
// Midtrans Snap, returns the token so the client can open snap.pay(token).
//
// Body: { learner_ref: string, amount_idr: number }
// Response: { ok, intent_id, midtrans_order_id, amount_idr, snap_token,
//             snap_redirect_url, client_key, env }

import { NextRequest, NextResponse } from "next/server";
import { getMobilityPool } from "@/lib/nex-mobility/pool";
import { initiateTopup } from "@/lib/nex-midtrans/initiate-topup";
import { makeSnapCreateHttp } from "@/lib/nex-midtrans/snap-http";
import { readMidtransConfig } from "@/lib/nex-midtrans/config";

function validateLearnerRef(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  const trimmed = ref.trim();
  if (!/^(nex_id:\d+|device:[a-zA-Z0-9-]{8,})$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: NextRequest) {
  const cfg = readMidtransConfig();
  if (!cfg.configured) {
    return NextResponse.json({
      ok: false,
      error: "midtrans_not_configured",
      hint: "Set NEX_MIDTRANS_SERVER_KEY + NEX_MIDTRANS_CLIENT_KEY in .env.local",
    }, { status: 503 });
  }

  let payload: Record<string, unknown>;
  try { payload = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  const learnerRef = validateLearnerRef(payload.learner_ref);
  if (!learnerRef) {
    return NextResponse.json({ ok: false, error: "invalid learner_ref" }, { status: 400 });
  }
  const amountIdr = Number(payload.amount_idr);
  if (!Number.isFinite(amountIdr) || amountIdr <= 0) {
    return NextResponse.json({ ok: false, error: "amount_idr required (integer)" }, { status: 400 });
  }

  const result = await initiateTopup({
    pool: getMobilityPool(),
    learnerRef,
    amountIdr,
    snapCreate: makeSnapCreateHttp(),
  });
  if (result.ok) {
    // Pass client_key + env so the client-side snap.js loader knows where to fetch
    // (public info, safe to send) — server_key never leaves the server.
    return NextResponse.json({ ...result, client_key: cfg.client_key, env: cfg.env });
  }
  const { status, ...body } = result;
  return NextResponse.json(body, { status });
}
