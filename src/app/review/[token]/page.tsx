// /review/[token] — public review submission page. No login required.

import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ReviewSubmitForm } from "./ReviewSubmitForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Leave a review — Thenetworkers",
  robots: { index: false, follow: false }
};

export default async function ReviewSubmissionPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { data: reqRow } = await supabaseAdmin
    .from("app_reviews_review_requests")
    .select(
      "id, status, expires_at, merchant_id, project_id, homeowner_id"
    )
    .eq("share_token", token)
    .maybeSingle();
  if (!reqRow) notFound();

  const [merchantRes, projectRes, homeownerRes, existingRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("display_name, trading_name, avatar_url, city, postcode_prefix")
      .eq("id", reqRow.merchant_id)
      .maybeSingle(),
    supabaseAdmin
      .from("os_projects")
      .select("title, leaf_slug")
      .eq("id", reqRow.project_id)
      .maybeSingle(),
    reqRow.homeowner_id
      ? supabaseAdmin
          .from("app_ai_visualiser_homeowners")
          .select("full_name, postcode")
          .eq("id", reqRow.homeowner_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("app_reviews_reviews")
      .select("id, rating, headline, body")
      .eq("request_id", reqRow.id)
      .maybeSingle()
  ]);

  // Mark opened once
  if (reqRow.status === "sent") {
    await supabaseAdmin
      .from("app_reviews_review_requests")
      .update({
        opened_at: new Date().toISOString(),
        status: "opened"
      })
      .eq("id", reqRow.id);
  }

  const expired = reqRow.expires_at
    ? new Date(reqRow.expires_at).getTime() < Date.now()
    : false;

  return (
    <ReviewSubmitForm
      token={token}
      merchant={merchantRes.data}
      project={projectRes.data}
      homeowner={homeownerRes.data}
      alreadyPosted={Boolean(existingRes.data)}
      expired={expired}
    />
  );
}
