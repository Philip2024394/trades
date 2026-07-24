// Merchant defaults resolver.
//
// Tries per-merchant overrides first, then engine fallbacks. The
// source field records where each value came from so callers can
// show the user "labour rate £45/h (your default)" vs "labour rate
// £45/h (engine default — set yours in Studio → Rates)".
//
// No dedicated merchant_estimating_defaults table exists yet; when
// one lands, drop the query in loadMerchantDefaults() — the rest of
// the pipeline is agnostic. Until then a merchant can pass overrides
// per-estimate and the answer is honest about the source.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { EstimateContext, MerchantDefaults } from "./types";

/** Sensible UK-baseline engine defaults. Every trade uses the same
 *  numbers so the answer is consistent when a merchant hasn't set
 *  their own. */
export const ENGINE_DEFAULTS: Omit<MerchantDefaults, "source"> = {
  labour_rate_pence_per_hour: 4500,   // £45/hour blended
  overhead_pct:               12,      // 12% overhead on cost
  profit_margin_pct:          20,      // 20% profit markup on (cost + overhead)
  default_waste_pct:          10,      // 10% material waste
  vat_pct:                    20,      // UK standard VAT
  currency:                   "GBP",
  region:                     "UK"
};

/** Resolve defaults for this estimate. Precedence:
 *   1. ctx.overrides (per-estimate)
 *   2. merchant listing / settings row (if present)
 *   3. ENGINE_DEFAULTS
 */
export async function resolveMerchantDefaults(ctx: EstimateContext): Promise<MerchantDefaults> {
  const overrides = ctx.overrides ?? {};
  const merchant  = ctx.merchantSlug ? await loadMerchantDefaults(ctx.merchantSlug) : null;

  // Phase 20 — location-driven VAT/GST rate + region.
  // When no explicit override, ask the World location resolver for
  // the merchant's country and pull the correct rate + region label
  // from the region config. Keeps regulations + currency + VAT in sync.
  let regionDerivedVat: number | undefined;
  let regionDerivedRegion: string | undefined;
  if (overrides.vat_pct === undefined && !(merchant && merchant.vat_pct !== undefined) && ctx.merchantSlug) {
    try {
      const { resolveLocation }    = await import("../world/location");
      const { regionConfigFor }    = await import("../world/region");
      const loc = await resolveLocation({ merchantSlug: ctx.merchantSlug });
      const cfg = regionConfigFor(loc.country);
      if (loc.country !== "unknown") {
        regionDerivedVat    = cfg.vat_or_gst_rate;
        regionDerivedRegion = cfg.country_label;
      }
    } catch {
      // Silent — fall back to ENGINE_DEFAULTS.vat_pct below.
    }
  }

  const pick = <K extends keyof Omit<MerchantDefaults, "source" | "currency" | "region">>(key: K): { value: MerchantDefaults[K]; source: "merchant" | "engine" } => {
    if (overrides[key] !== undefined) return { value: overrides[key] as MerchantDefaults[K], source: "merchant" };
    if (merchant && merchant[key] !== undefined) return { value: merchant[key] as MerchantDefaults[K], source: "merchant" };
    return { value: ENGINE_DEFAULTS[key], source: "engine" };
  };

  const labourRate = pick("labour_rate_pence_per_hour");
  const overhead   = pick("overhead_pct");
  const profit     = pick("profit_margin_pct");
  const waste      = pick("default_waste_pct");
  const vat        = regionDerivedVat !== undefined
    ? { value: regionDerivedVat, source: "merchant" as const }
    : pick("vat_pct");

  return {
    labour_rate_pence_per_hour: labourRate.value,
    overhead_pct:               overhead.value,
    profit_margin_pct:          profit.value,
    default_waste_pct:          waste.value,
    vat_pct:                    vat.value,
    currency:                   "GBP",
    region:                     overrides.region ?? merchant?.region ?? regionDerivedRegion ?? ENGINE_DEFAULTS.region,
    source: {
      labour_rate:   labourRate.source,
      overhead:      overhead.source,
      profit_margin: profit.source,
      default_waste: waste.source,
      vat:           vat.source
    }
  };
}

/** Read whatever merchant-specific defaults exist today. If no source
 *  is available for a field, return undefined so the resolver falls
 *  back cleanly. Never fabricates.
 *
 *  Currently reads no columns — the listing doesn't hold estimating
 *  defaults today. This function exists so wiring a
 *  hammerex_nex_estimating_defaults table later means changing ONLY
 *  this file. */
async function loadMerchantDefaults(_merchantSlug: string): Promise<Partial<MerchantDefaults> | null> {
  // Placeholder for future merchant-defaults table. Kept as a function
  // (not inlined) so a future migration + query lands here.
  void _merchantSlug;
  void supabaseAdmin;
  return null;
}
