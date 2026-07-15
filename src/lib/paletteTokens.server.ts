// Server-only helpers for the palette system. Kept separate from
// `paletteTokens.ts` because that file is imported from Client
// Components (CanteenHeroWow, CanteenBottomNav) for the PaletteTokens
// type — pulling supabaseAdmin into the client bundle triggers a
// server-only build error.

import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import {
  DEFAULT_PALETTE,
  getPaletteTokens,
  type PaletteTokens
} from "./paletteTokens";

/** Reads palette_slug off the merchant's listing row and returns the
 *  resolved tokens. Falls back to Chalk on any error or missing row so
 *  canteens always render. */
export async function loadMerchantPalette(merchantSlug: string): Promise<PaletteTokens> {
  try {
    const res = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("palette_slug")
      .eq("slug", merchantSlug)
      .maybeSingle();
    const slug =
      typeof res.data?.palette_slug === "string" ? res.data.palette_slug : null;
    return getPaletteTokens(slug);
  } catch {
    return DEFAULT_PALETTE;
  }
}
