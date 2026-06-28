// POST /api/trade-off/payment-methods
// Magic-link authenticated. Body: { slug, edit_token, payment_methods }.
//
// Persists the listing-level `payment_methods` array — the set of
// payment-surface keys the tradesperson advertises on their PDPs. The
// PaymentIconsRow component reads listing.payment_methods and:
//   - null OR empty array → renders the default 5 (visa, mastercard,
//     amex, apple_pay, whatsapp)
//   - non-empty            → renders ONLY those keys in the order given
//
// Whitelist: array of strings from the 8-key supported enum, max 8 entries.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const SUPPORTED_KEYS = new Set([
  "visa",
  "mastercard",
  "amex",
  "apple_pay",
  "google_pay",
  "whatsapp",
  "cash",
  "bank_transfer"
]);

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const raw = body.payment_methods;

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }

  // Normalise the payload: null / undefined / empty array all save NULL
  // so the public PDP falls back to the platform default set.
  let payment_methods: string[] | null = null;
  if (Array.isArray(raw)) {
    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
      const k = typeof item === "string" ? item.trim() : "";
      if (!SUPPORTED_KEYS.has(k)) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      cleaned.push(k);
      if (cleaned.length >= 8) break;
    }
    payment_methods = cleaned.length > 0 ? cleaned : null;
  } else if (raw !== null && raw !== undefined) {
    return NextResponse.json(
      { ok: false, error: "payment_methods must be an array or null." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ payment_methods })
    .eq("id", listing.data.id)
    .select("payment_methods")
    .maybeSingle();

  if (upd.error || !upd.data) {
    console.error("[trade-off/payment-methods] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, payment_methods: upd.data.payment_methods });
}
