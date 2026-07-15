// POST /api/washers/spam-flag
//
// Merchant-facing endpoint — fires from the "Flag as spam" button on
// each deduct row in the washers page. Records a refund request in
// hammerex_washer_spam_flags with status='pending'. Admin reviews in
// /admin/red-zone and either approves (refunds the washer via a
// refund transaction) or denies (leaves the deduction).
//
// We verify the transaction actually belongs to the claimed merchant
// so a client can't flag someone else's transactions.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  transactionId?: unknown;
  merchantSlug?: unknown;
  reason?: unknown;
};

export async function POST(req: Request) {
  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const transactionId = typeof payload.transactionId === "string" ? payload.transactionId.trim() : "";
  const merchantSlug  = typeof payload.merchantSlug  === "string" ? payload.merchantSlug.trim()  : "";
  const reason        = typeof payload.reason        === "string" ? payload.reason.trim()        : "";

  if (!transactionId || !merchantSlug || reason.length < 4) {
    return NextResponse.json({ ok: false, error: "invalid-fields" }, { status: 400 });
  }

  // Resolve merchant listing id, verify the transaction belongs to
  // that merchant AND is a deduct row (only deducts are flaggable).
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", merchantSlug)
    .maybeSingle();
  if (listing.error || !listing.data) {
    return NextResponse.json({ ok: false, error: "merchant-not-found" }, { status: 404 });
  }
  const listingId = listing.data.id as string;

  const tx = await supabaseAdmin
    .from("hammerex_washer_transactions")
    .select("id, listing_id, kind, detail")
    .eq("id", transactionId)
    .maybeSingle();
  if (tx.error || !tx.data) {
    return NextResponse.json({ ok: false, error: "transaction-not-found" }, { status: 404 });
  }
  if (tx.data.listing_id !== listingId) {
    return NextResponse.json({ ok: false, error: "not-your-transaction" }, { status: 403 });
  }
  if (tx.data.kind !== "deduct") {
    return NextResponse.json({ ok: false, error: "not-a-deduct" }, { status: 400 });
  }

  // Prevent double-flagging: a merchant can't flag the same tx twice.
  const existing = await supabaseAdmin
    .from("hammerex_washer_spam_flags")
    .select("id, status")
    .eq("transaction_id", transactionId)
    .maybeSingle();
  if (existing.data) {
    return NextResponse.json({
      ok: true,
      status: "already-flagged",
      flagStatus: existing.data.status,
      flagId: existing.data.id
    });
  }

  const detail = (tx.data.detail as Record<string, unknown> | null) ?? {};
  const guestPhoneHash = typeof detail.guestPhoneHash === "string" ? detail.guestPhoneHash : null;

  const insert = await supabaseAdmin
    .from("hammerex_washer_spam_flags")
    .insert({
      listing_id: listingId,
      transaction_id: transactionId,
      merchant_reason: reason,
      guest_phone_hash: guestPhoneHash,
      status: "pending"
    })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    return NextResponse.json(
      { ok: false, error: "db-error", message: insert.error?.message ?? "insert-failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: "pending",
    flagId: insert.data.id
  });
}
