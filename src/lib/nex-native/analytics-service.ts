// src/lib/nex-native/analytics-service.ts
//
// analytics-service · read-only aggregations over real persisted data.
//
// Doctrine:
//   · Anti-fabrication · never invent metrics · every counter is derived
//     from real rows · null-safe zero when there is no data · never a
//     synthetic "trending up" claim
//   · Every aggregate is scoped to a single business_id · no cross-tenant
//     leakage
//   · Reversal-safe · net revenue accounts for reversal ledger entries
//     (customer_receivable/business_revenue on reversal entries flip)
//
// Read-side only · this file NEVER mutates state.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import * as orderService from "./order-service";
import type {
  NexOrderRow,
  NexOrderState,
  NexUuid,
} from "./types";

export interface DailyRevenue {
  /** ISO date · YYYY-MM-DD · UTC day boundary. */
  day: string;
  order_count: number;
  gross_revenue_pence: number;
  currency: string;
}

export interface TopProduct {
  product_id: NexUuid;
  order_count: number;
  gross_revenue_pence: number;
  currency: string;
}

export interface MerchantOverview {
  business_id: NexUuid;
  as_of: string;                                          // ISO timestamp
  total_orders: number;
  orders_by_state: Record<NexOrderState, number>;
  gross_revenue_by_currency: Record<string, number>;      // paid + completed + refunded (before reversal)
  refunded_amount_by_currency: Record<string, number>;    // paid+then-refunded totals
  net_revenue_by_currency: Record<string, number>;        // gross minus refunded (from ledger · reversal-safe)
  top_products: TopProduct[];                             // top 5 by gross revenue then order count
  orders_last_7d: number;
  orders_last_30d: number;
  orders_last_90d: number;
}

const ZERO_STATES: Record<NexOrderState, number> = {
  created: 0,
  pending: 0,
  paid: 0,
  completed: 0,
  cancelled: 0,
  refunded: 0,
};

function withinDays(iso: string, now: number, days: number): boolean {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return false;
  return now - ms <= days * 24 * 60 * 60 * 1000;
}

/** UTC YYYY-MM-DD for a Date · used to bucket order rows into days. */
function utcDayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Dense daily time-series for the merchant · newest day LAST · length =
 * `days` · one entry per calendar UTC day. Zero-filled when no orders that
 * day. Filtered to a single currency (default GBP).
 *
 * "Gross revenue" per day counts every order that was ever billed on that
 * day (paid + completed + refunded). This matches the meaning used in
 * getMerchantOverview.
 */
export async function getDailyRevenue(
  businessId: NexUuid,
  days: number = 30,
  currency: string = "GBP"
): Promise<DailyRevenue[]> {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error(
      `analytics-service.getDailyRevenue: days must be an integer 1..365 · got ${days}`
    );
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(
      `analytics-service.getDailyRevenue: currency must be 3-char ISO-4217 · got '${currency}'`
    );
  }
  // Tier gate · Gratis owners clamped to 7-day analytics window ·
  // Bisnis+ pass through. Non-throwing: reads just get a shorter
  // window instead of failing hard (matches doctrine "never gate
  // reads"). Migration 046 · Indonesia package doctrine 2026-09-27.
  {
    const biz = await nexSupabaseAdmin
      .from("nex_business")
      .select("owner_account_id")
      .eq("id", businessId)
      .maybeSingle();
    const ownerId = (biz.data as { owner_account_id?: string } | null)?.owner_account_id;
    if (ownerId) {
      days = await (await import("./tier-gate")).clampAnalyticsWindow(ownerId, days);
    }
  }

  // Dense skeleton · today at index [days-1] · days-1 days ago at [0]
  const now = new Date();
  const skeleton: DailyRevenue[] = [];
  const dayIndex = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = utcDayKey(d);
    dayIndex.set(key, skeleton.length);
    skeleton.push({ day: key, order_count: 0, gross_revenue_pence: 0, currency });
  }

  const orders = await orderService.listOrdersByBusiness(businessId);
  const cutoffMs = now.getTime() - (days - 1) * 24 * 60 * 60 * 1000;
  const cutoffKey = utcDayKey(new Date(cutoffMs));
  for (const o of orders) {
    if (o.currency !== currency) continue;
    const createdKey = utcDayKey(new Date(o.created_at));
    // Skip orders older than the window
    if (createdKey < cutoffKey) continue;
    const idx = dayIndex.get(createdKey);
    if (idx === undefined) continue;
    skeleton[idx]!.order_count += 1;
    if (o.state === "paid" || o.state === "completed" || o.state === "refunded") {
      skeleton[idx]!.gross_revenue_pence += o.price_pence;
    }
  }
  return skeleton;
}

