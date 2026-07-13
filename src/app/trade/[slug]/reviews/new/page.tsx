// /trade/[slug]/reviews/new — Leave a review for a merchant.
//
// Server component that resolves the merchant, then renders the
// LeaveReviewShell client component. Non-members hit a signup CTA
// (real auth check lands with the session layer; for now the shell
// renders as if the viewer is a member so the flow can be walked
// end-to-end during design review).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { MOCK_CANTEEN_MEMBERS } from "@/lib/canteens";
import { canteenHostedByMerchantFromDb } from "@/lib/canteens.server";
import { LeaveReviewShell } from "./LeaveReviewShell";
import { BRAND, absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

function findMerchant(slug: string) {
  for (const members of Object.values(MOCK_CANTEEN_MEMBERS)) {
    const found = members.find((m) => m.slug === slug);
    if (found) return found;
  }
  return null;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const m = findMerchant(slug);
  const name = m?.displayName ?? slug;
  return {
    title: `Review ${name} | Thenetworkers`,
    description: `Leave a verified review for ${name} on Thenetworkers. Multi-dimensional rating, honest by design, 72h response window for low ratings.`,
    alternates: { canonical: `/trade/${slug}/reviews/new` },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title: `Review ${name} — Thenetworkers`,
      description: "Verified, honest, protective. Every review helps the next trade.",
      url: absolute(`/trade/${slug}/reviews/new`)
    }
  };
}

export default async function NewReviewPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = findMerchant(slug);
  if (!merchant) notFound();

  // Trade-specific dimension is derived from the merchant's primary
  // trade slug — the trade label is used to look up dimension copy in
  // TRADE_SPECIFIC_DIMENSION on the client.
  const merchantTradeSlug = slug.split("-").find((_p, i) => i > 1) ?? "";
  // Resolve the merchant's hosted canteen so the "Back to their
  // profile" success-screen link doesn't 404 on mock merchants who
  // have no /trade/{slug} row yet. Fallback is the canteens INDEX
  // (guaranteed real route) — never /trade/{slug}.
  const hostedCanteenSlug = await canteenHostedByMerchantFromDb(slug);
  const merchantHomeHref = hostedCanteenSlug
    ? `/trade-off/yard/canteens/${hostedCanteenSlug}`
    : `/trade-off/yard/canteens`;
  const merchantHomeLabel = hostedCanteenSlug ? "canteen" : "The Canteens";

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader />
      <LeaveReviewShell
        merchantSlug={slug}
        merchantDisplayName={merchant.displayName}
        merchantTradeLabel={merchant.tradeLabel}
        merchantTradeSlug={merchantTradeSlug}
        merchantCity={merchant.city}
        merchantAvatarUrl={merchant.avatarUrl}
        merchantHomeHref={merchantHomeHref}
        merchantHomeLabel={merchantHomeLabel}
      />
      <XratedFooter />
    </main>
  );
}
