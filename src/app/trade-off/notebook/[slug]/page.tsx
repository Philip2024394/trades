// /trade-off/notebook/[slug] — The Notebook, private merchant view.
//
// One canonical feed of every business event about the merchant:
// leads, reviews, canteen mentions, product enquiries, boost
// campaigns, profile-view milestones, Yard mentions. Only the
// merchant (and admins) see this. Auth will land with the session
// layer — until then the page trusts the slug and renders the mock
// events so the surface is walkable end-to-end.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { weekStats } from "@/lib/notebook";
import { eventsForMerchantFromDb } from "@/lib/notebook.server";
import { MOCK_CANTEEN_MEMBERS } from "@/lib/canteens";
import { canteenHostedByMerchantFromDb, canteenBannerForMerchantFromDb } from "@/lib/canteens.server";
import { NotebookShell } from "./NotebookShell";
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
    title: `${name}'s Notebook | The Network`,
    description: `Private business feed for ${name}. Leads, reviews, canteen mentions, product enquiries, boost campaigns — all in one journal.`,
    alternates: { canonical: `/trade-off/notebook/${slug}` },
    // Notebook is private by design — no OG image, no share preview,
    // robots off. The route stays behind a token in production.
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title: `${name}'s Notebook`,
      description: "Private business feed. Only the merchant sees this.",
      url: absolute(`/trade-off/notebook/${slug}`)
    }
  };
}

export default async function NotebookPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = findMerchant(slug);
  if (!merchant) notFound();

  const events = await eventsForMerchantFromDb(slug);
  const stats = weekStats(events);
  const [bannerUrl, hostedCanteenSlug] = await Promise.all([
    canteenBannerForMerchantFromDb(slug),
    canteenHostedByMerchantFromDb(slug)
  ]);
  const canteenHref = hostedCanteenSlug
    ? `/trade-off/yard/canteens/${hostedCanteenSlug}`
    : `/trade/${slug}`;

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader />
      <NotebookShell
        merchantSlug={slug}
        merchantDisplayName={merchant.displayName}
        merchantTradeLabel={merchant.tradeLabel}
        merchantCity={merchant.city}
        merchantAvatarUrl={merchant.avatarUrl}
        bannerUrl={bannerUrl}
        canteenHref={canteenHref}
        events={events}
        stats={stats}
      />
      <XratedFooter />
    </main>
  );
}
