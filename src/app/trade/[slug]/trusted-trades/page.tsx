// Legacy /trusted-trades route — superseded by /trade-circle in V2.
//
// This route existed as a paid-tier gated page reading listing.recommendations.
// V2 unifies the concept as the Trade Circle graph (curated edges in
// os_business_endorsements + auto-populated fills from the paid pool).
// Every URL that pointed here permanently redirects to /trade-circle
// so no bookmark 404s.

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyTrustedTradesRedirect({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/trade/${slug}/trade-circle`);
}
