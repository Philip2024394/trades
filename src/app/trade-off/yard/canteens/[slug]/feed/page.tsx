// /trade-off/yard/canteens/[slug]/feed — full scrollable canteen feed.
//
// Reached from the bottom nav's "Feed" tab. Renders every canteen post
// as a full CanteenPostCard-style card with reactions, replies, LIVE
// badges, and (for owners) edit/delete controls.
//
// Reads real DB posts via canteenPostsFromDb — falls back to demo mock
// posts when the DB is empty so the page stays populated during
// development and early rollout.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  canteenBySlugFromDb,
  canteenPostsFromDb
} from "@/lib/canteens.server";
import { getCurrentTrade } from "@/lib/tradeAuth";
import { BRAND } from "@/lib/seo";
import { CanteenFeedShell } from "./CanteenFeedShell";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) return { title: `Feed | ${BRAND.name}` };
  return {
    title: `${canteen.name} · Feed | ${BRAND.name}`,
    description: `Every post from ${canteen.name} — the live construction feed.`,
    alternates: { canonical: `/trade-off/yard/canteens/${slug}/feed` }
  };
}

export default async function CanteenFeedPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await params;
  const { filter } = await searchParams;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) notFound();
  const viewer = await getCurrentTrade();
  const isHost = viewer?.slug === canteen.hostSlug;
  const posts = await canteenPostsFromDb(canteen.id);

  return (
    <CanteenFeedShell
      canteenSlug={canteen.slug}
      canteenName={canteen.name}
      tradeLabel={canteen.tradeLabel}
      hostSlug={canteen.hostSlug}
      hostDisplayName={canteen.hostDisplayName}
      viewerSlug={viewer?.slug ?? null}
      isHost={isHost}
      posts={posts}
      filter={filter ?? "all"}
    />
  );
}
