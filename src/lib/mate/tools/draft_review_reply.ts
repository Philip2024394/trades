// Merchant tool. Given a review ID, this fetches the review + shapes
// a draft owner-response the merchant can Apply from the widget.
// The draft is generated deterministically here (tone-templated on
// score + verification kind) so Mate's final answer doesn't have to
// invent it — Claude just wraps it in conversational framing.
//
// The `ui` payload returned lets the widget render an editable card
// with an Apply button that POSTs to the existing owner-response API.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MateTool } from "./types";

type ReviewRow = {
  id:                     string;
  merchant_slug:          string;
  body:                   string | null;
  reviewer_display_name:  string | null;
  quality_score:          number | null;
  communication_score:    number | null;
  punctuality_score:      number | null;
  value_score:            number | null;
  cleanliness_score:      number | null;
  owner_response_body:    string | null;
};

function averageScore(r: ReviewRow): number {
  const scores = [r.quality_score, r.communication_score, r.punctuality_score, r.value_score, r.cleanliness_score]
    .filter((s): s is number => typeof s === "number");
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function draftFor(review: ReviewRow): string {
  const first = (review.reviewer_display_name ?? "").split(" ")[0] || "there";
  const avg   = averageScore(review);
  if (avg >= 4.5) {
    return `Thanks ${first}, really appreciate you taking the time to write this. Glad the job landed well and we'd have you back any day.`;
  }
  if (avg >= 3.5) {
    return `Thanks ${first} for the honest feedback. Noted where we could have been sharper and we'll take it on the chin for next time.`;
  }
  return `Thanks ${first} for flagging this. Sorry it didn't hit the mark and I'd like to make it right. I'll drop you a WhatsApp to sort what we can put back on for you.`;
}

export const draftReviewReplyTool: MateTool = {
  name:        "draft_review_reply",
  description: "Draft an owner-response to a specific review. Use when the merchant asks to reply to a review. Returns the draft text plus a UI card the widget can Apply.",
  input_schema: {
    type: "object",
    properties: {
      review_id: {
        type:        "string",
        description: "UUID of the review to draft a reply for."
      }
    },
    required: ["review_id"]
  },
  surfaces: ["merchant"],
  async handler(input, ctx) {
    const reviewId = String(input.review_id ?? "");
    const slug     = ctx.slug;
    if (!reviewId) return { ok: false, error: "review_id_missing" };
    if (!slug)     return { ok: false, error: "merchant_slug_missing" };

    const { data, error } = await supabaseAdmin
      .from("hammerex_network_reviews")
      .select("id, merchant_slug, body, reviewer_display_name, quality_score, communication_score, punctuality_score, value_score, cleanliness_score, owner_response_body")
      .eq("id", reviewId)
      .maybeSingle();

    if (error)         return { ok: false, error: error.message };
    if (!data)         return { ok: false, error: "review_not_found" };
    if (data.merchant_slug !== slug) {
      return { ok: false, error: "review_not_owned_by_merchant" };
    }
    if (data.owner_response_body) {
      return { ok: false, error: "already_replied", data: { existing: data.owner_response_body } };
    }

    const draft = draftFor(data as ReviewRow);

    return {
      ok:   true,
      data: {
        review_id:   data.id,
        review_body: (data.body ?? "").slice(0, 240),
        avg_score:   averageScore(data as ReviewRow),
        draft
      },
      ui: {
        kind:    "draft-review-reply",
        payload: {
          review_id: data.id,
          draft,
          apply_endpoint: `/api/reviews/moderate/${data.id}/respond`
        }
      }
    };
  }
};