/**
 * Wave B Slice 5f · daily NET revenue time-series.
 * NET counts only paid + completed orders (refunded orders excluded from the
 * total · that's the semantic distinction from GROSS which includes refunded).
 * Same dense array shape as getDailyRevenue.
 */
export async function getDailyNetRevenue(
  businessId: NexUuid,
  days: number = 30,
  currency: string = "GBP",
): Promise<DailyRevenue[]> {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error(
      `analytics-service.getDailyNetRevenue: days must be an integer 1..365 · got ${days}`,
    );
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(
      `analytics-service.getDailyNetRevenue: currency must be 3-char ISO-4217 · got '${currency}'`,
    );
  }
  // Tier gate · same 7-day clamp as getDailyRevenue (Gratis).
  {
    const biz = await nexSupabaseAdmin
      .from("nex_business")
      .select("owner_account_id")
      .eq("id", businessId)
      .maybeSingle();
    const ownerId = (biz.data as { owner_account_id?: string } | null)?.owner_account_id;
    if (ownerId) {
      days = await (await import("./tier-gate")).clampAnalyticsWindow(ownerId, days);
    }
  }

  const now = new Date();
  const skeleton: DailyRevenue[] = [];
  const dayIndex = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = utcDayKey(d);
    dayIndex.set(key, skeleton.length);
    skeleton.push({ day: key, order_count: 0, gross_revenue_pence: 0, currency });
  }

  const orders = await orderService.listOrdersByBusiness(businessId);
  const cutoffMs = now.getTime() - (days - 1) * 24 * 60 * 60 * 1000;
  const cutoffKey = utcDayKey(new Date(cutoffMs));
  for (const o of orders) {
    if (o.currency !== currency) continue;
    const createdKey = utcDayKey(new Date(o.created_at));
    if (createdKey < cutoffKey) continue;
    const idx = dayIndex.get(createdKey);
    if (idx === undefined) continue;
    skeleton[idx]!.order_count += 1;
    // Slice 5f · NET rule: paid + completed only · refunded excluded
    if (o.state === "paid" || o.state === "completed") {
      skeleton[idx]!.gross_revenue_pence += o.price_pence;
    }
  }
  return skeleton;
}

/**
 * Wave B Slice 5d · month-over-month revenue time-series.
 * Dense array covering the trailing `months` calendar months, most-recent
 * bucket LAST · currency-filtered. Bucketing is on order.created_at at UTC
 * month boundaries. Gross counts paid + completed + refunded (same rule
 * as getDailyRevenue).
 */
export interface MonthlyRevenue {
  month: string;  // YYYY-MM (UTC)
  order_count: number;
  gross_revenue_pence: number;
  currency: string;
}

function utcMonthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function getMonthOverMonthRevenue(
  businessId: NexUuid,
  months: number = 6,
  currency: string = "GBP",
): Promise<MonthlyRevenue[]> {
  if (!Number.isInteger(months) || months < 1 || months > 24) {
    throw new Error(
      `analytics-service.getMonthOverMonthRevenue: months must be integer 1..24 · got ${months}`,
    );
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(
      `analytics-service.getMonthOverMonthRevenue: currency must be 3-char ISO-4217 · got '${currency}'`,
    );
  }

  // Dense skeleton · buckets ordered oldest → newest, current month last.
  const now = new Date();
  const skeleton: MonthlyRevenue[] = [];
  const monthIndex = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = utcMonthKey(d);
    monthIndex.set(key, skeleton.length);
    skeleton.push({ month: key, order_count: 0, gross_revenue_pence: 0, currency });
  }
  const oldestKey = skeleton[0]!.month;

  const orders = await orderService.listOrdersByBusiness(businessId);
  for (const o of orders) {
    if (o.currency !== currency) continue;
    const createdKey = utcMonthKey(new Date(o.created_at));
    if (createdKey < oldestKey) continue;
    const idx = monthIndex.get(createdKey);
    if (idx === undefined) continue;
    skeleton[idx]!.order_count += 1;
    if (o.state === "paid" || o.state === "completed" || o.state === "refunded") {
      skeleton[idx]!.gross_revenue_pence += o.price_pence;
    }
  }
  return skeleton;
}

