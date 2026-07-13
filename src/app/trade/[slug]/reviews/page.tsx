// /trade/[slug]/reviews — Full-page review surface for a merchant.
//
// Server-fetches the merchant's reviews (currently from mocks; wire
// to Supabase once the hammerex_network_reviews table lands) and
// renders the ReviewsShell client component for filter/sort state.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { bayesianAggregate, dimensionAverages, reputationBadge } from "@/lib/reviews";
import { reviewsForMerchantFromDb } from "@/lib/reviews.server";
import { MOCK_CANTEEN_MEMBERS } from "@/lib/canteens";
import { canteenHostedByMerchantFromDb, canteenBannerForMerchantFromDb } from "@/lib/canteens.server";
import { recoveryStatusForMerchant } from "@/lib/recoveryStatus.server";
import { ReviewsShell } from "./ReviewsShell";
import { BRAND, absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const merchant = findMerchant(slug);
  const name = merchant?.displayName ?? slug;
  return {
    title: `Reviews for ${name} | The Network`,
    description: `Verified reviews from Network members for ${name}. Multi-dimensional ratings across quality, communication, punctuality, value, and site care.`,
    alternates: { canonical: `/trade/${slug}/reviews` },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title: `Reviews for ${name} — The Network`,
      description: `Verified member reviews across quality, communication, punctuality, value, and site care.`,
      url: absolute(`/trade/${slug}/reviews`)
    }
  };
}

// Lookup a merchant across every canteen's member list. This is a
// mock-friendly resolver; the real Supabase join lands with the DB.
function findMerchant(slug: string) {
  for (const members of Object.values(MOCK_CANTEEN_MEMBERS)) {
    const found = members.find((m) => m.slug === slug);
    if (found) return found;
  }
  return null;
}

export default async function ReviewsPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = findMerchant(slug);
  // Real DB read with mock fallback — see src/lib/reviews.server.ts.
  const reviews = await reviewsForMerchantFromDb(slug);
  const aggregate = bayesianAggregate(reviews);
  const dimensions = dimensionAverages(reviews);
  const badge = reputationBadge(reviews);
  // Route buyers back to the merchant's hosted canteen. Fallback is
  // the canteens INDEX page (`/trade-off/yard/canteens`) rather than
  // `/trade/{slug}` — the trade profile route 404s for mock merchants
  // without a real DB row, and the canteens index is guaranteed to
  // exist as a real route on The Network.
  const [hostedCanteenSlug, bannerUrl, recovery] = await Promise.all([
    canteenHostedByMerchantFromDb(slug),
    canteenBannerForMerchantFromDb(slug),
    recoveryStatusForMerchant(slug)
  ]);
  const backHref = hostedCanteenSlug
    ? `/trade-off/yard/canteens/${hostedCanteenSlug}`
    : `/trade-off/yard/canteens`;
  const backLabel = hostedCanteenSlug ? "canteen" : "The Canteens";

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader />
      <ReviewsShell
        slug={slug}
        merchantDisplayName={merchant?.displayName ?? slug}
        merchantTradeLabel={merchant?.tradeLabel ?? ""}
        merchantCity={merchant?.city ?? ""}
        merchantAvatarUrl={merchant?.avatarUrl ?? null}
        reviews={reviews}
        aggregate={aggregate}
        dimensions={dimensions}
        badge={badge}
        backHref={backHref}
        backLabel={backLabel}
        bannerUrl={bannerUrl}
        recovery={recovery}
      />
      <XratedFooter />
    </main>
  );
}
