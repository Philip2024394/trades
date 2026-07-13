// /trade-off/yard/canteens/[slug]/jobs — portfolio page.
//
// Reached from the "My Jobs" quick action on the canteen page and from
// customer-facing links. Auto-pulls canteen posts tagged `showcase`
// (the mood_slug set when a trade posts under the Showcase kind) and
// renders them as a photo-first portfolio grid — one output feeding
// both the owner's brag wall and the customer's trust surface.
//
// Owner controls (isHost === true):
//   • Feature toggle per job (pins to top of portfolio for 30 days)
//   • Edit / delete via the same overflow menu as the Feed page
//
// Customer surfaces:
//   • Group by location / job type
//   • Optional customer pull-quote per group
//   • "Book similar work" WhatsApp CTA on every card

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  canteenBySlugFromDb,
  canteenPostsFromDb,
  adminForCanteenFromDb
} from "@/lib/canteens.server";
import { getCurrentTrade } from "@/lib/tradeAuth";
import { BRAND } from "@/lib/seo";
import { CanteenJobsShell } from "./CanteenJobsShell";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) return { title: `Jobs | ${BRAND.name}` };
  return {
    title: `${canteen.hostDisplayName} · Jobs | ${BRAND.name}`,
    description: `Recent completed jobs by ${canteen.hostDisplayName} — real photos, real feedback.`,
    alternates: { canonical: `/trade-off/yard/canteens/${slug}/jobs` }
  };
}

export default async function CanteenJobsPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) notFound();
  const viewer = await getCurrentTrade();
  const admin = await adminForCanteenFromDb(canteen.id);
  const isHost = viewer?.slug === canteen.hostSlug;
  const posts = await canteenPostsFromDb(canteen.id);
  // Filter to showcase posts (jobs) with at least one photo — a job
  // without a photo isn't a portfolio item, no matter what it's tagged.
  const jobs = posts.filter((p) => p.moodSlug === "showcase" && p.photoUrls && p.photoUrls.length > 0);

  return (
    <CanteenJobsShell
      canteenSlug={canteen.slug}
      canteenName={canteen.name}
      tradeLabel={canteen.tradeLabel}
      hostDisplayName={canteen.hostDisplayName}
      hostWhatsapp={admin?.whatsapp ?? null}
      isHost={isHost}
      jobs={jobs}
    />
  );
}
