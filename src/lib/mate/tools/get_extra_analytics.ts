// Merchant tool. The default context builder gives Mate 7 days of
// merchant metrics. This tool lets Mate ask for a longer window +
// per-day breakdown when the user's question warrants deep analysis
// ("compare this month vs last month", "what's my best day?").

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MateTool } from "./types";

export const getExtraAnalyticsTool: MateTool = {
  name:        "get_extra_analytics",
  description: "Fetch a deeper analytics window for the signed-in merchant when the default 7-day snapshot isn't enough. Use for trend/comparison/best-day questions.",
  input_schema: {
    type: "object",
    properties: {
      days: {
        type:        "integer",
        description: "How many days back from today. 14, 30 or 90.",
        enum:        [14, 30, 90]
      },
      breakdown: {
        type:        "string",
        description: "Either 'per_day' for a daily series, or 'totals' for a single summary.",
        enum:        ["per_day", "totals"]
      }
    },
    required: ["days", "breakdown"]
  },
  surfaces: ["merchant"],
  async handler(input, ctx) {
    const days      = Number(input.days ?? 30);
    const breakdown = String(input.breakdown ?? "totals");
    const slug      = ctx.slug;
    if (!slug) return { ok: false, error: "merchant_slug_missing" };

    const fromDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabaseAdmin
      .from("hammerex_merchant_daily_metrics")
      .select("date, profile_views, whatsapp_clicks, posts_shipped, reactions, review_count")
      .eq("merchant_slug", slug)
      .gte("date", fromDate)
      .order("date", { ascending: true });

    if (error) return { ok: false, error: error.message };
    const rows = data ?? [];

    if (breakdown === "per_day") {
      return { ok: true, data: { days, days_returned: rows.length, series: rows } };
    }

    const totals = rows.reduce(
      (acc, r) => ({
        profile_views:   acc.profile_views   + (r.profile_views   ?? 0),
        whatsapp_clicks: acc.whatsapp_clicks + (r.whatsapp_clicks ?? 0),
        posts_shipped:   acc.posts_shipped   + (r.posts_shipped   ?? 0),
        reactions:       acc.reactions       + (r.reactions       ?? 0),
        review_count:    acc.review_count    + (r.review_count    ?? 0)
      }),
      { profile_views: 0, whatsapp_clicks: 0, posts_shipped: 0, reactions: 0, review_count: 0 }
    );

    const bestDay = rows.reduce<{ date: string; views: number } | null>(
      (best, r) => ((r.profile_views ?? 0) > (best?.views ?? -1) ? { date: r.date, views: r.profile_views ?? 0 } : best),
      null
    );

    return {
      ok: true,
      data: {
        days,
        days_with_data: rows.length,
        totals,
        best_day: bestDay,
        wa_conversion_pct: totals.profile_views > 0
          ? Number(((totals.whatsapp_clicks / totals.profile_views) * 100).toFixed(1))
          : null
      }
    };
  }
};
