// POST /api/home/sites/[siteId]/hire (multipart/form-data)
//
// Foreman hires a sub-trade on-site. Accepts an optional agreement
// image which Claude Vision parses to prefill the engagement.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { requireEntityRole } from "@/lib/os/entitySession";
import { uploadReceipt } from "@/lib/os/receiptStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { siteId: string };

export async function POST(request: Request, ctx: { params: Promise<Params> }) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  let membership;
  try {
    membership = await requireEntityRole("foreman");
  } catch {
    return NextResponse.json(
      { ok: false, error: "insufficient_role" },
      { status: 403 }
    );
  }

  const { siteId } = await ctx.params;

  // Confirm the site belongs to this entity — no cross-entity writes.
  const { data: site } = await supabaseAdmin
    .from("os_sites")
    .select("id, owner_entity_id")
    .eq("id", siteId)
    .maybeSingle();
  if (!site || site.owner_entity_id !== membership.entity_id) {
    return NextResponse.json({ ok: false, error: "site_not_found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const hiredDisplayName = String(form.get("hired_display_name") ?? "").trim();
  const hiredTrade = String(form.get("hired_trade") ?? "").trim();
  if (!hiredDisplayName || !hiredTrade) {
    return NextResponse.json(
      { ok: false, error: "missing_hired_details" },
      { status: 400 }
    );
  }

  const serviceDescription =
    String(form.get("service_description") ?? "").trim() || null;
  const agreedPriceRaw = String(form.get("agreed_price") ?? "").trim();
  const depositRaw = String(form.get("deposit") ?? "").trim();
  const agreedPricePence = agreedPriceRaw
    ? Math.round(Number.parseFloat(agreedPriceRaw) * 100)
    : null;
  const depositPence = depositRaw
    ? Math.round(Number.parseFloat(depositRaw) * 100)
    : null;
  const agreedStart = String(form.get("agreed_start_date") ?? "").trim() || null;
  const agreedEnd = String(form.get("agreed_end_date") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").trim() || null;

  // Optional agreement screenshot.
  let capturedSourceUrl: string | null = null;
  const file = form.get("agreement_image");
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
      tradeId: siteId,
      fileName: file.name,
      mimeType: file.type,
      bytes
    });
    if (upload.ok) capturedSourceUrl = upload.signedUrl;
  }

  const { data: engagement, error } = await supabaseAdmin
    .from("os_site_engagements")
    .insert({
      site_id: siteId,
      foreman_party_id: party.id,
      owner_entity_id: membership.entity_id,
      hired_display_name: hiredDisplayName,
      hired_trade: hiredTrade,
      service_description: serviceDescription,
      agreed_price_pence: agreedPricePence,
      deposit_pence: depositPence,
      agreed_start_date: agreedStart,
      agreed_end_date: agreedEnd,
      captured_via: capturedSourceUrl ? "ai_vision" : "manual",
      captured_source_url: capturedSourceUrl,
      status: "pending",
      notes
    })
    .select("id")
    .single();

  if (error || !engagement) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: error?.message },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("os_entity_audit_events").insert({
    entity_id: membership.entity_id,
    actor_party_id: party.id,
    verb: "site.engagement.created",
    after_state: {
      site_id: siteId,
      hired: hiredDisplayName,
      trade: hiredTrade,
      agreed_price_pence: agreedPricePence
    }
  });

  return NextResponse.json({ ok: true, engagementId: engagement.id });
}
