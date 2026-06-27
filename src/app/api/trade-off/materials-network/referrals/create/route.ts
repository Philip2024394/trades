// POST /api/trade-off/materials-network/referrals/create
// PUBLIC endpoint (no edit-token). Called by the customer's browser when
// they tap the "Quote me" button on /<slug>/materials/<merchantSlug>.
//
// Body: { tradie_slug, merchant_slug, customer_session_id?,
//         customer_wa_e164?, customer_name?, cart_items_snapshot,
//         estimated_cart_total_pence? }
//
// Last-click 24h sticky: if the same merchant has an existing pending
// referral from the same customer_wa_hash (or session_id when no wa
// supplied) created within ATTRIBUTION_WINDOW_HOURS=24, reuse that
// ref_code instead of creating a new one. Otherwise insert a fresh
// row with a generated ref_code.
//
// Stub-notifies the merchant via hammerex_xrated_push_log
// (event_type='commission'). Lead Alerts replaces this later with a
// real web-push.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ATTRIBUTION_WINDOW_HOURS,
  generateRefCode,
  hashWhatsapp
} from "@/lib/xratedMaterialsNetwork";

export const runtime = "nodejs";

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function nonNegIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

type CartSnapshotItem = {
  name: string;
  qty: number;
  price_pence: number;
  unit?: string | null;
  variant_label?: string | null;
};

function sanitiseCartSnapshot(v: unknown): CartSnapshotItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
    .slice(0, 50)
    .map((it) => ({
      name: s(it.name).slice(0, 120) || "Item",
      qty: Math.max(1, Math.min(999, Math.round(Number(it.qty) || 1))),
      price_pence: Math.max(0, Math.round(Number(it.price_pence) || 0)),
      unit:
        typeof it.unit === "string" && it.unit.trim().length > 0
          ? it.unit.trim().slice(0, 32)
          : null,
      variant_label:
        typeof it.variant_label === "string" && it.variant_label.trim().length > 0
          ? it.variant_label.trim().slice(0, 64)
          : null
    }));
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const tradieSlug = s(body.tradie_slug);
  const merchantSlug = s(body.merchant_slug);
  if (!tradieSlug || !merchantSlug) {
    return NextResponse.json(
      { ok: false, error: "Missing tradie_slug or merchant_slug." },
      { status: 400 }
    );
  }

  const customerSessionId = s(body.customer_session_id).slice(0, 120) || null;
  const customerWaE164 = s(body.customer_wa_e164).slice(0, 32) || null;
  const customerName = s(body.customer_name).slice(0, 120) || null;
  const estimatedCart = nonNegIntOrNull(body.estimated_cart_total_pence);
  const cartItems = sanitiseCartSnapshot(body.cart_items_snapshot);

  // Resolve tradie + merchant in parallel. Both must be live; both must
  // have the relevant add-ons on (we don't create referrals that can't
  // be paid out or that point at a paused merchant chain).
  const [tradieRes, merchantRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select(
        "id, status, addons_enabled, display_name, tier, trial_expires_at"
      )
      .eq("slug", tradieSlug)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select(
        "id, status, addons_enabled, display_name, materials_network_paused"
      )
      .eq("slug", merchantSlug)
      .maybeSingle()
  ]);

  if (!tradieRes.data || tradieRes.data.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "Tradesperson not found." },
      { status: 404 }
    );
  }
  if (!merchantRes.data || merchantRes.data.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "Merchant not found." },
      { status: 404 }
    );
  }

  const tradieAddons =
    tradieRes.data.addons_enabled && typeof tradieRes.data.addons_enabled === "object"
      ? (tradieRes.data.addons_enabled as Record<string, boolean>)
      : {};
  if (tradieAddons.materials_network !== true) {
    return NextResponse.json(
      { ok: false, error: "Materials Network is not active on this profile." },
      { status: 400 }
    );
  }

  if (merchantRes.data.materials_network_paused === true) {
    return NextResponse.json(
      {
        ok: false,
        error: "This merchant has paused new referrals — message them directly."
      },
      { status: 400 }
    );
  }

  // Verify the (tradie, merchant) pair is an active pick. Without this
  // a stale link in the wild could keep firing referrals after the
  // tradie removed the merchant.
  const pickRes = await supabaseAdmin
    .from("hammerex_xrated_merchant_picks")
    .select("id")
    .eq("tradie_listing_id", tradieRes.data.id)
    .eq("merchant_listing_id", merchantRes.data.id)
    .eq("status", "live")
    .maybeSingle();
  if (!pickRes.data) {
    return NextResponse.json(
      { ok: false, error: "This merchant is no longer on the tradesperson's list." },
      { status: 400 }
    );
  }

  // Last-click 24h sticky lookup.
  const customerWaHash = customerWaE164 ? hashWhatsapp(customerWaE164) : null;
  const sinceIso = new Date(
    Date.now() - ATTRIBUTION_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  let existingRefCode: string | null = null;
  if (customerWaHash) {
    const stickyRes = await supabaseAdmin
      .from("hammerex_xrated_merchant_referrals")
      .select("ref_code, tradie_listing_id, created_at")
      .eq("merchant_listing_id", merchantRes.data.id)
      .eq("customer_wa_hash", customerWaHash)
      .eq("status", "pending")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (stickyRes.data) {
      existingRefCode = stickyRes.data.ref_code;
    }
  } else if (customerSessionId) {
    const stickyRes = await supabaseAdmin
      .from("hammerex_xrated_merchant_referrals")
      .select("ref_code, created_at")
      .eq("merchant_listing_id", merchantRes.data.id)
      .eq("customer_session_id", customerSessionId)
      .eq("status", "pending")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (stickyRes.data) {
      existingRefCode = stickyRes.data.ref_code;
    }
  }

  if (existingRefCode) {
    return NextResponse.json({
      ok: true,
      ref_code: existingRefCode,
      reused: true
    });
  }

  // Generate ref_code with retry-on-collision (extremely unlikely, but
  // we have a UNIQUE constraint backing us so it's cheap to handle).
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const refCode = generateRefCode();
    const ins = await supabaseAdmin
      .from("hammerex_xrated_merchant_referrals")
      .insert({
        ref_code: refCode,
        tradie_listing_id: tradieRes.data.id,
        merchant_listing_id: merchantRes.data.id,
        customer_session_id: customerSessionId,
        customer_wa_hash: customerWaHash,
        customer_name: customerName,
        customer_wa_e164: customerWaE164,
        cart_items_snapshot: cartItems,
        estimated_cart_total_pence: estimatedCart,
        status: "pending"
      })
      .select("ref_code")
      .maybeSingle();
    if (!ins.error && ins.data) {
      // Stub notify the merchant — Lead Alerts will replace this with a
      // real web-push delivery. The push log row is cheap insurance so
      // we never lose the signal.
      await supabaseAdmin.from("hammerex_xrated_push_log").insert({
        listing_id: merchantRes.data.id,
        event_type: "referral_pending",
        payload: {
          ref_code: refCode,
          tradie_slug: tradieSlug,
          tradie_display_name: tradieRes.data.display_name,
          estimated_pence: estimatedCart
        }
      });
      return NextResponse.json({
        ok: true,
        ref_code: refCode,
        reused: false
      });
    }
    if (ins.error?.code === "23505") {
      // ref_code collision — try again.
      lastError = "ref_code collision";
      continue;
    }
    lastError = ins.error?.message ?? "Insert failed.";
    break;
  }

  return NextResponse.json(
    { ok: false, error: lastError ?? "Failed to create referral." },
    { status: 500 }
  );
}
