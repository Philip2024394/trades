// Featured Placement — server-side helpers.
//
// Ships the surface today (admin manual placement + search boost).
// Stripe billing integration is a follow-up pass — for now,
// billing_source='admin' means an operator manually featured this
// trade via the admin dashboard.
//
// Search integration: featuredTradesForCategory(category) returns
// currently-active placements sorted by newest first, capped at
// the per-category seat count (default 3). Search results boost
// canteens whose hostSlug matches an active placement to the top
// of the Trades list, and images whose submitter matches surface
// first in Inspiration/browse.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const SEATS_PER_CATEGORY = 3;
export const DEFAULT_PLACEMENT_DAYS = 7;
export const PLACEMENT_PRICE_PENCE = 499; // £4.99

export type FeaturedPlacement = {
  id:              string;
  tradeSlug:       string;
  category:        string;
  status:          "active" | "queued" | "expired" | "refunded" | "cancelled";
  startsAt:        string;
  expiresAt:       string;
  paidAmountGbp:   number;
  billingSource:   string;
  stripeSessionId: string | null;
  adminNote:       string | null;
  createdAt:       string;
  updatedAt:       string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapePlacement(r: any): FeaturedPlacement {
  return {
    id:              r.id,
    tradeSlug:       r.trade_slug,
    category:        r.category,
    status:          r.status,
    startsAt:        r.starts_at,
    expiresAt:       r.expires_at,
    paidAmountGbp:   r.paid_amount_gbp ?? 0,
    billingSource:   r.billing_source ?? "admin",
    stripeSessionId: r.stripe_session_id ?? null,
    adminNote:       r.admin_note ?? null,
    createdAt:       r.created_at,
    updatedAt:       r.updated_at
  };
}

/** Active placements for a category — used by search to boost.
 *  Filters by status='active' AND expires_at > now(). Capped at
 *  SEATS_PER_CATEGORY so the seat count is a hard ceiling. */
export async function featuredTradesForCategory(category: string): Promise<FeaturedPlacement[]> {
  const cleaned = (category ?? "").toLowerCase().trim();
  if (!cleaned) return [];
  const res = await supabaseAdmin
    .from("hammerex_featured_placements")
    .select("*")
    .eq("status", "active")
    .eq("category", cleaned)
    .gt("expires_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(SEATS_PER_CATEGORY);
  if (res.error || !res.data) return [];
  return res.data.map(shapePlacement);
}

/** Full active placement list — powers admin dashboard. */
export async function allActivePlacements(): Promise<FeaturedPlacement[]> {
  const res = await supabaseAdmin
    .from("hammerex_featured_placements")
    .select("*")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true });
  if (res.error || !res.data) return [];
  return res.data.map(shapePlacement);
}

/** Full recent placement list — admin, all statuses. */
export async function recentPlacements(limit = 60): Promise<FeaturedPlacement[]> {
  const res = await supabaseAdmin
    .from("hammerex_featured_placements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (res.error || !res.data) return [];
  return res.data.map(shapePlacement);
}

/** Admin manual placement creation. Enforces SEATS_PER_CATEGORY
 *  unless override=true (rare admin override). */
export async function createPlacement(params: {
  tradeSlug:  string;
  category:   string;
  days?:      number;
  billingSource?: string;
  adminNote?: string | null;
  override?:  boolean;
}): Promise<{ ok: true; placement: FeaturedPlacement } | { ok: false; error: string }> {
  const tradeSlug = params.tradeSlug.trim();
  const category = params.category.toLowerCase().trim();
  if (!tradeSlug || !category) return { ok: false, error: "trade-and-category-required" };

  if (!params.override) {
    const active = await featuredTradesForCategory(category);
    if (active.length >= SEATS_PER_CATEGORY) {
      return { ok: false, error: "category-full" };
    }
    // Prevent double-featuring — a trade can only hold one slot per
    // category at a time (they'd be paying twice for the same boost).
    if (active.some((p) => p.tradeSlug === tradeSlug)) {
      return { ok: false, error: "trade-already-featured" };
    }
  }

  const days = params.days ?? DEFAULT_PLACEMENT_DAYS;
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

  const insert = await supabaseAdmin
    .from("hammerex_featured_placements")
    .insert({
      trade_slug:     tradeSlug,
      category,
      status:         "active",
      starts_at:      startsAt.toISOString(),
      expires_at:     expiresAt.toISOString(),
      paid_amount_gbp:params.billingSource === "admin" ? 0 : PLACEMENT_PRICE_PENCE,
      billing_source: params.billingSource ?? "admin",
      admin_note:     params.adminNote ?? null
    })
    .select("*")
    .single();

  if (insert.error || !insert.data) {
    return { ok: false, error: "db-insert-failed" };
  }
  return { ok: true, placement: shapePlacement(insert.data) };
}

/** Admin cancel — flips status to cancelled + shortens expiry. */
export async function cancelPlacement(id: string, adminNote?: string): Promise<boolean> {
  const res = await supabaseAdmin
    .from("hammerex_featured_placements")
    .update({
      status:     "cancelled",
      expires_at: new Date().toISOString(),
      admin_note: adminNote ?? null
    })
    .eq("id", id);
  return !res.error;
}
