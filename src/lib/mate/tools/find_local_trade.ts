// Homeowner tool. Given a trade + city, return up-to-5 candidate
// merchants so Mate can point the user at real profiles. Uses the
// same primary_trade + secondary_trades matching pattern beacon.
// server.ts uses so results are consistent with the beacon engine.
//
// Returns lightweight rows only — display name, city, trust tier,
// avg rating, canonical URL. Mate's final answer names them + links.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MateTool } from "./types";

type ListingRow = {
  slug:          string;
  display_name:  string;
  city:          string | null;
  trust_tier:    string | null;
  rating_avg:    number | null;
  rating_count:  number | null;
  primary_trade: string | null;
};

export const findLocalTradeTool: MateTool = {
  name:        "find_local_trade",
  description: "Find live trades near a UK city for a given trade slug (e.g. 'plumber', 'electrician', 'roofer'). Use when a homeowner asks who to hire.",
  input_schema: {
    type: "object",
    properties: {
      trade_slug: {
        type:        "string",
        description: "Kebab-case trade slug — plumber, electrician, roofer, painter, tiler, joiner, etc."
      },
      city: {
        type:        "string",
        description: "UK city or town name. Optional — if omitted returns UK-wide."
      },
      limit: {
        type:        "integer",
        description: "How many candidates to return. 1-5.",
        minimum:     1,
        maximum:     5
      }
    },
    required: ["trade_slug"]
  },
  surfaces: ["homeowner", "visitor"],
  async handler(input) {
    const tradeSlug = String(input.trade_slug ?? "").toLowerCase().replace(/\s+/g, "-");
    const city      = input.city ? String(input.city).trim() : "";
    const limit     = Math.min(Math.max(Number(input.limit ?? 3), 1), 5);
    if (!tradeSlug) return { ok: false, error: "trade_slug_missing" };

    const orFilter = `primary_trade.eq.${tradeSlug},secondary_trades.cs.{${tradeSlug}}`;
    const base = supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("slug, display_name, city, trust_tier, rating_avg, rating_count, primary_trade")
      .eq("status", "live")
      .or(orFilter);

    let rows: ListingRow[] = [];
    if (city) {
      const cityRes = await base.ilike("city", city).limit(limit * 3);
      rows = ((cityRes.data ?? []) as ListingRow[]);
    }
    if (rows.length < limit) {
      const wider = await base.limit(limit * 4);
      const seen  = new Set(rows.map((r) => r.slug));
      for (const r of ((wider.data ?? []) as ListingRow[])) {
        if (!seen.has(r.slug)) { rows.push(r); seen.add(r.slug); }
        if (rows.length >= limit * 2) break;
      }
    }

    // Rank: trust_tier weight → rating_avg → rating_count
    const TIER_WEIGHT: Record<string, number> = { platinum: 5, gold: 4, silver: 3, bronze: 2, unranked: 1 };
    rows.sort((a, b) => {
      const t = (TIER_WEIGHT[b.trust_tier ?? "unranked"] ?? 1) - (TIER_WEIGHT[a.trust_tier ?? "unranked"] ?? 1);
      if (t !== 0) return t;
      const r = (b.rating_avg ?? 0) - (a.rating_avg ?? 0);
      if (r !== 0) return r;
      return (b.rating_count ?? 0) - (a.rating_count ?? 0);
    });

    const top = rows.slice(0, limit).map((r) => ({
      slug:          r.slug,
      display_name:  r.display_name,
      city:          r.city,
      trust_tier:    r.trust_tier ?? "unranked",
      rating_avg:    r.rating_avg,
      rating_count:  r.rating_count,
      primary_trade: r.primary_trade,
      profile_url:   `/${r.slug}`
    }));

    return {
      ok:   true,
      data: {
        trade_slug: tradeSlug,
        city_asked: city || null,
        count:      top.length,
        candidates: top
      },
      ui: top.length > 0 ? {
        kind:    "list" as const,
        payload: { title: `Trades near you`, items: top }
      } : undefined
    };
  }
};
