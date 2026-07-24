// Team adapter — reads hammerex_sitebook_members.
//
// Reports who's on the project and their status. Merchant view is
// clipped to the merchant's own row plus a count of the others (no
// contact leaks between competing trades).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PIAdapter, Observation } from "../types";
import { evidenceFor } from "../types";

export const teamAdapter: PIAdapter = {
  aspect: "team",
  label:  "Team",
  weight: 0.8,

  async run(ctx) {
    const evidence = evidenceFor("hammerex_sitebook_members", ["hammerex_sitebook_members"], `/sitebook/${ctx.projectId}/trades`);

    const rows = await supabaseAdmin
      .from("hammerex_sitebook_members")
      .select("listing_id, merchant_slug, merchant_name, trade_type, member_role, status, quote_amount_gbp, invited_at, accepted_at, hired_at, completed_at")
      .eq("project_id", ctx.projectId)
      .order("invited_at", { ascending: true });

    const members = rows.data ?? [];
    const hired   = members.filter((m) => m.status === "hired" || m.status === "in-progress" || m.status === "complete");
    const pending = members.filter((m) => m.status === "invited" || m.status === "accepted" || m.status === "quoting");
    const done    = members.filter((m) => m.status === "complete");
    const declined = members.filter((m) => m.status === "declined").length;

    const observations: Observation[] = [];
    if (pending.length >= 3) {
      observations.push({
        key:      "team_pending_replies",
        aspect:   "team",
        severity: "notice",
        headline: `${pending.length} invited ${pending.length === 1 ? "trade hasn't" : "trades haven't"} responded yet.`,
        action:   { label: "Open team list", href: `/sitebook/${ctx.projectId}/trades` },
        evidence
      });
    }

    const sub_score = members.length === 0
      ? 40
      : Math.min(100, 55 + hired.length * 12 + done.length * 3);

    return {
      aspect: "team",
      label:  "Team",
      sub_score,
      weight: 0.8,
      metrics: [
        { key: "team_size",     label: "Trades on project",      value: members.length, unit: "count", direction: "neutral", evidence },
        { key: "team_hired",    label: "Hired",                  value: hired.length,   unit: "count", direction: "higher_is_better", evidence },
        { key: "team_pending",  label: "Awaiting response",      value: pending.length, unit: "count", direction: "lower_is_better", evidence },
        { key: "team_declined", label: "Declined invitations",   value: declined,       unit: "count", direction: "lower_is_better", evidence, visible_to: ["homeowner"] }
      ],
      observations,
      timeline: []
    };
  }
};
