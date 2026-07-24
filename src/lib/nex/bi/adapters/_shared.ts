// Shared helpers for BI adapters. Kept intentionally small — anything
// with domain knowledge belongs in the adapter, not here.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Convert a merchant slug into the trade-off listing UUID that most
 *  tables key on. Cached per-slug per-process — the listing id doesn't
 *  change so a single fetch per merchant per boot is safe. */
const listingIdCache = new Map<string, string | null>();

export async function resolveListingId(slug: string): Promise<string | null> {
  if (listingIdCache.has(slug)) return listingIdCache.get(slug) ?? null;
  const { data } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  const id = data?.id ?? null;
  listingIdCache.set(slug, id);
  return id;
}

/** Test-only reset. */
export function _clearListingIdCache(): void { listingIdCache.clear(); }

/** Compute the current + prior window ISO date strings. */
export function windows(lookbackDays: number, now: Date): {
  currentStart: string;
  currentEnd:   string;
  priorStart:   string;
  priorEnd:     string;
} {
  const dayMs = 86_400_000;
  const currentEnd   = now;
  const currentStart = new Date(now.getTime() - lookbackDays * dayMs);
  const priorEnd     = new Date(currentStart.getTime() - 1);
  const priorStart   = new Date(priorEnd.getTime() - lookbackDays * dayMs);
  return {
    currentStart: currentStart.toISOString(),
    currentEnd:   currentEnd.toISOString(),
    priorStart:   priorStart.toISOString(),
    priorEnd:     priorEnd.toISOString()
  };
}

/** % change from prior → current. Returns null when prior is zero or
 *  either value is null (avoid dividing by zero and lying with 100%). */
export function pctChange(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null) return null;
  if (prior === 0) return null;
  return Number((((current - prior) / prior) * 100).toFixed(1));
}
