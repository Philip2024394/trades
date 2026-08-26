// src/lib/nex-shop/pricing.ts
//
// NEX MARKET · Quantity Pricing (signature behaviour #2).
//
// Doctrine: absolute Rp-per-unit at qty tiers. Tier applies when qty >= minQty.
// Highest applicable minQty wins. Empty tiers = base price for all qty.
// See project_nex_market_quantity_pricing_and_bundles_2026_08_24.md.

export interface QtyPriceTier {
  minQty: number;               // integer >= 2
  pricePerUnitIdr: number;      // integer > 0 · strictly < base for the tier to save
}

export interface QuantityPricingResult {
  qty: number;
  pricePerUnitIdr: number;
  lineTotalIdr: number;
  activeTier: QtyPriceTier | null;   // null when base price applies
  savingsPerUnitIdr: number;         // >= 0
  savingsLineTotalIdr: number;       // >= 0
  nextTier: QtyPriceTier | null;     // the next tier the buyer could unlock (or null)
  unitsToNextTier: number | null;    // qty needed to reach nextTier (or null)
}

/**
 * Return the tier that applies at this quantity, or null if none does.
 * Highest applicable minQty wins.
 */
export function activeTierAt(qty: number, tiers: QtyPriceTier[]): QtyPriceTier | null {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  if (!Number.isFinite(qty) || qty < 1) return null;
  let best: QtyPriceTier | null = null;
  for (const t of tiers) {
    if (qty >= t.minQty && (best === null || t.minQty > best.minQty)) {
      best = t;
    }
  }
  return best;
}

/**
 * Effective per-unit price at a given quantity. Never returns below zero.
 * If no tier applies, returns baseIdr unchanged.
 */
export function effectivePricePerUnit(baseIdr: number, tiers: QtyPriceTier[], qty: number): number {
  const t = activeTierAt(qty, tiers);
  return t ? t.pricePerUnitIdr : baseIdr;
}

/**
 * Full quantity-pricing outcome for the buyer UI:
 *   · what they pay per unit
 *   · what they pay total for the line
 *   · how much they save vs base × qty
 *   · which tier is unlocked next (if any) and how many more units to reach it
 */
export function computeQuantityPricing(baseIdr: number, tiers: QtyPriceTier[], qty: number): QuantityPricingResult {
  const safeQty = Math.max(1, Math.floor(qty));
  const active = activeTierAt(safeQty, tiers);
  const pricePerUnitIdr = active ? active.pricePerUnitIdr : baseIdr;
  const lineTotalIdr = pricePerUnitIdr * safeQty;
  const savingsPerUnitIdr = Math.max(0, baseIdr - pricePerUnitIdr);
  const savingsLineTotalIdr = savingsPerUnitIdr * safeQty;

  // Next tier = smallest minQty strictly greater than safeQty.
  let nextTier: QtyPriceTier | null = null;
  for (const t of tiers) {
    if (t.minQty > safeQty && (nextTier === null || t.minQty < nextTier.minQty)) {
      nextTier = t;
    }
  }
  const unitsToNextTier = nextTier ? nextTier.minQty - safeQty : null;

  return { qty: safeQty, pricePerUnitIdr, lineTotalIdr, activeTier: active, savingsPerUnitIdr, savingsLineTotalIdr, nextTier, unitsToNextTier };
}

/**
 * Validate a proposed tier array before it goes to the DB. Mirrors the DB
 * CHECK constraint · triple defence (client + server + DB).
 * Returns { ok: true, tiers } on success or { ok: false, error } on failure.
 */
export function validateQtyPriceTiers(input: unknown, baseIdr: number): { ok: true; tiers: QtyPriceTier[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "Tiers must be an array" };
  const parsed: QtyPriceTier[] = [];
  for (const raw of input) {
    if (raw === null || typeof raw !== "object") return { ok: false, error: "Each tier must be an object" };
    const r = raw as Record<string, unknown>;
    const minQty = Number(r.minQty);
    const pricePerUnitIdr = Number(r.pricePerUnitIdr);
    if (!Number.isInteger(minQty) || minQty < 2) return { ok: false, error: "minQty must be an integer >= 2" };
    if (!Number.isInteger(pricePerUnitIdr) || pricePerUnitIdr <= 0) return { ok: false, error: "pricePerUnitIdr must be a positive integer" };
    if (pricePerUnitIdr >= baseIdr) return { ok: false, error: `Tier price Rp ${pricePerUnitIdr} at qty ${minQty} must be lower than base Rp ${baseIdr}` };
    parsed.push({ minQty, pricePerUnitIdr });
  }
  // Sort ascending by minQty, then check strict ascending + strict descending price.
  parsed.sort((a, b) => a.minQty - b.minQty);
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].minQty === parsed[i - 1].minQty) return { ok: false, error: `Duplicate tier for qty ${parsed[i].minQty}` };
    if (parsed[i].pricePerUnitIdr >= parsed[i - 1].pricePerUnitIdr) {
      return { ok: false, error: `Tier at qty ${parsed[i].minQty} (Rp ${parsed[i].pricePerUnitIdr}) must be cheaper than tier at qty ${parsed[i - 1].minQty} (Rp ${parsed[i - 1].pricePerUnitIdr})` };
    }
  }
  return { ok: true, tiers: parsed };
}
