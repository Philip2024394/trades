// Financial snapshot builder — composes MD briefing (Phase 9) with
// FI-specific new modules (revenue rollups, expenses, VAT, health).
//
// The MD briefing already has cashflow / profit / suppliers. FI
// snapshot re-exposes them as `_ref` blocks for callers, then adds the
// FI-only revenue / expenses / VAT / dedicated financial health.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildMDBriefing } from "../md";
import { buildExpenses } from "./expenses";
import { buildRevenue } from "./revenue";
import { buildVAT } from "./vat";
import { computeFinancialHealth } from "./health";
import type { FinancialSnapshot } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { snapshot: FinancialSnapshot; expiresAt: number }>();

export function _clearFiCache(): void { cache.clear(); }

export type BuildFinancialInput = {
  merchantSlug:     string;
  windowDays?:      number;   // default 90
  vatRatePct?:      number;   // default 20 (UK)
  targetMarginPct?: number;   // default 20 — passed through to MD
  now?:             Date;
  refresh?:         boolean;
};

export type BuildFinancialResult =
  | { ok: true;  snapshot: FinancialSnapshot }
  | { ok: false; reason: "merchant_not_found" };

const DAY_MS = 86_400_000;

export async function buildFinancialSnapshot(opts: BuildFinancialInput): Promise<BuildFinancialResult> {
  const now  = opts.now ?? new Date();
  const hourKey = now.toISOString().slice(0, 13);
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

  const window = opts.windowDays ?? 90;
  const errors: FinancialSnapshot["errors"] = [];

  const [md, revenue, expenses, vat, priorRevenue, weeklySeries] = await Promise.all([
    tryRun("md",       () => buildMDBriefing({ merchantSlug: opts.merchantSlug, now, targetMarginPct: opts.targetMarginPct }), errors),
    tryRun("revenue",  () => buildRevenue({ merchantId, merchantListingId, windowDays: window, now }),                          errors),
    tryRun("expenses", () => buildExpenses({ merchantListingId, windowDays: window, now }),                                      errors),
    tryRun("vat",      () => buildVAT({ merchantId, merchantListingId, vatRatePct: opts.vatRatePct, windowDays: window, now }), errors),
    tryRun("priorRev", () => priorWindowRevenue(merchantId, window, now),                                                        errors),
    tryRun("weekly",   () => weeklyRevenueSeries(merchantId, window, now),                                                       errors)
  ]);

  const mdBriefing = md?.ok ? md.briefing : null;

  const cashflow_ref = {
    outstanding_now_pence:   mdBriefing?.cashflow.outstanding_now_pence   ?? 0,
    overdue_now_pence:       mdBriefing?.cashflow.overdue_now_pence       ?? 0,
    pipeline_weighted_pence: mdBriefing?.cashflow.pipeline_weighted_pence ?? 0,
    next_30d_net_pence:      mdBriefing?.cashflow.buckets[0]?.net_pence ?? 0,
    next_60d_net_pence:      mdBriefing?.cashflow.buckets[1]?.net_pence ?? 0,
    next_90d_net_pence:      mdBriefing?.cashflow.buckets[2]?.net_pence ?? 0
  };
  const profit_ref = {
    quoted_pence:          mdBriefing?.profit.totals.quoted_pence         ?? 0,
    planned_profit_pence:  mdBriefing?.profit.totals.planned_profit_pence ?? 0,
    weighted_margin_pct:   mdBriefing?.profit.totals.weighted_margin_pct  ?? 0,
    target_margin_pct:     mdBriefing?.profit.target_margin_pct           ?? (opts.targetMarginPct ?? 20),
    low_margin_jobs_count: mdBriefing?.profit.low_margin_jobs.length      ?? 0
  };
  const suppliers_ref = {
    total_spend_pence: mdBriefing?.suppliers.total_spend_pence ?? 0,
    supplier_count:    mdBriefing?.suppliers.suppliers.length  ?? 0
  };

  const health = computeFinancialHealth({
    next_30d_net_pence:   cashflow_ref.next_30d_net_pence,
    weighted_margin_pct:  profit_ref.quoted_pence > 0 ? profit_ref.weighted_margin_pct : null,
    target_margin_pct:    profit_ref.target_margin_pct,
    outstanding_pence:    cashflow_ref.outstanding_now_pence,
    booked_revenue_pence: revenue?.total_pence ?? null,
    revenue_now_pence:    revenue?.total_pence ?? null,
    revenue_prior_pence:  priorRevenue ?? null,
    weekly_revenue_series: weeklySeries ?? undefined
  });

  const snapshot: FinancialSnapshot = {
    computed_at:   now.toISOString(),
    merchant_slug: opts.merchantSlug,
    currency:      "GBP",
    health,
    revenue:       revenue  ?? emptyRevenue(window, now),
    expenses:      expenses ?? emptyExpenses(window, now),
    vat:           vat      ?? emptyVAT(window, now, opts.vatRatePct ?? 20),
    cashflow_ref,
    profit_ref,
    suppliers_ref,
    errors
  };

  cache.set(cacheKey, { snapshot, expiresAt: now.getTime() + CACHE_TTL_MS });
  return { ok: true, snapshot };
}

