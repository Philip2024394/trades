// POST /api/home/trades/[tradeId]/pay
//
// multipart/form-data. Owner uploads a receipt image + payment fields.
// We upload to Supabase Storage, optionally run Claude Vision to
// prefill/verify, and write to os_project_payments.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { loadActiveMembership } from "@/lib/os/entitySession";
import { uploadReceipt } from "@/lib/os/receiptStorage";
import { extractReceipt } from "@/lib/os/receiptVision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { tradeId: string };

export async function POST(
  request: Request,
  ctx: { params: Promise<Params> }
) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  const membership = await loadActiveMembership();

  const { tradeId } = await ctx.params;

  // Resolve the trade (hammerex listing) and the mirrored OS business row.
  const { data: trade } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name")
    .eq("id", tradeId)
    .maybeSingle();
  if (!trade) {
    return NextResponse.json({ ok: false, error: "trade_not_found" }, { status: 404 });
  }

  const { data: osBusiness } = await supabaseAdmin
    .from("os_business_listings")
    .select("id")
    .eq("slug", trade.slug)
    .maybeSingle();
  if (!osBusiness) {
    return NextResponse.json(
      { ok: false, error: "trade_not_synced_yet" },
      { status: 409 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const amountStr = String(form.get("amount") ?? "").trim();
  const amountPounds = Number.parseFloat(amountStr);
  if (!Number.isFinite(amountPounds) || amountPounds <= 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_amount" },
      { status: 400 }
    );
  }
  const amount_pence = Math.round(amountPounds * 100);

  const paymentType = String(form.get("payment_type") ?? "other");
  const method = String(form.get("method") ?? "bank_transfer");
  const paidAtIso = String(form.get("paid_at") ?? new Date().toISOString().slice(0, 10));
  const notes = String(form.get("notes") ?? "").trim() || null;

  const materialsRaw = String(form.get("materials_amount") ?? "").trim();
  const labourRaw = String(form.get("labour_amount") ?? "").trim();
  const materials_amount_pence = materialsRaw
    ? Math.round(Number.parseFloat(materialsRaw) * 100)
    : null;
  const labour_amount_pence = labourRaw
    ? Math.round(Number.parseFloat(labourRaw) * 100)
    : null;

  // Optional receipt upload.
  let receiptUrl: string | null = null;
  let aiParsed: unknown = null;
  const file = form.get("receipt");
  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: "file_too_large" },
        { status: 413 }
      );
    }
    const bytes = await file.arrayBuffer();
    const upload = await uploadReceipt({
      partyId: party.id,
      tradeId: tradeId,
      fileName: file.name,
      mimeType: file.type,
      bytes
    });
    if (!upload.ok) {
      return NextResponse.json(
        { ok: false, error: upload.error },
        { status: 500 }
      );
    }
    receiptUrl = upload.signedUrl;

    // Best-effort AI extraction — never fail the payment on parse issues.
    try {
      const vision = await extractReceipt({ bytes, mimeType: file.type });
      if (vision.ok) aiParsed = vision.extraction;
    } catch {
      /* swallow */
    }
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("os_project_payments")
    .insert({
      project_id: null,
      from_party_id: party.id,
      paying_entity_id: membership?.entity_id ?? null,
      to_business_id: osBusiness.id,
      amount_pence,
      currency: "GBP",
      payment_method: method,
      payment_type: paymentType,
      materials_amount_pence,
      labour_amount_pence,
      receipt_screenshot_url: receiptUrl,
      receipt_parse_source: aiParsed ? "ai_vision" : "manual",
      notes,
      status: "recorded",
      paid_at: new Date(paidAtIso + "T00:00:00Z").toISOString(),
      homeowner_confirmed_at: new Date().toISOString(),
      homeowner_confirmed_by_party_id: party.id
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    paymentId: inserted.id,
    ai_parsed: aiParsed
  });
}
