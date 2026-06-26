// Server-side analytics aggregators for Xrated Trades. Used by the admin
// dashboard (Agent B). Reads via supabaseAdmin so RLS doesn't block.
//
// Time windows are inclusive of "now" and look back `sinceDays * 86400`
// seconds. Both queries cap row counts at 50k to keep the aggregations
// bounded — at our current write volume that's months of data.

import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

const ROW_CAP = 50_000;

type ViewRow = {
  id: string;
  listing_id: string | null;
  page: string;
  session_id: string | null;
  viewed_at: string;
  duration_seconds: number | null;
};

function isoSinceDays(days: number): string {
  const ms = Math.max(1, Math.floor(days)) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

function isoDay(iso: string): string {
  // YYYY-MM-DD in UTC. Matches our timestamptz storage and groups cleanly.
  return iso.slice(0, 10);
}

export type ListingViewStats = {
  total_views: number;
  unique_sessions: number;
  avg_duration_seconds: number;
  last_viewed_at: string | null;
  views_by_page: Record<string, number>;
  views_by_day: Array<{ date: string; count: number }>;
};

export async function getListingViewStats(
  listingId: string,
  sinceDays: number = 30
): Promise<ListingViewStats> {
  const empty: ListingViewStats = {
    total_views: 0,
    unique_sessions: 0,
    avg_duration_seconds: 0,
    last_viewed_at: null,
    views_by_page: {},
    views_by_day: []
  };

  if (!listingId) return empty;

  try {
    const since = isoSinceDays(sinceDays);
    const res = await supabaseAdmin
      .from("hammerex_xrated_views")
      .select("id, listing_id, page, session_id, viewed_at, duration_seconds")
      .eq("listing_id", listingId)
      .gte("viewed_at", since)
      .order("viewed_at", { ascending: false })
      .limit(ROW_CAP);

    if (res.error || !res.data) return empty;
    const rows = res.data as ViewRow[];
    if (rows.length === 0) return empty;

    const sessions = new Set<string>();
    const pageCounts: Record<string, number> = {};
    const dayCounts = new Map<string, number>();
    let durationSum = 0;
    let durationCount = 0;
    let lastViewedAt: string | null = null;

    for (const r of rows) {
      if (r.session_id) sessions.add(r.session_id);
      pageCounts[r.page] = (pageCounts[r.page] ?? 0) + 1;
      const day = isoDay(r.viewed_at);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
      if (typeof r.duration_seconds === "number") {
        durationSum += r.duration_seconds;
        durationCount += 1;
      }
      if (!lastViewedAt || r.viewed_at > lastViewedAt) lastViewedAt = r.viewed_at;
    }

    const views_by_day = Array.from(dayCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      total_views: rows.length,
      unique_sessions: sessions.size,
      avg_duration_seconds:
        durationCount > 0 ? Math.round(durationSum / durationCount) : 0,
      last_viewed_at: lastViewedAt,
      views_by_page: pageCounts,
      views_by_day
    };
  } catch {
    return empty;
  }
}

export type OverallStats = {
  total_views: number;
  unique_sessions: number;
  top_pages: Array<{ page: string; count: number }>;
  total_signups: number;
  total_app_trial: number;
  total_app_paid: number;
  total_standard: number;
};

export async function getOverallStats(sinceDays: number = 30): Promise<OverallStats> {
  const empty: OverallStats = {
    total_views: 0,
    unique_sessions: 0,
    top_pages: [],
    total_signups: 0,
    total_app_trial: 0,
    total_app_paid: 0,
    total_standard: 0
  };

  try {
    const since = isoSinceDays(sinceDays);

    const viewsRes = await supabaseAdmin
      .from("hammerex_xrated_views")
      .select("page, session_id, viewed_at")
      .gte("viewed_at", since)
      .order("viewed_at", { ascending: false })
      .limit(ROW_CAP);

    const sessions = new Set<string>();
    const pageCounts: Record<string, number> = {};
    let totalViews = 0;

    if (!viewsRes.error && viewsRes.data) {
      const rows = viewsRes.data as Array<{
        page: string;
        session_id: string | null;
      }>;
      totalViews = rows.length;
      for (const r of rows) {
        if (r.session_id) sessions.add(r.session_id);
        pageCounts[r.page] = (pageCounts[r.page] ?? 0) + 1;
      }
    }

    const top_pages = Object.entries(pageCounts)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Listing tier counts — total signups = every row (live + draft + hidden).
    // app_paid covers paid pros even past trial; app_trial only active trials.
    const listingsRes = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("tier", { count: "exact" });

    let total_signups = 0;
    let total_app_trial = 0;
    let total_app_paid = 0;
    let total_standard = 0;

    if (!listingsRes.error && listingsRes.data) {
      const rows = listingsRes.data as Array<{ tier: string | null }>;
      total_signups = listingsRes.count ?? rows.length;
      for (const r of rows) {
        const tier = r.tier ?? "standard";
        if (tier === "app_trial") total_app_trial += 1;
        else if (tier === "app_paid") total_app_paid += 1;
        else total_standard += 1; // standard + app_expired both fall here
      }
    }

    return {
      total_views: totalViews,
      unique_sessions: sessions.size,
      top_pages,
      total_signups,
      total_app_trial,
      total_app_paid,
      total_standard
    };
  } catch {
    return empty;
  }
}
