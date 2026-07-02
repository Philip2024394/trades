// Studio session — cookie helpers + merchant/brand loaders.
//
// Auth model for the workspace: the merchant clicks a magic link
// `https://xratedtrade.com/studio?enter=<edit_token>`. The entry route
// validates the token, stores it in an HttpOnly cookie, and redirects
// to /studio/home. Every gated route reads the cookie and loads the
// merchant + default brand once at layout render.
//
// The token IS the session — no additional server-side session store
// needed. Rotating a merchant's edit_token invalidates every open tab
// immediately. This mirrors the existing `/trade-off/edit/*` auth
// pattern, so a merchant can move between the legacy dashboard and the
// new Studio without a fresh magic link.

import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const STUDIO_COOKIE_NAME = "studio_session";
const COOKIE_MAX_AGE_SECS = 60 * 60 * 24 * 30; // 30 days

export type StudioMerchant = {
  id: string;
  slug: string;
  display_name: string;
  avatar_url: string | null;
  primary_trade: string;
  city: string;
};

export type StudioBrand = {
  id: string;
  merchant_id: string;
  name: string;
  slug: string;
  is_default: boolean;
};

export type StudioSession = {
  token: string;
  merchant: StudioMerchant;
  brand: StudioBrand;
};

// ─── Cookie primitives ────────────────────────────────────────────

export async function setStudioSession(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(STUDIO_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_SECS,
    path: "/"
  });
}

export async function clearStudioSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(STUDIO_COOKIE_NAME);
}

async function readStudioToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(STUDIO_COOKIE_NAME)?.value ?? null;
}

// ─── Session loader ───────────────────────────────────────────────

/** Loads the current session (merchant + default brand) or returns
 *  null. The layout uses `null` as its redirect signal — no throwing,
 *  no partial state. */
export async function loadStudioSession(): Promise<StudioSession | null> {
  const token = await readStudioToken();
  if (!token) return null;

  const merchantRes = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, avatar_url, primary_trade, city")
    .eq("edit_token", token)
    .maybeSingle();

  if (!merchantRes.data) return null;
  const merchant = merchantRes.data as StudioMerchant;

  // Every merchant should have a default brand from the 0.1 backfill.
  // If somehow missing (e.g. brand deleted manually), auto-create so
  // the shell never renders in a brand-less state.
  let brandRes = await supabaseAdmin
    .from("studio_brands")
    .select("id, merchant_id, name, slug, is_default")
    .eq("merchant_id", merchant.id)
    .eq("is_default", true)
    .maybeSingle();

  if (!brandRes.data) {
    const created = await supabaseAdmin
      .from("studio_brands")
      .insert({
        merchant_id: merchant.id,
        name: "Main brand",
        slug: "main",
        is_default: true
      })
      .select("id, merchant_id, name, slug, is_default")
      .maybeSingle();
    if (!created.data) return null;
    brandRes = created;
  }

  return {
    token,
    merchant,
    brand: brandRes.data as StudioBrand
  };
}

// ─── Token validation (used by entry route) ───────────────────────

/** Return the merchant if the token matches a real edit_token, else
 *  null. Does NOT set the cookie — the entry route decides when. */
export async function validateEntryToken(
  token: string
): Promise<StudioMerchant | null> {
  if (!token) return null;
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, avatar_url, primary_trade, city")
    .eq("edit_token", token)
    .maybeSingle();
  return (res.data as StudioMerchant | null) ?? null;
}
