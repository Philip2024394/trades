// Fires when a merchant has one or more reviews older than 48h with
// no owner_response. Nudge points them at the reviews inbox — from
// there they can Ask Mate to draft a reply.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SignalDetector } from "../types";

const AGE_HOURS = 48;

export const reviewUnrepliedDetector: SignalDetector = {
  kind:     "review_unreplied",
  surfaces: ["merchant"],
  async detect(ctx) {
    const cutoff = new Date(Date.now() - AGE_HOURS * 3600 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from("hammerex_network_reviews")
      .select("id, created_at, quality_score, communication_score, punctuality_score, value_score, cleanliness_score")
      .eq("merchant_slug", ctx.userKey)
      .eq("status", "published")
      .is("owner_response_body", null)
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true });

    const rows = data ?? [];
    if (rows.length === 0) return null;

    // Priority bumps up if any of the unreplied are low-scoring.
    const anyLow = rows.some((r) => {
      const scores = [r.quality_score, r.communication_score, r.punctuality_score, r.value_score, r.cleanliness_score]
        .filter((s): s is number => typeof s === "number");
      if (scores.length === 0) return false;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return avg < 3.5;
    });

    const count = rows.length;
    return {
      kind:         "review_unreplied",
      priority:     anyLow ? 1 : 2,
      title:        count === 1
        ? "One review needs a reply"
        : `${count} reviews need a reply`,
      body:         anyLow
        ? `You've got ${count} unanswered review${count === 1 ? "" : "s"} and at least one is under 3.5 stars. Reply today and it lands honest instead of ignored.`
        : `${count} review${count === 1 ? "" : "s"} sat over 48h. Reply and I'll draft it for you if you want.`,
      action_url:   `/trade-off/edit/${ctx.userKey}/reviews`,
      action_label: "Open reviews",
      metadata:     { count, has_low_score: anyLow, oldest_review_id: rows[0].id }
    };
  }
};
