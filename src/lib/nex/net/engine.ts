// Network snapshot builder — composes trust + collaborations +
// referrals for a specific merchant.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildTrustProfile } from "./trust";
import { findCollaborators } from "./collaborations";
import { findReferralOpportunities } from "./referrals";
import type { NetworkSnapshot } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { snapshot: NetworkSnapshot; expiresAt: number }>();
export function _clearNetCache(): void { cache.clear(); }

const UNAVAILABLE_TODAY = [
  "Apprentice registry (no source table).",
  "Manufacturer directory (no source table).",
  "Training providers (no source table).",
  "Grants + tenders (no source table).",
  "Local-authority contacts (no source table).",
  "Cross-merchant live availability (no calendar-share source yet).",
  "Auto-introduce merchants + auto-share documents (approval workflow — surface, don't auto-send)."
];

export type BuildNetworkSnapshotInput = {
  merchantSlug: string;
  now?:         Date;
  refresh?:     boolean;
};

export type BuildNetworkSnapshotResult =
  | { ok: true;  snapshot: NetworkSnapshot }
  | { ok: false; reason: "merchant_not_found" };

export async function buildNetworkSnapshot(opts: BuildNetworkSnapshotInput): Promise<BuildNetworkSnapshotResult> {
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

  const errors: NetworkSnapshot["errors"] = [];
  const [trust, collaborators, referrals] = await Promise.all([
    tryRun("trust",         () => buildTrustProfile({ merchantSlug: opts.merchantSlug, merchantListingId, now }), errors),
    tryRun("collaborations", () => findCollaborators({ merchantListingId }),                                      errors),
    tryRun("referrals",     () => findReferralOpportunities({ merchantId, now }),                                errors)
  ]);

  const snapshot: NetworkSnapshot = {
    computed_at:    now.toISOString(),
    merchant_slug:  opts.merchantSlug,
    trust:          trust ?? {
      slug: opts.merchantSlug, display_name: opts.merchantSlug, overall_score: 0, band: "critical",
      signals: {
        reviews:     { score: null, weight: 2,   note: "Trust module failed." },
        completions: { score: null, weight: 1.5, note: "Trust module failed." },
        reliability: { score: null, weight: 1,   note: "Trust module failed." },
        tenure:      { score: null, weight: 0.5, note: "Trust module failed." }
      },
      evidence: { source: "engine error", tables: [], computed_at: now.toISOString() }
    },
    collaborators:  collaborators ?? [],
    referrals:      referrals ?? [],
    unavailable:    UNAVAILABLE_TODAY,
    errors
  };

  cache.set(cacheKey, { snapshot, expiresAt: now.getTime() + CACHE_TTL_MS });
  return { ok: true, snapshot };
}

async function tryRun<T>(name: string, fn: () => Promise<T>, errors: NetworkSnapshot["errors"]): Promise<T | null> {
  try { return await fn(); }
  catch (err) {
    errors.push({ module: name, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
