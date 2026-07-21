// Analytics Engine + Marketplace Liquidity Engine · unified track helper.
//
// Every product calls track() or trackLiquidity(). The events land in
// hammerex_events and power every dashboard (War Room, Network Health,
// Coverage Map, Growth Engine, Revenue Centre).
//
// FIRE-AND-FORGET: never throws, never blocks the parent action.
// Analytics failure must not break user-facing flow (Rule 3).

import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ─── Types ─────────────────────────────────────────────────────────

export type ActorKind =
  | "homeowner"
  | "trade"
  | "merchant"
  | "admin"
  | "system"
  | "guest"
  | "scheduled";

/** The 7 stages of the Marketplace Liquidity Engine.
 *  Every product's lifecycle maps to these. */
export type LifecycleStage =
  | "demand_created"
  | "supply_available"
  | "supply_contacted"
  | "supply_responded"
  | "match_created"
  | "match_completed"
  | "revenue_generated";

/** Product namespace — matches the platform's canonical products. */
export type ProductSlug =
  | "sitebook"
  | "yard"
  | "trade_center"
  | "canteen"
  | "auth"
  | "billing"
  | "referral"
  | "shadow_scraper"
  | "admin"
  | "system";

export type TrackEvent = {
  /** Product-specific verb, e.g. "sitebook.post_created" */
  slug:             string;
  product:          ProductSlug;
  lifecycleStage?:  LifecycleStage | null;

  actorKind:        ActorKind;
  actorId?:         string | null;
  actorDisplay?:    string | null;

  targetKind?:      string | null;
  targetId?:        string | null;
  targetDisplay?:   string | null;

  city?:            string | null;
  postcodeArea?:    string | null;
  tradeCategory?:   string | null;

  revenuePence?:    number | null;
  revenueCurrency?: string;

  acquisitionChannel?: string | null;
  metadata?:        Record<string, unknown> | null;
  occurredAt?:      string;      // ISO — defaults to NOW()
};

// ─── Core track (Analytics Engine) ─────────────────────────────────

/** Log an event to the analytics store. Fire-and-forget. */
export async function track(evt: TrackEvent): Promise<void> {
  try {
    const res = await supabaseAdmin
      .from("hammerex_events")
      .insert({
        event_slug:          evt.slug,
        product:             evt.product,
        lifecycle_stage:     evt.lifecycleStage ?? null,
        actor_kind:          evt.actorKind,
        actor_id:            evt.actorId       ?? null,
        actor_display:       evt.actorDisplay  ?? null,
        target_kind:         evt.targetKind    ?? null,
        target_id:           evt.targetId      ?? null,
        target_display:      evt.targetDisplay ?? null,
        city:                evt.city          ? evt.city.toLowerCase().trim() : null,
        postcode_area:       evt.postcodeArea  ? evt.postcodeArea.toUpperCase().trim() : null,
        trade_category:      evt.tradeCategory ? evt.tradeCategory.toLowerCase().trim() : null,
        revenue_pence:       evt.revenuePence  ?? null,
        revenue_currency:    evt.revenueCurrency ?? "GBP",
        acquisition_channel: evt.acquisitionChannel ?? null,
        metadata:            evt.metadata      ?? null,
        occurred_at:         evt.occurredAt    ?? new Date().toISOString()
      });
    if (res.error) {
      console.error("[analytics] insert failed:", res.error.message, evt.slug);
    }
  } catch (err) {
    console.error("[analytics] threw:", err, evt.slug);
  }
}

// ─── Liquidity Engine convenience ──────────────────────────────────

/** Same as track() but REQUIRES a lifecycleStage. Use this at every
 *  marketplace-lifecycle-relevant emission point. Compile-time enforcement
 *  that the event contributes to War Room + Network Health metrics. */
export async function trackLiquidity(evt: Omit<TrackEvent, "lifecycleStage"> & {
  lifecycleStage: LifecycleStage;
}): Promise<void> {
  return track(evt);
}

// ─── Read helpers (for War Room · Network Health · Coverage) ──────

/** Count events by slug in a time window. Cheap. */
export async function countEvents(
  slug: string,
  fromIso: string,
  toIso?: string
): Promise<number> {
  const q = supabaseAdmin
    .from("hammerex_events")
    .select("id", { count: "exact", head: true })
    .eq("event_slug", slug)
    .gte("occurred_at", fromIso);
  if (toIso) q.lte("occurred_at", toIso);
  const res = await q;
  return res.count ?? 0;
}

/** Count events at a lifecycle stage in a time window. */
export async function countLiquidityStage(
  stage: LifecycleStage,
  fromIso: string,
  toIso?: string,
  product?: ProductSlug
): Promise<number> {
  const q = supabaseAdmin
    .from("hammerex_events")
    .select("id", { count: "exact", head: true })
    .eq("lifecycle_stage", stage)
    .gte("occurred_at", fromIso);
  if (toIso)   q.lte("occurred_at", toIso);
  if (product) q.eq("product", product);
  const res = await q;
  return res.count ?? 0;
}

/** Sum revenue in pence over a time window. */
export async function sumRevenuePence(fromIso: string, toIso?: string): Promise<number> {
  const q = supabaseAdmin
    .from("hammerex_events")
    .select("revenue_pence")
    .eq("lifecycle_stage", "revenue_generated")
    .gte("occurred_at", fromIso);
  if (toIso) q.lte("occurred_at", toIso);
  const res = await q;
  const rows = (res.data as { revenue_pence: number | null }[]) ?? [];
  return rows.reduce((sum, r) => sum + (r.revenue_pence ?? 0), 0);
}

/** Group counts by city for a given event slug + window. */
export async function countByCity(
  slug: string,
  fromIso: string
): Promise<Array<{ city: string; count: number }>> {
  const res = await supabaseAdmin
    .from("hammerex_events")
    .select("city")
    .eq("event_slug", slug)
    .gte("occurred_at", fromIso)
    .not("city", "is", null);
  const rows = (res.data as { city: string | null }[]) ?? [];
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.city) continue;
    counts.set(r.city, (counts.get(r.city) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
}

/** Group counts by trade category for a given event slug + window. */
export async function countByTradeCategory(
  slug: string,
  fromIso: string
): Promise<Array<{ tradeCategory: string; count: number }>> {
  const res = await supabaseAdmin
    .from("hammerex_events")
    .select("trade_category")
    .eq("event_slug", slug)
    .gte("occurred_at", fromIso)
    .not("trade_category", "is", null);
  const rows = (res.data as { trade_category: string | null }[]) ?? [];
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.trade_category) continue;
    counts.set(r.trade_category, (counts.get(r.trade_category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tradeCategory, count]) => ({ tradeCategory, count }))
    .sort((a, b) => b.count - a.count);
}

/** Top acquisition channel by signup count in window. */
export async function topAcquisitionChannel(
  fromIso: string
): Promise<{ channel: string; count: number } | null> {
  const res = await supabaseAdmin
    .from("hammerex_events")
    .select("acquisition_channel")
    .in("event_slug", ["homeowner.signup", "trade.signup", "merchant.signup"])
    .gte("occurred_at", fromIso)
    .not("acquisition_channel", "is", null);
  const rows = (res.data as { acquisition_channel: string | null }[]) ?? [];
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.acquisition_channel) continue;
    counts.set(r.acquisition_channel, (counts.get(r.acquisition_channel) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;
  return { channel: sorted[0][0], count: sorted[0][1] };
}