async function tryRun<T>(name: string, fn: () => Promise<T>, errors: FinancialSnapshot["errors"]): Promise<T | null> {
  try { return await fn(); }
  catch (err) {
    errors.push({ module: name, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function priorWindowRevenue(merchantId: string, windowDays: number, now: Date): Promise<number> {
  const to   = new Date(now.getTime() - windowDays * DAY_MS).toISOString();
  const from = new Date(now.getTime() - 2 * windowDays * DAY_MS).toISOString();
  const rows = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("total_pence")
    .eq("merchant_id", merchantId)
    .not("accepted_at", "is", null)
    .gte("accepted_at", from)
    .lt("accepted_at", to);
  return (rows.data ?? []).reduce((s, r) => s + Number(r.total_pence ?? 0), 0);
}

async function weeklyRevenueSeries(merchantId: string, windowDays: number, now: Date): Promise<number[]> {
  const from = new Date(now.getTime() - windowDays * DAY_MS).toISOString();
  const rows = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("total_pence, accepted_at")
    .eq("merchant_id", merchantId)
    .not("accepted_at", "is", null)
    .gte("accepted_at", from);
  const weeks = Math.max(1, Math.ceil(windowDays / 7));
  const buckets = new Array(weeks).fill(0);
  for (const r of rows.data ?? []) {
    const at = new Date(String(r.accepted_at)).getTime();
    const diffDays = Math.floor((now.getTime() - at) / DAY_MS);
    const idx = Math.min(weeks - 1, Math.floor(diffDays / 7));
    buckets[weeks - 1 - idx] += Number(r.total_pence ?? 0);
  }
  return buckets;
}

// ─── Empty defaults for shape stability on module failure ─────────

function emptyRevenue(window: number, now: Date) {
  return {
    window_days: window, total_pence: 0, by_customer: [], by_project: [], by_kind: [],
    evidence: { source: "engine error", tables: [], computed_at: now.toISOString() }
  };
}
function emptyExpenses(window: number, now: Date) {
  return {
    window_days: window, total_pence: 0, categories: [],
    untracked_note: "Expense module failed to build.",
    evidence: { source: "engine error", tables: [], computed_at: now.toISOString() }
  };
}
function emptyVAT(window: number, now: Date, rate: number) {
  return {
    window_days: window, vat_rate_pct: rate, vat_payable_pence: 0, vat_reclaimable_est_pence: 0, vat_net_pence: 0,
    disclaimer: "Nex is not a tax adviser.",
    evidence: { source: "engine error", tables: [], computed_at: now.toISOString() }
  };
}
