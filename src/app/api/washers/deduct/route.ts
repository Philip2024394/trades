// POST /api/washers/deduct
//
// Fires from VerifiedContactModal the moment a visitor presses Send.
// Deducts a washer from the merchant's bag (or honours the 30-day
// idempotency rule and skips), then returns the new balance so the
// client can toast / gate future behaviour.
//
// Backend now writes real DB rows. See src/lib/washers.ts for the
// atomic bag decrement + transaction log helpers, and
// supabase/migrations/20260719120000_washers.sql for the schema.
//
// Still TODO:
//   - Fire push / email notification to the merchant so they know a
//     lead came in even if they miss the WhatsApp message.
//   - Anti-spam guardrails: URL block in guestComment, IP throttle
//     before hitting DB (rate limit).
//   - When balance hits auto-topup threshold, kick the Stripe
//     top-up charge via a background worker.

import { NextResponse } from "next/server";
import { deductOneWasher, hashPhone } from "@/lib/washers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  merchantSlug?: unknown;
  source?: unknown;
  sourceLabel?: unknown;
  guestName?: unknown;
  guestWhatsapp?: unknown;
  guestComment?: unknown;
};

export async function POST(req: Request) {
  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const merchantSlug = typeof payload.merchantSlug === "string" ? payload.merchantSlug.trim() : "";
  const source = typeof payload.source === "string" ? payload.source : "";
  const sourceLabel = typeof payload.sourceLabel === "string" ? payload.sourceLabel : "";
  const guestName = typeof payload.guestName === "string" ? payload.guestName.trim() : "";
  const guestWa = typeof payload.guestWhatsapp === "string" ? payload.guestWhatsapp.trim() : "";
  const guestComment = typeof payload.guestComment === "string" ? payload.guestComment.trim() : "";

  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "missing-merchant-slug" }, { status: 400 });
  }
  if (guestName.length < 2 || guestWa.replace(/[^0-9]/g, "").length < 7 || guestComment.length < 4) {
    return NextResponse.json({ ok: false, error: "invalid-fields" }, { status: 400 });
  }

  const guestPhoneHash = hashPhone(guestWa);
  const result = await deductOneWasher({
    merchantSlug,
    guestPhoneHash,
    source,
    detail: {
      sourceLabel,
      guestName,
      guestComment
    }
  });

  if (!result.ok) {
    // Surface the reason but never expose internal db-error messages
    // to the client — they get a generic 500 while the log carries
    // the detail.
    // eslint-disable-next-line no-console
    console.error("[washers.deduct] failed", { merchantSlug, reason: result.reason, message: result.message });
    return NextResponse.json(
      { ok: false, error: result.reason },
      { status: result.reason === "merchant-not-found" ? 404 : 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: result.idempotent ? "idempotent-skip" : "deducted",
    balance: result.balance,
    idempotent: result.idempotent,
    transactionId: result.transactionId
  });
}
