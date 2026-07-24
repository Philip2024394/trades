// Supply Chain snapshot builder — composes shopping list + waste +
// supplier profiles into one snapshot. Alternatives and delivery
// suggestions are per-query and stay off the snapshot to keep it
// small.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildShoppingList } from "./shopping_list";
import { buildSupplierProfiles } from "./suppliers";
import { buildWaste } from "./waste";
import type { SupplyChainSnapshot } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { snapshot: SupplyChainSnapshot; expiresAt: number }>();

export function _clearScCache(): void { cache.clear(); }

export type BuildSCInput = {
  merchantSlug: string;
  windowDays?:  number;      // shopping list window (default 14)
  wasteWindowDays?: number;  // waste window       (default 90)
  now?:         Date;
  refresh?:     boolean;
};

export type BuildSCResult =
  | { ok: true;  snapshot: SupplyChainSnapshot }
  | { ok: false; reason: "merchant_not_found" };

const UNAVAILABLE_TODAY = [
  "Live stock / inventory levels (no inventory table yet).",
  "Live supplier prices + availability (no supplier catalogue yet).",
  "Delivery tracking (no shipping integration yet).",
  "Hire equipment register (no hire table yet).",
  "Barcode / QR scanning (no scanner integration yet).",
  "Auto-generated purchase orders (approval workflow — surface recommendations, don't auto-execute)."
];

export async function buildSCSnapshot(opts: BuildSCInput): Promise<BuildSCResult> {
  const now      = opts.now ?? new Date();
  const hourKey  = now.toISOString().slice(0, 13);
  const cacheKey = `${opts.merchantSlug}|${hourKey}`;
  if (!opts.refresh) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > now.getTime()) return { ok: true, snapshot: hit.snapshot };
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", opts.merchantSlug)
    .maybeSingle();
  if (!listing.data) return { ok: false, reason: "merchant_not_found" };
  const merchantListingId = String(listing.data.id);
  const merchantId = merchantListingId;

  const errors: SupplyChainSnapshot["errors"] = [];
  const [shopping, waste, suppliers] = await Promise.all([
    tryRun("shopping_list", () => buildShoppingList({ merchantId, windowDays: opts.windowDays, now }), errors),
    tryRun("waste",         () => buildWaste({ merchantId, merchantListingId, windowDays: opts.wasteWindowDays, now }), errors),
    tryRun("suppliers",     () => buildSupplierProfiles({ merchantListingId, now }), errors)
  ]);

  const snapshot: SupplyChainSnapshot = {
    computed_at:    now.toISOString(),
    merchant_slug:  opts.merchantSlug,
    shopping_list:  shopping  ?? { window_days: opts.windowDays ?? 14, jobs_count: 0, lines: [], total_pence: 0, warnings: ["Shopping-list module failed."], evidence: { source: "engine error", tables: [], computed_at: now.toISOString() } },
    waste:          waste     ?? { window_days: opts.wasteWindowDays ?? 90, projects: [], total_variance_pence: 0, average_variance_pct: null, warnings: ["Waste module failed."], evidence: { source: "engine error", tables: [], computed_at: now.toISOString() } },
    suppliers:      suppliers ?? { window_days: 180, suppliers: [], warnings: ["Suppliers module failed."], evidence: { source: "engine error", tables: [], computed_at: now.toISOString() } },
    unavailable:    UNAVAILABLE_TODAY,
    errors
  };

  cache.set(cacheKey, { snapshot, expiresAt: now.getTime() + CACHE_TTL_MS });
  return { ok: true, snapshot };
}

async function tryRun<T>(name: string, fn: () => Promise<T>, errors: SupplyChainSnapshot["errors"]): Promise<T | null> {
  try { return await fn(); }
  catch (err) {
    errors.push({ module: name, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
