// MD engine — assembles the full Managing Director briefing.
//
// Runs everything in parallel, catches per-module errors, produces one
// MDBriefing the answer router + chat + morning briefing all consume.
// Cached per (merchant, hour).

import { buildBusinessSnapshot } from "../bi";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildCashflow } from "./cashflow";
import { buildForecast } from "./forecast";
import { computeMDHealth } from "./health";
import { buildPriorities } from "./priorities";
import { buildProfit } from "./profit";
import { buildRecommendations } from "./recommendations";
import { buildSuppliers } from "./suppliers";
import { buildWorkforce } from "./workforce";
import type { MDBriefing } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { briefing: MDBriefing; expiresAt: number }>();

export function _clearMdCache(): void { cache.clear(); }

export type BuildMDInput = {
  merchantSlug: string;
  now?:         Date;
  refresh?:     boolean;
  /** Optional merchant-target overrides. */
  targetMarginPct?: number;
};

export type BuildMDResult =
  | { ok: true;  briefing: MDBriefing }
  | { ok: false; reason: "merchant_not_found" };

export async function buildMDBriefing(opts: BuildMDInput): Promise<BuildMDResult> {
  const now = opts.now ?? new Date();
  const hourKey  = now.toISOString().slice(0, 13);
  const cacheKey = `${opts.merchantSlug}|${hourKey}`;
  if (!opts.refresh) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > now.getTime()) return { ok: true, briefing: hit.briefing };
  }

  // Resolve listing id — used everywhere.
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", opts.merchantSlug)
    .maybeSingle();
  if (!listing.data) return { ok: false, reason: "merchant_not_found" };
  const merchantListingId = String(listing.data.id);
  const merchantId = merchantListingId;   // CRM merchant_id === listing id in this codebase

  const errors: MDBriefing["errors"] = [];
  const bi        = await tryRun("bi",        () => buildBusinessSnapshot({ merchantSlug: opts.merchantSlug, now }), errors);
  const cashflow  = await tryRun("cashflow",  () => buildCashflow({ merchantId, merchantListingId, now }),           errors);
  const profit    = await tryRun("profit",    () => buildProfit({ merchantId, merchantListingId, targetMarginPct: opts.targetMarginPct, now }), errors);
  const workforce = await tryRun("workforce", () => buildWorkforce({ merchantId, merchantListingId, now }),          errors);
  const suppliers = await tryRun("suppliers", () => buildSuppliers({ merchantId, merchantListingId, now }),          errors);
  const forecast  = await tryRun("forecast",  () => buildForecast({ merchantId, merchantSlug: opts.merchantSlug, now }), errors);

  const priorities = buildPriorities({
    bi:        bi,
    cashflow:  cashflow,
    profit:    profit,
    workforce: workforce,
    limit:     10
  });
  const recommendations = buildRecommendations(priorities, 5);

  const health = computeMDHealth({
    bi_score:              bi?.score ?? null,
    cashflow_30d_pence:    cashflow?.buckets[0]?.net_pence ?? null,
    profit_margin_pct:     profit?.totals.weighted_margin_pct ?? null,
    profit_target_pct:     opts.targetMarginPct ?? 20,
    workforce_util_score:  workforce ? workforceUtilScore(workforce.active_projects_count, workforce.bookings_next_14d) : null,
    cx_overdue_count:      cashflow ? (cashflow.overdue_now_pence > 0 ? 1 : 0) : null
  });

  const briefing: MDBriefing = {
    computed_at:      now.toISOString(),
    merchant_slug:    opts.merchantSlug,
    health,
    cashflow:         cashflow ?? emptyCashflow(now),
    profit:           profit   ?? emptyProfit(now),
    workforce:        workforce ?? emptyWorkforce(now),
    suppliers:        suppliers ?? emptySuppliers(now),
    forecast:         forecast  ?? emptyForecast(now),
    priorities,
    recommendations,
    errors
  };

  cache.set(cacheKey, { briefing, expiresAt: now.getTime() + CACHE_TTL_MS });
  return { ok: true, briefing };
}

async function tryRun<T>(name: string, fn: () => Promise<T>, errors: MDBriefing["errors"]): Promise<T | null> {
  try { return await fn(); }
  catch (err) {
    errors.push({ module: name, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

function workforceUtilScore(active: number, bookings14d: number): number {
  // Sweet spot: 2-4 active projects, some upcoming bookings = 90.
  // 0 active + 0 bookings = 30 (quiet); >=6 active = 60 (tight).
  if (active === 0 && bookings14d === 0) return 30;
  if (active >= 6) return 60;
  if (active >= 2 && active <= 4 && bookings14d >= 1) return 90;
  return 75;
}

// ─── Empty defaults so the shape is stable when a module fails ────

function emptyCashflow(now: Date) {
  return {
    currency: "GBP" as const, computed_at: now.toISOString(),
    buckets: [30, 60, 90].map((d) => ({ end_date: new Date(now.getTime() + d * 86_400_000).toISOString().slice(0, 10), inflow_pence: 0, outflow_pence: 0, net_pence: 0 })),
    horizon_pence: 0, outstanding_now_pence: 0, overdue_now_pence: 0, pipeline_weighted_pence: 0,
    warnings: ["Cash-flow module failed to build for this merchant."],
    evidence: { source: "engine error", tables: [], computed_at: now.toISOString() }
  };
}
function emptyProfit(now: Date) {
  return {
    computed_at: now.toISOString(), jobs: [], totals: { quoted_pence: 0, planned_profit_pence: 0, weighted_margin_pct: 0 },
    low_margin_jobs: [], target_margin_pct: 20,
    warnings: ["Profit module failed to build for this merchant."],
    evidence: { source: "engine error", tables: [], computed_at: now.toISOString() }
  };
}
function emptyWorkforce(now: Date) {
  return {
    computed_at: now.toISOString(), active_projects_count: 0, hours_last_30d: 0,
    team_size_current: 0, utilisation_note: "Workforce module failed to build.", bookings_next_14d: 0,
    warnings: [], evidence: { source: "engine error", tables: [], computed_at: now.toISOString() }
  };
}
function emptySuppliers(now: Date) {
  return {
    computed_at: now.toISOString(), window_days: 90, suppliers: [], total_spend_pence: 0,
    evidence: { source: "engine error", tables: [], computed_at: now.toISOString() }
  };
}
function emptyForecast(now: Date) {
  return {
    computed_at: now.toISOString(), next_30d_revenue_pence: null, next_60d_revenue_pence: null,
    monthly_avg_pence: null, best_day_of_week: null, seasonality_notes: ["Forecast module failed to build."],
    evidence: { source: "engine error", tables: [], computed_at: now.toISOString() }
  };
}
