// POST /api/trade-off/payments/byo-disconnect — merchant removes a
// gateway. Wipes ONLY that provider's credentials, keeps other
// providers intact.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  slug: string;
  token: string;
  provider: "stripe" | "paypal" | "square";
};

const STRIPE_KEYS = [
  "stripe_key_encrypted",
  "stripe_key_mode",
  "stripe_account_id",
  "stripe_account_name",
  "stripe_country",
  "stripe_charges_enabled",
  "stripe_status",
  "stripe_saved_at"
];
const PAYPAL_KEYS = [
  "paypal_client_id",
  "paypal_client_secret_encrypted",
  "paypal_env",
  "paypal_status",
  "paypal_saved_at"
];
const SQUARE_KEYS = [
  "square_access_token_encrypted",
  "square_location_id",
  "square_location_name",
  "square_merchant_id",
  "square_country",
  "square_env",
  "square_status",
  "square_saved_at"
];

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, payment_provider_data, payment_provider")
    .eq("slug", body.slug)
    .maybeSingle();
  if (!row.data) return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  if (row.data.edit_token !== body.token) {
    return NextResponse.json({ error: "bad_token" }, { status: 403 });
  }
  const data = { ...((row.data.payment_provider_data ?? {}) as Record<string, unknown>) };
  const keys =
    body.provider === "stripe" ? STRIPE_KEYS
    : body.provider === "paypal" ? PAYPAL_KEYS
    : body.provider === "square" ? SQUARE_KEYS
    : [];
  for (const k of keys) delete data[k];
  const activeProvider =
    row.data.payment_provider === body.provider ? null : row.data.payment_provider;
  await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ payment_provider_data: data, payment_provider: activeProvider })
    .eq("id", row.data.id);
  return NextResponse.json({ ok: true });
}
