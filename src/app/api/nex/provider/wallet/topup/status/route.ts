// GET /api/nex/provider/wallet/topup/status?learner_ref=...&intent_id=... · Philip 2026-08-29
//
// Client polls this after snap.pay() closes (onPending / onClose / onSuccess)
// to get the authoritative intent state. Client trusts server, not Snap callbacks.
//
// Returns the intent's state + Midtrans metadata + current wallet balance so
// the client can render "credited · new balance Rp N" without a second call.

import { NextRequest, NextResponse } from "next/server";
import { getMobilityPool } from "@/lib/nex-mobility/pool";

function validateLearnerRef(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  const trimmed = ref.trim();
  if (!/^(nex_id:\d+|device:[a-zA-Z0-9-]{8,})$/.test(trimmed)) return null;
  return trimmed;
}

export async function GET(req: NextRequest) {
  const learnerRef = validateLearnerRef(req.nextUrl.searchParams.get("learner_ref"));
  const intentId = req.nextUrl.searchParams.get("intent_id");
  if (!learnerRef) return NextResponse.json({ ok: false, error: "invalid learner_ref" }, { status: 400 });
  if (!intentId || !/^[0-9a-f-]{36}$/i.test(intentId))
    return NextResponse.json({ ok: false, error: "invalid intent_id" }, { status: 400 });

  const pool = getMobilityPool();
  const { rows } = await pool.query(
    `SELECT i.intent_id, i.provider_id, i.amount_idr, i.state,
            i.midtrans_order_id, i.midtrans_payment_type,
            i.last_webhook_status, i.credited_at, i.created_at,
            p.learner_ref  AS owner_learner_ref,
            w.balance_idr  AS wallet_balance_idr
     FROM nex.provider_topup_intent i
     JOIN nex.provider_profile p ON p.provider_id = i.provider_id
     LEFT JOIN nex.provider_wallet w ON w.provider_id = i.provider_id
     WHERE i.intent_id = $1
     LIMIT 1`,
    [intentId],
  );
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "intent_not_found" }, { status: 404 });
  }
  const r = rows[0];
  if (r.owner_learner_ref !== learnerRef) {
    // Do not leak that the intent exists to a caller who doesn't own it.
    return NextResponse.json({ ok: false, error: "intent_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    intent_id: r.intent_id,
    state: r.state,
    amount_idr: r.amount_idr,
    midtrans_order_id: r.midtrans_order_id,
    midtrans_payment_type: r.midtrans_payment_type,
    last_webhook_status: r.last_webhook_status,
    credited_at: r.credited_at,
    created_at: r.created_at,
    wallet_balance_idr: r.wallet_balance_idr ?? 0,
  });
}
