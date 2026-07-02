// /<slug>/plant-hire/pay/cancel — Stripe redirects here if the customer
// cancels checkout.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { effectiveTier } from "@/lib/xratedTrades";
import { isPlantHireOn } from "@/lib/xratedAddons";
import { tradeLabel } from "@/lib/tradeOff";

export const metadata: Metadata = { title: "Payment cancelled" };

type SearchParams = Promise<{ ref?: string }>;

export default async function PayCancelPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const listingRes = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (!listingRes.data) notFound();
  const listing = listingRes.data;

  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid" || tier === "app_verified";
  if (!isPaid || !isPlantHireOn(listing)) redirect(`/${slug}`);

  const primary = tradeLabel(listing.primary_trade);
  const merchantName = listing.display_name ?? slug;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center bg-neutral-50 px-4 py-16 text-center">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Checkout cancelled · {primary}
      </p>
      <h1 className="mt-4 text-3xl font-extrabold text-neutral-900 sm:text-4xl">
        Payment cancelled.
      </h1>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-neutral-600">
        No charge taken. Your booking with {merchantName} is still held for 24 hours — retry
        card payment or use one of the alternative accepted methods.
      </p>
      {sp.ref && (
        <p className="mt-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
          Ref · {sp.ref}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          href={`/${slug}/plant-hire/pay${sp.ref ? `?ref=${sp.ref}` : ""}`}
          className="inline-flex h-11 items-center rounded-xl bg-[#FFB300] px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 hover:brightness-95"
        >
          Retry payment →
        </Link>
        <Link
          href={`/${slug}/plant-hire/my-hires`}
          className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-800 hover:bg-neutral-50"
        >
          Open my hires
        </Link>
      </div>
    </main>
  );
}
