// Legacy /tc/marketplace/* URLs — permanent redirect to /tc/trade-center/*.
//
// The section was renamed from "marketplace" to "trade-center" to match
// the visible page-header wordmark (per product spec 2026-07-12). This
// catch-all preserves every prior link, bookmark, and inbound share by
// forwarding it to the new URL with the same path shape.

import { redirect, permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyMarketplaceRedirect({
  params
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const path = slug && slug.length > 0 ? "/" + slug.join("/") : "";
  // Use permanentRedirect so search engines re-index the new URL.
  // On the root (`/tc/marketplace` with no path) redirect to the default
  // landing category — same behaviour as the previous /tc/marketplace/page.tsx.
  if (!path) {
    permanentRedirect("/tc/trade-center/plastering");
  }
  permanentRedirect(`/tc/trade-center${path}`);
  // Unreachable but keeps TS happy.
  redirect(`/tc/trade-center${path}`);
}