/**
 * Aggregate every metric the merchant analytics page needs · single
 * business_id scope · O(N) over the merchant's orders + related ledger
 * lines. For the pilot's data volume this is comfortable in-memory.
 * A future SQL-view optimisation can slot in behind this function without
 * changing the caller contract.
 */
export async function getMerchantOverview(businessId: NexUuid): Promise<MerchantOverview> {
  const now = Date.now();
  const orders: NexOrderRow[] = await orderService.listOrdersByBusiness(businessId);

  // Order-state counters + recency + gross-revenue (from order rows themselves)
  const ordersByState: Record<NexOrderState, number> = { ...ZERO_STATES };
  const grossByCurrency: Record<string, number> = {};
  const refundedByCurrency: Record<string, number> = {};
  let last7 = 0;
  let last30 = 0;
  let last90 = 0;

  // Per-product aggregation
  interface ProductAgg { count: number; gross: number; currency: string; }
  const perProduct = new Map<NexUuid, ProductAgg>();

  for (const o of orders) {
    ordersByState[o.state] = (ordersByState[o.state] ?? 0) + 1;

    // "Gross revenue" is money the merchant billed at any point · counts
    // paid + completed + refunded (an order that got refunded WAS billed).
    // 'created' + 'pending' + 'cancelled' never billed.
    if (o.state === "paid" || o.state === "completed" || o.state === "refunded") {
      grossByCurrency[o.currency] = (grossByCurrency[o.currency] ?? 0) + o.price_pence;
      const agg = perProduct.get(o.product_id) ?? { count: 0, gross: 0, currency: o.currency };
      agg.count += 1;
      agg.gross += o.price_pence;
      // If a product ever had mixed currencies (shouldn't happen in pilot but
      // be honest), keep the most recent so the caller can see something.
      agg.currency = o.currency;
      perProduct.set(o.product_id, agg);
    }
    if (o.state === "refunded") {
      refundedByCurrency[o.currency] = (refundedByCurrency[o.currency] ?? 0) + o.price_pence;
    }

    if (withinDays(o.created_at, now, 7))  last7  += 1;
    if (withinDays(o.created_at, now, 30)) last30 += 1;
    if (withinDays(o.created_at, now, 90)) last90 += 1;
  }

  // Net revenue via the ledger · reversal-safe · scoped to this business
  // by joining on the order IDs we already fetched.
  const netByCurrency: Record<string, number> = {};
  const orderIds = orders.map((o) => o.id);
  if (orderIds.length > 0) {
    const { data: entries, error: entErr } = await nexSupabaseAdmin
      .from("nex_ledger_entry")
      .select("id")
      .in("order_id", orderIds);
    if (entErr) {
      throw new Error(`analytics-service.getMerchantOverview entries: ${entErr.message}`);
    }
    const entryIds = (entries ?? []).map((e) => (e as { id: string }).id);
    if (entryIds.length > 0) {
      const { data: lines, error: lineErr } = await nexSupabaseAdmin
        .from("nex_ledger_line")
        .select("account, debit_pence, credit_pence, currency")
        .in("entry_id", entryIds)
        .eq("account", "business_revenue");
      if (lineErr) {
        throw new Error(`analytics-service.getMerchantOverview lines: ${lineErr.message}`);
      }
      for (const l of (lines ?? []) as Array<{ debit_pence: number; credit_pence: number; currency: string }>) {
        netByCurrency[l.currency] =
          (netByCurrency[l.currency] ?? 0) + (l.credit_pence - l.debit_pence);
      }
    }
  }

  // Top 5 products by gross revenue, tie-break by order count
  const topProducts: TopProduct[] = Array.from(perProduct.entries())
    .map(([product_id, a]) => ({
      product_id,
      order_count: a.count,
      gross_revenue_pence: a.gross,
      currency: a.currency,
    }))
    .sort((a, b) => (b.gross_revenue_pence - a.gross_revenue_pence) || (b.order_count - a.order_count))
    .slice(0, 5);

  return {
    business_id: businessId,
    as_of: new Date(now).toISOString(),
    total_orders: orders.length,
    orders_by_state: ordersByState,
    gross_revenue_by_currency: grossByCurrency,
    refunded_amount_by_currency: refundedByCurrency,
    net_revenue_by_currency: netByCurrency,
    top_products: topProducts,
    orders_last_7d: last7,
    orders_last_30d: last30,
    orders_last_90d: last90,
  };
}
