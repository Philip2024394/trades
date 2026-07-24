// Variations adapter — variations aren't a first-class table in the
// SiteBook v2.2 blueprint. Nex derives them from two real signals:
//   1. Costs with kind='extra' — a change-order that added cost
//   2. Posts with kind='question' or body mentioning "variation" / "change"
// Every derived variation carries its evidence back to the original
// row so the answer path can point at "this cost" or "this post".

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PIAdapter, Observation, TimelineEvent } from "../types";
import { evidenceFor } from "../types";

const VARIATION_RE = /\b(variation|change\s*order|change\s*request|extra|additional|extra\s*work)\b/i;

export const variationsAdapter: PIAdapter = {
  aspect: "variations",
  label:  "Variations",
  weight: 1.0,

  async run(ctx) {
    const evidence = evidenceFor("hammerex_sitebook_costs (kind=extra) + hammerex_sitebook_posts (variation-flavoured)", ["hammerex_sitebook_costs", "hammerex_sitebook_posts"], `/sitebook/${ctx.projectId}`);

    // Cost-side variations.
    let costQ = supabaseAdmin
      .from("hammerex_sitebook_costs")
      .select("id, description, agreed_pence, paid_pence, status, trade_listing_id, trade_name, created_at, post_id")
      .eq("project_id", ctx.projectId)
      .eq("kind", "extra")
      .order("created_at", { ascending: false });
    if (ctx.viewer === "merchant") costQ = costQ.eq("trade_listing_id", ctx.viewerId);
    const costs = await costQ;

    // Post-side signals — questions or trade-notes with variation words.
    const posts = await supabaseAdmin
      .from("hammerex_sitebook_posts")
      .select("id, title, body, kind, status, author_type, author_display_name, created_at")
      .eq("project_id", ctx.projectId)
      .in("kind", ["question", "trade-note"])
      .order("created_at", { ascending: false })
      .limit(50);

    const variationPosts = (posts.data ?? []).filter((p) =>
      VARIATION_RE.test(String(p.title ?? "") + " " + String(p.body ?? ""))
    );

    const totalCount   = (costs.data ?? []).length + variationPosts.length;
    const openCount    = (costs.data ?? []).filter((c) => c.status !== "paid" && c.status !== "cancelled").length
                        + variationPosts.filter((p) => p.status === "open").length;
    const agreedPence  = (costs.data ?? []).reduce((s, c) => s + Number(c.agreed_pence ?? 0), 0);

    const timeline: TimelineEvent[] = [
      ...(costs.data ?? []).slice(0, 15).map((c) => ({
        at:         c.created_at as string,
        event_type: "variation_added",
        actor_type: null as TimelineEvent["actor_type"],
        actor_name: (c.trade_name ?? null) as string | null,
        headline:   `Variation: ${String(c.description ?? "Extra cost").slice(0, 80)} — £${(Number(c.agreed_pence) / 100).toLocaleString("en-GB")}`,
        evidence
      })),
      ...variationPosts.slice(0, 10).map((p) => ({
        at:         p.created_at as string,
        event_type: "variation_discussed",
        actor_type: (p.author_type ?? null) as TimelineEvent["actor_type"],
        actor_name: (p.author_display_name ?? null) as string | null,
        headline:   String(p.title ?? p.body).slice(0, 80),
        evidence
      }))
    ];

    const observations: Observation[] = [];
    if (openCount > 0) {
      observations.push({
        key:      "variations_open",
        aspect:   "variations",
        severity: openCount >= 3 ? "warning" : "notice",
        headline: `${openCount} variation${openCount === 1 ? "" : "s"} still open.`,
        detail:   "Close them out — either by attaching an invoice or marking the discussion complete — so nothing hangs.",
        action:   { label: "Review variations", href: `/sitebook/${ctx.projectId}` },
        evidence
      });
    }

    // Sub-score: no variations = healthy 90. As open count climbs the
    // score falls; sits above 40 unless the pile is 10+.
    const sub_score = totalCount === 0 ? 90 : Math.max(30, 90 - openCount * 10);

    return {
      aspect: "variations",
      label:  "Variations",
      sub_score,
      weight: 1.0,
      metrics: [
        { key: "variations_total", label: "Variations on record",   value: totalCount,                             unit: "count", direction: "lower_is_better", evidence },
        { key: "variations_open",  label: "Open variations",        value: openCount,                              unit: "count", direction: "lower_is_better", evidence },
        { key: "variations_gbp",   label: "Total agreed variation", value: Number((agreedPence / 100).toFixed(2)), unit: "gbp",   direction: "neutral",         evidence, visible_to: ["homeowner"] }
      ],
      observations,
      timeline
    };
  }
};
