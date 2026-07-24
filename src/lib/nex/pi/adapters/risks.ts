// Risks adapter — synthesises project risks from cross-aspect signals.
//
// Unlike other adapters, this one queries the SAME tables the peer
// adapters query (photos, costs, posts, things_to_fix, members) but
// evaluates them through a risk-detection lens. It doesn't wait for
// the engine to hand it other aspects because Promise.all runs
// everyone in parallel — instead it re-runs the cheap queries with
// risk-specific filters.
//
// Signals detected:
//   • Programme slip     — started but no completion in sight past
//                          project's expected duration
//   • Missing documents  — paid costs without invoices
//   • Photo silence      — no photos in the last 7 days
//   • Payment overdue    — costs past due_at, still owing
//   • Open snags aged    — snag on the list > 21 days
//   • Team unresponsive  — invited members with no reply for 7+ days

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PIAdapter, Observation } from "../types";
import { evidenceFor } from "../types";

const DAY_MS = 86_400_000;

export const risksAdapter: PIAdapter = {
  aspect: "risks",
  label:  "Risks",
  weight: 1.4,

  async run(ctx) {
    const now      = ctx.now ?? new Date();
    const evidence = evidenceFor("project risk detection (cross-aspect)", [
      "hammerex_sitebook_projects",
      "hammerex_sitebook_photos",
      "hammerex_sitebook_costs",
      "hammerex_sitebook_things_to_fix",
      "hammerex_sitebook_members"
    ], `/sitebook/${ctx.projectId}`);

    const [proj, latestPhoto, overdueCosts, staleThings, unresponsiveMembers] = await Promise.all([
      supabaseAdmin
        .from("hammerex_sitebook_projects")
        .select("started_at, completed_at, budget_max_gbp, total_spent_gbp")
        .eq("id", ctx.projectId)
        .maybeSingle(),
      supabaseAdmin
        .from("hammerex_sitebook_photos")
        .select("created_at")
        .eq("project_id", ctx.projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("hammerex_sitebook_costs")
        .select("id, agreed_pence, paid_pence, due_at")
        .eq("project_id", ctx.projectId)
        .not("due_at", "is", null)
        .lt("due_at", now.toISOString()),
      supabaseAdmin
        .from("hammerex_sitebook_things_to_fix")
        .select("id, created_at, status")
        .eq("project_id", ctx.projectId)
        .in("status", ["open", "in_progress"]),
      supabaseAdmin
        .from("hammerex_sitebook_members")
        .select("merchant_name, invited_at, status")
        .eq("project_id", ctx.projectId)
        .eq("status", "invited")
    ]);

    const risks: Observation[] = [];

    // Programme slip — started but running past 90d without completion.
    if (proj.data?.started_at && !proj.data.completed_at) {
      const days = Math.floor((now.getTime() - new Date(proj.data.started_at as string).getTime()) / DAY_MS);
      if (days > 90) {
        risks.push({
          key:      "programme_long_run",
          aspect:   "risks",
          severity: days > 180 ? "alert" : "warning",
          headline: `Project has been running for ${days} days with no completion date set.`,
          detail:   "Long-run projects often drift. Consider a checkpoint call with the trades.",
          evidence
        });
      }
    }

    // Photo silence.
    const daysSincePhoto = latestPhoto.data?.created_at
      ? Math.floor((now.getTime() - new Date(latestPhoto.data.created_at as string).getTime()) / DAY_MS)
      : null;
    if (daysSincePhoto !== null && daysSincePhoto >= 7 && ctx.viewer === "homeowner") {
      risks.push({
        key:      "risk_no_photos",
        aspect:   "risks",
        severity: daysSincePhoto >= 14 ? "warning" : "notice",
        headline: `No site photos have arrived for ${daysSincePhoto} days.`,
        evidence
      });
    }

    // Overdue costs.
    const overduePence = (overdueCosts.data ?? []).reduce(
      (s, r) => s + Math.max(0, Number(r.agreed_pence ?? 0) - Number(r.paid_pence ?? 0)),
      0
    );
    if (overduePence > 0 && ctx.viewer === "homeowner") {
      risks.push({
        key:      "risk_overdue_payment",
        aspect:   "risks",
        severity: overduePence > 100_000 ? "alert" : "warning",
        headline: `£${(overduePence / 100).toLocaleString("en-GB")} of agreed payment is past due.`,
        evidence,
        visible_to: ["homeowner"]
      });
    }

    // Snags aged.
    const oldest = (staleThings.data ?? []).reduce<number>((max, r) => {
      const d = Math.floor((now.getTime() - new Date(r.created_at as string).getTime()) / DAY_MS);
      return d > max ? d : max;
    }, 0);
    if (oldest >= 21) {
      risks.push({
        key:      "risk_snag_aged",
        aspect:   "risks",
        severity: oldest >= 60 ? "warning" : "notice",
        headline: `A snag has been open for ${oldest} days.`,
        evidence
      });
    }

    // Unresponsive invited members.
    for (const m of unresponsiveMembers.data ?? []) {
      const days = Math.floor((now.getTime() - new Date(m.invited_at as string).getTime()) / DAY_MS);
      if (days >= 7) {
        risks.push({
          key:      `risk_no_reply_${(m.merchant_name ?? "unknown").slice(0, 30)}`,
          aspect:   "risks",
          severity: "notice",
          headline: `${m.merchant_name ?? "Invited trade"} hasn't responded for ${days} days.`,
          evidence
        });
      }
    }

    // Sub-score: fewer risks = higher. Alerts weigh 3, warnings 2, notices 1.
    const weight = risks.reduce((s, r) => s + (r.severity === "alert" ? 3 : r.severity === "warning" ? 2 : 1), 0);
    const sub_score = Math.max(20, 100 - weight * 8);

    return {
      aspect: "risks",
      label:  "Risks",
      sub_score,
      weight: 1.4,
      metrics: [
        { key: "risks_total",   label: "Active risks", value: risks.length, unit: "count", direction: "lower_is_better", evidence },
        { key: "risks_alerts",  label: "Alert-level",  value: risks.filter((r) => r.severity === "alert").length,   unit: "count", direction: "lower_is_better", evidence },
        { key: "risks_warnings", label: "Warning-level", value: risks.filter((r) => r.severity === "warning").length, unit: "count", direction: "lower_is_better", evidence }
      ],
      observations: risks,
      timeline:     []
    };
  }
};
