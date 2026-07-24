// Things-to-fix adapter — reads hammerex_sitebook_things_to_fix.
//
// This is the SiteBook snagging list. Homeowner-owned by design;
// merchants only see items they've been assigned. Confirmed +
// dismissed items don't count against the health score.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PIAdapter, Observation, TimelineEvent } from "../types";
import { evidenceFor } from "../types";

const OPEN_STATUSES = ["open", "in_progress", "fixed"] as const;

export const thingsToFixAdapter: PIAdapter = {
  aspect: "things_to_fix",
  label:  "Things to fix",
  weight: 0.8,

  async run(ctx) {
    const evidence = evidenceFor("hammerex_sitebook_things_to_fix", ["hammerex_sitebook_things_to_fix"], `/sitebook/${ctx.projectId}`);

    let q = supabaseAdmin
      .from("hammerex_sitebook_things_to_fix")
      .select("id, title, status, assignee_listing_id, assignee_name, created_at, fixed_at")
      .eq("project_id", ctx.projectId)
      .order("created_at", { ascending: false });
    if (ctx.viewer === "merchant") q = q.eq("assignee_listing_id", ctx.viewerId);
    const rows = await q;

    const items    = rows.data ?? [];
    const open     = items.filter((r) => r.status === "open" || r.status === "in_progress");
    const fixed    = items.filter((r) => r.status === "fixed" || r.status === "confirmed");
    const now = ctx.now ?? new Date();
    const oldestOpen = open.reduce<{ days: number; title: string } | null>((acc, r) => {
      const days = Math.floor((now.getTime() - new Date(r.created_at as string).getTime()) / 86_400_000);
      if (!acc || days > acc.days) return { days, title: String(r.title) };
      return acc;
    }, null);

    const timeline: TimelineEvent[] = items.slice(0, 15).map((r) => ({
      at:         r.created_at as string,
      event_type: "thing_to_fix",
      actor_type: null,
      actor_name: (r.assignee_name ?? null) as string | null,
      headline:   `Thing to fix: ${String(r.title).slice(0, 80)}${r.status === "open" ? "" : ` (${r.status})`}`,
      evidence
    }));

    const observations: Observation[] = [];
    if (oldestOpen && oldestOpen.days >= 14) {
      observations.push({
        key:      "thing_stale",
        aspect:   "things_to_fix",
        severity: oldestOpen.days >= 30 ? "warning" : "notice",
        headline: `"${oldestOpen.title.slice(0, 60)}" has been open for ${oldestOpen.days} days.`,
        detail:   "Chase the trade or reassign — snags don't fix themselves.",
        action:   { label: "Open snag list", href: `/sitebook/${ctx.projectId}` },
        evidence
      });
    }

    // Sub-score: fewer open items = higher score. 0 open = 95; 10+ = 30.
    const sub_score = Math.max(30, 95 - open.length * 6);

    return {
      aspect: "things_to_fix",
      label:  "Things to fix",
      sub_score,
      weight: 0.8,
      metrics: [
        { key: "snags_open",  label: "Open snags",   value: open.length,  unit: "count", direction: "lower_is_better", evidence },
        { key: "snags_fixed", label: "Fixed snags",  value: fixed.length, unit: "count", direction: "higher_is_better", evidence },
        { key: "snags_total", label: "Total snags",  value: items.length, unit: "count", direction: "neutral",          evidence }
      ],
      observations,
      timeline
    };
  }
};
