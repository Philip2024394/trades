// Auth-gated layout for the entire /affiliates/dashboard tree.
//
// Verifies the affiliate session cookie, loads the affiliate row, and
// renders the persistent dashboard chrome (header with burger, drawer).
// Pages below this layout can assume the session is valid and the
// affiliate exists + is active.
import { redirect } from "next/navigation";
import { readAffiliateSessionServer } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { AffiliateDashboardChrome } from "./AffiliateDashboardChrome";

export const dynamic = "force-dynamic";

export default async function AffiliateDashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await readAffiliateSessionServer();
  if (!session) {
    redirect("/affiliates/login");
  }

  const { data: affiliate } = await supabaseAdmin
    .from("hammerex_affiliates")
    .select(
      "affiliate_id, status, first_name, last_name, company_name, avatar_url, payment_details_completed_at, payment_alert_flag"
    )
    .eq("affiliate_id", session.affiliate_id)
    .maybeSingle();

  if (!affiliate || affiliate.status !== "active") {
    redirect("/affiliates/login");
  }

  const displayName =
    [affiliate.first_name, affiliate.last_name].filter(Boolean).join(" ") ||
    affiliate.company_name ||
    `Affiliate #${affiliate.affiliate_id}`;

  return (
    <AffiliateDashboardChrome
      affiliateId={affiliate.affiliate_id}
      displayName={displayName}
      avatarUrl={affiliate.avatar_url ?? null}
      paymentDetailsCompleted={Boolean(affiliate.payment_details_completed_at)}
    >
      {children}
    </AffiliateDashboardChrome>
  );
}
