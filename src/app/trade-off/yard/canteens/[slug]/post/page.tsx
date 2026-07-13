// /trade-off/yard/canteens/[slug]/post — mobile compose overlay page.
//
// Reached from the mobile canteen page's "Post to this canteen" CTA and
// from each rotator card's "Reply" chip. Renders the canteen's own
// hero image full-screen, then floats a bottom-anchored composer card
// that covers ~20% of the viewport height. Feels intentional (not a
// modal) but still keeps the canteen visually present behind the form.
//
// Post creation POSTs to /api/canteens/[slug]/posts/create — the same
// endpoint the inline composer uses — so this stays wire-compatible
// with the existing feed. On success we bounce back to the canteen
// with router.refresh() so the rotator picks up the new post.

import { notFound } from "next/navigation";
import { canteenBySlugFromDb } from "@/lib/canteens.server";
import { CanteenComposeOverlay } from "./CanteenComposeOverlay";

export const dynamic = "force-dynamic";

export default async function CanteenComposePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reply?: string }>;
}) {
  const { slug } = await params;
  const { reply } = await searchParams;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) notFound();

  return (
    <CanteenComposeOverlay
      canteenSlug={canteen.slug}
      canteenName={canteen.name}
      tradeLabel={canteen.tradeLabel}
      hostDisplayName={canteen.hostDisplayName}
      headerBgUrl={canteen.headerBgUrl}
      replyToId={reply ?? null}
    />
  );
}
