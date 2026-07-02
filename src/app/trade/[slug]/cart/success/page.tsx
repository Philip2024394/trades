// Order success page — customer lands here after returning from the
// payment provider's hosted checkout. We confirm the order using the
// session-stored order_ref (Payment Link mode) or — in Phases 2-5 — a
// webhook-verified status flip (the provider tells us, we just show
// the receipt).
//
// Payment Link mode caveat: we can't independently verify the payment
// because hosted-link providers don't all webhook us. The order is
// marked 'paid' with metadata.verify_in_provider_dashboard so the
// merchant knows to double-check in their own Worldpay / SumUp / etc.
// dashboard before fulfilling. UI tells the customer this clearly.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { TradeProfileHeader } from "@/components/xrated/TradeProfileHeader";
import { TradeProfileFooter } from "@/components/xrated/TradeProfileFooter";
import { tradeLabel } from "@/lib/tradeOff";
import { CartSuccessConfirm } from "@/components/xrated/profile/merchant/CartSuccessConfirm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false }
};

export default async function CartSuccessPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (!listing.data) notFound();
  const appName = `${tradeLabel(listing.data.primary_trade)} Service`;

  return (
    <main className="flex flex-1 flex-col bg-white pb-20">
      <TradeProfileHeader listing={listing.data} appName={appName} backHref={`/${slug}/shop`} />
      <CartSuccessConfirm listingSlug={slug} merchantName={listing.data.display_name ?? slug} />
      <div className="mt-auto">
        <TradeProfileFooter listing={listing.data} appName={appName} />
      </div>
    </main>
  );
}
