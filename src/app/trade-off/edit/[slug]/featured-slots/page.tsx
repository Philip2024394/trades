// /trade-off/edit/[slug]/featured-slots — merchant places a bid
// for next Monday's Trade Center featured placement.

import { redirect, notFound } from "next/navigation";
import { getMerchantSlug } from "@/lib/merchantSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { nextMonday } from "@/lib/featuredSlotWeek";
import { FeaturedSlotsShell } from "./FeaturedSlotsShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Featured slot auction — Thenetworkers"
};

export default async function FeaturedSlotsPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getMerchantSlug();
  if (!auth) redirect("/trade-off/signup");
  if (auth !== slug) notFound();

  const week = nextMonday();
  const { data: myBid } = await supabaseAdmin
    .from("hammerex_featured_slot_bids")
    .select("id, bid_amount_pence, paid_at, status")
    .eq("merchant_slug", slug)
    .eq("week_starting", week)
    .maybeSingle();

  // Public top-of-auction indicator — everyone sees the top bid
  // (transparent auction) but not who bid it (competitive privacy).
  const { data: topBids } = await supabaseAdmin
    .from("hammerex_featured_slot_bids")
    .select("bid_amount_pence, paid_at")
    .eq("week_starting", week)
    .not("paid_at", "is", null)
    .order("bid_amount_pence", { ascending: false })
    .limit(3);

  return (
    <FeaturedSlotsShell
      slug={slug}
      weekStarting={week}
      myBid={myBid ? { id: myBid.id, pence: myBid.bid_amount_pence, paid: !!myBid.paid_at, status: myBid.status } : null}
      topBidsPence={(topBids ?? []).map((b) => b.bid_amount_pence)}
    />
  );
}
