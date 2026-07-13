// /trade/[slug]/reviews/pending — merchant's dispute dashboard.
//
// Shows every review currently in the 72h cool-off window for the
// signed-in merchant. Each row exposes three actions:
//   1. Respond publicly     → /api/reviews/moderate/[id]/respond
//   2. Dispute with evidence → /api/reviews/moderate/[id]/dispute (freezes)
//   3. Wait (do nothing)    — the 72h cron publishes when publish_at
//                              passes and admin hasn't frozen the row

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { overallForReview } from "@/lib/reviews";
import { BRAND, absolute } from "@/lib/seo";
import { PendingReviewsShell } from "./PendingReviewsShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pending reviews · The Network",
  description: "Reviews in the 72h response window. Reply, dispute with evidence, or let the window close.",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Pending reviews",
    description: "72h response window — private merchant surface",
    url: absolute("/trade/pending")
  }
};

export default async function PendingReviewsPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const authedSlug = await getMerchantSlug();
  if (!authedSlug || authedSlug !== slug) {
    // Only the merchant themselves can see their pending reviews.
    // Anonymous or wrong-merchant callers get bounced to login.
    redirect(`/trade-off/login?next=/trade/${slug}/reviews/pending`);
  }

  const res = await supabaseAdmin
    .from("hammerex_network_reviews")
    .select("id, reviewer_display_name, reviewer_trade_label, reviewer_city, quality_score, communication_score, punctuality_score, value_score, cleanliness_score, trade_specific_score, body, publish_at, created_at")
    .eq("merchant_slug", slug)
    .eq("status", "pending")
    .order("publish_at", { ascending: true });

  const pending = (res.data ?? []).map((r) => ({
    id: r.id,
    reviewer: {
      displayName: r.reviewer_display_name,
      tradeLabel: r.reviewer_trade_label ?? "",
      city: r.reviewer_city ?? ""
    },
    overall: overallForReview({
      quality: r.quality_score,
      communication: r.communication_score,
      punctuality: r.punctuality_score,
      value: r.value_score,
      cleanliness: r.cleanliness_score,
      trade_specific: r.trade_specific_score ?? undefined
    }),
    body: r.body,
    publishAt: r.publish_at,
    createdAt: r.created_at
  }));

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader />
      <PendingReviewsShell merchantSlug={slug} pending={pending} />
      <XratedFooter />
    </main>
  );
}
