// /admin/network-reviews — Network (merchant) review moderation panel.
//
// Distinct from /admin/reviews which moderates the legacy product-
// level reviews. This panel handles hammerex_network_reviews — the
// 6-axis merchant reviews with 72h cool-off + dispute window.
//
// Server-fetches every review that needs an admin decision (pending
// + frozen + reviews from reviewers with contested accountability)
// and renders one card per row with the freeze / remove / verify
// buttons wired to /api/admin/reviews/[id]/action.
//
// Auth gate via isAdminAuthed. Non-admins get bounced to /admin/login.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthed } from "@/lib/adminAuth";
import { overallForReview } from "@/lib/reviews";
import { AdminReviewsShell } from "./AdminReviewsShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Network reviews · Admin",
  robots: { index: false, follow: false }
};

export default async function AdminReviewsPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login?next=/admin/network-reviews");
  }

  // Pull anything that might need admin attention:
  //   - pending reviews (72h window active)
  //   - frozen reviews (merchant dispute or admin freeze)
  //   - most recent published reviews for context
  const res = await supabaseAdmin
    .from("hammerex_network_reviews")
    .select("id, merchant_slug, reviewer_display_name, reviewer_trade_label, reviewer_city, quality_score, communication_score, punctuality_score, value_score, cleanliness_score, trade_specific_score, overall_score, body, status, publish_at, admin_action, admin_action_reason, created_at")
    .in("status", ["pending", "frozen"])
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (res.data ?? []).map((r) => ({
    id: r.id,
    merchantSlug: r.merchant_slug,
    reviewer: {
      displayName: r.reviewer_display_name,
      tradeLabel: r.reviewer_trade_label ?? "",
      city: r.reviewer_city ?? ""
    },
    overall: Number(r.overall_score ?? overallForReview({
      quality: r.quality_score,
      communication: r.communication_score,
      punctuality: r.punctuality_score,
      value: r.value_score,
      cleanliness: r.cleanliness_score,
      trade_specific: r.trade_specific_score ?? undefined
    })),
    body: r.body,
    status: r.status,
    publishAt: r.publish_at,
    createdAt: r.created_at,
    adminAction: r.admin_action ?? null,
    adminActionReason: r.admin_action_reason ?? null
  }));

  return <AdminReviewsShell rows={rows} />;
}
