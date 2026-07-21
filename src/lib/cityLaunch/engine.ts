// City Launch Engine · founder-tracked per-city liquidity initiatives.
//
// Every UK city Philip is actively growing lives here. The Coverage Map
// (/admin/coverage) joins this with hammerex_events + trade listings to
// compute a per-city × per-trade heatmap and produce the recruit-list.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CityLaunchStatus =
  | "PREPARE"
  | "RECRUIT"
  | "ACTIVATE"
  | "GROW"
  | "DOMINATE"
  | "PAUSED";

export type CityLaunch = {
  id:                        string;
  city_slug:                 string;
  city_display:              string;
  region:                    string | null;
  country:                   string;
  status:                    CityLaunchStatus;
  status_since:              string;
  target_trades_total:       number | null;
  target_trades_per_category: Record<string, number> | null;
  target_homeowner_signups:  number | null;
  planned_launch_date:       string | null;
  launched_at:               string | null;
  activated_at:              string | null;
  owner_admin_email:         string | null;
  admin_notes:               string | null;
  next_step:                 string | null;
  created_at:                string;
  updated_at:                string;
};

export async function loadCityLaunches(): Promise<CityLaunch[]> {
  const res = await supabaseAdmin
    .from("hammerex_city_launches")
    .select("*")
    .order("status_since", { ascending: false });
  return (res.data as CityLaunch[]) ?? [];
}

export async function loadCityLaunch(citySlug: string): Promise<CityLaunch | null> {
  const res = await supabaseAdmin
    .from("hammerex_city_launches")
    .select("*")
    .eq("city_slug", citySlug)
    .maybeSingle();
  return (res.data as CityLaunch | null) ?? null;
}

export async function upsertCityLaunch(input: {
  citySlug:      string;
  cityDisplay:   string;
  region?:       string;
  status?:       CityLaunchStatus;
  targetTradesTotal?: number;
  targetTradesPerCategory?: Record<string, number>;
  targetHomeownerSignups?: number;
  plannedLaunchDate?: string;
  ownerAdminEmail?: string;
  adminNotes?:   string;
  nextStep?:     string;
}): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    city_slug:                  input.citySlug,
    city_display:               input.cityDisplay,
    region:                     input.region ?? null,
    status:                     input.status ?? "PREPARE",
    status_since:               now,
    target_trades_total:        input.targetTradesTotal ?? null,
    target_trades_per_category: input.targetTradesPerCategory ?? null,
    target_homeowner_signups:   input.targetHomeownerSignups ?? null,
    planned_launch_date:        input.plannedLaunchDate ?? null,
    owner_admin_email:          input.ownerAdminEmail ?? null,
    admin_notes:                input.adminNotes ?? null,
    next_step:                  input.nextStep ?? null,
    updated_at:                 now
  };
  const res = await supabaseAdmin
    .from("hammerex_city_launches")
    .upsert(payload, { onConflict: "city_slug" });
  if (res.error) return { ok: false, error: res.error.message };
  return { ok: true };
}

export async function setStatus(citySlug: string, status: CityLaunchStatus): Promise<boolean> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, status_since: now, updated_at: now };
  if (status === "ACTIVATE") patch.activated_at = now;
  if (status === "GROW"     && !patch.launched_at) patch.launched_at = now;
  const res = await supabaseAdmin
    .from("hammerex_city_launches")
    .update(patch)
    .eq("city_slug", citySlug)
    .select("id")
    .maybeSingle();
  return !!res.data;
}

/** Demand + supply counts per city over the last N days.
 *  Feeds the Coverage Map liquidity ranking. */
export async function loadCoverageStats(days = 30): Promise<Array<{
  city: string;
  demandCount: number;
  supplyCount: number;
  matchCount:  number;
}>> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const res = await supabaseAdmin
    .from("hammerex_events")
    .select("city, lifecycle_stage")
    .gte("occurred_at", since)
    .not("city", "is", null);
  const rows = (res.data as Array<{ city: string; lifecycle_stage: string | null }>) ?? [];
  const agg = new Map<string, { demand: number; supply: number; match: number }>();
  for (const r of rows) {
    const key = r.city;
    let bucket = agg.get(key);
    if (!bucket) { bucket = { demand: 0, supply: 0, match: 0 }; agg.set(key, bucket); }
    if (r.lifecycle_stage === "demand_created")   bucket.demand++;
    if (r.lifecycle_stage === "supply_available") bucket.supply++;
    if (r.lifecycle_stage === "match_created")    bucket.match++;
  }
  return Array.from(agg.entries())
    .map(([city, b]) => ({ city, demandCount: b.demand, supplyCount: b.supply, matchCount: b.match }))
    .sort((a, b) => (b.demandCount + b.matchCount) - (a.demandCount + a.matchCount));
}
