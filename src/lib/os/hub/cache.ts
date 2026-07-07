// Business Hub cache — read + write + event-driven invalidation.
//
// Contract:
//   loadHubSnapshotWithCache(merchantId)
//     Fast path: if a fresh snapshot exists (not stale, TTL not passed),
//     returns it in one query.
//     Otherwise: runs the live aggregator, persists, returns.
//
//   invalidateHubCache(merchantId, reason?)
//     Flips is_stale=true. Next read triggers a recompute. Cheap +
//     atomic — safe to call from every event subscriber.
//
// TTL as a safety net (5 minutes) — if invalidation events are missed
// for any reason the cache still refreshes at that cadence.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  loadBusinessHubSnapshot,
  type BusinessHubSnapshot
} from "@/lib/business-hub/aggregator";
import {
  generateCoachRecommendations,
  type CoachRecommendation
} from "@/lib/business-hub/coach";

const TTL_SECONDS = 300;

export type CachedHub = {
  snapshot: BusinessHubSnapshot;
  recommendations: CoachRecommendation[];
  computedAt: string;
  fromCache: boolean;
};

export async function loadHubSnapshotWithCache(
  merchantId: string
): Promise<CachedHub> {
  const { data: cached } = await supabaseAdmin
    .from("os_business_hub_snapshots")
    .select("snapshot, recommendations, is_stale, computed_at")
    .eq("merchant_id", merchantId)
    .maybeSingle();

  const fresh = cached && !cached.is_stale && isWithinTtl(cached.computed_at);
  if (fresh) {
    return {
      snapshot: cached.snapshot as BusinessHubSnapshot,
      recommendations:
        (cached.recommendations as CoachRecommendation[]) || [],
      computedAt: cached.computed_at,
      fromCache: true
    };
  }

  // Miss / stale — compute fresh and persist.
  const snapshot = await loadBusinessHubSnapshot(merchantId);
  const recommendations = generateCoachRecommendations(snapshot);
  const computedAt = new Date().toISOString();

  await supabaseAdmin.from("os_business_hub_snapshots").upsert(
    {
      merchant_id: merchantId,
      snapshot: snapshot as unknown as Record<string, unknown>,
      recommendations: recommendations as unknown as Record<string, unknown>[],
      is_stale: false,
      computed_at: computedAt,
      invalidated_at: null,
      invalidation_reason: null
    },
    { onConflict: "merchant_id" }
  );

  return {
    snapshot,
    recommendations,
    computedAt,
    fromCache: false
  };
}

export async function invalidateHubCache(
  merchantId: string,
  reason?: string
): Promise<void> {
  await supabaseAdmin
    .from("os_business_hub_snapshots")
    .update({
      is_stale: true,
      invalidated_at: new Date().toISOString(),
      invalidation_reason: reason ?? null
    })
    .eq("merchant_id", merchantId);
}

function isWithinTtl(computedAtIso: string): boolean {
  const age = (Date.now() - new Date(computedAtIso).getTime()) / 1000;
  return age <= TTL_SECONDS;
}
