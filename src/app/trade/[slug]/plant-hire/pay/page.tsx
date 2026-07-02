// /<slug>/plant-hire/pay?booking=<ref> — routes the customer to Stripe
// Checkout when the platform is Stripe-enabled, or shows the merchant's
// accepted payment methods (WhatsApp + BACS + PayPal link etc.) as a
// fallback.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { effectiveTier } from "@/lib/xratedTrades";
import { isPlantHireOn } from "@/lib/xratedAddons";
import { tradeLabel, whatsappDigits } from "@/lib/tradeOff";
import { TradeProfileHeader } from "@/components/xrated/TradeProfileHeader";
import { TradeProfileFooter } from "@/components/xrated/TradeProfileFooter";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { adminWhatsapp } from "@/lib/whatsapp";
import { isPlantHireConfigured, normalisePlantHireConfig } from "@/lib/plantHire";
import { PlantAcceptedPayments } from "@/components/xrated/profile/PlantAcceptedPayments";
import { PayNowButton } from "@/components/xrated/profile/PayNowButton";
import { isStripeConfigured } from "@/lib/plantStripe";

export const revalidate = 0;

type SearchParams = Promise<{ booking?: string; ref?: string }>;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Pay deposit — ${slug}`,
    alternates: { canonical: `/${slug}/plant-hire/pay` }
  };
}

export default async function PayPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const reference = sp.ref ?? sp.booking ?? "";

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

  const cfg = normalisePlantHireConfig(listing.plant_hire);
  if (!isPlantHireConfigured(cfg)) redirect(`/${slug}`);

  const wa = whatsappDigits(listing.whatsapp ?? "");
  const waFinal = wa || adminWhatsapp();
  const waUrl = waFinal ? `https://wa.me/${waFinal}` : "#";
  const primary = tradeLabel(listing.primary_trade);
  const merchantName = listing.display_name ?? slug;
  const heroTier =
    tier === "app_paid" || tier === "app_verified"
      ? "paid"
      : tier === "app_trial"
        ? "paid"
        : "free";

  const stripeReady = isStripeConfigured();
  let booking: {
    id: string;
    reference: string;
    machine_label: string | null;
    machine_slug: string;
    quantity: number;
    duration: string;
    subtotal_pence: number | null;
    deposit_pence: number | null;
    deposit_status: string;
  } | null = null;
  if (reference) {
    const b = await supabaseAdmin
      .from("hammerex_plant_hire_bookings")
      .select(
        "id, reference, machine_label, machine_slug, quantity, duration, subtotal_pence, deposit_pence, deposit_status"
      )
      .eq("reference", reference)
      .maybeSingle();
    booking = b.data;
  }

  return (
    <main className="flex flex-1 flex-col bg-neutral-50 pb-16">
      <TradeProfileHeader listing={listing} appName={`${primary} Service`} backHref={`/${slug}`} />
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="contact" tier={heroTier} />

      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex w-full max-w-4xl items-center gap-2 px-4 pt-6 text-[11px] font-bold uppercase tracking-widest text-neutral-500 sm:px-6"
      >
        <Link href={`/${slug}`} className="transition hover:text-[#FFB300]">
          {merchantName}
        </Link>
        <span aria-hidden="true">›</span>
        <Link href={`/${slug}/plant-hire`} className="transition hover:text-[#FFB300]">
          Plant Hire
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-neutral-900">Pay deposit</span>
      </nav>

      <section className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Pay · Deposit
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-neutral-900 sm:text-4xl">
          {booking ? `Deposit for ${booking.reference}` : "Pay a deposit"}
        </h1>
        {booking && (
          <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">
            {booking.machine_label ?? booking.machine_slug} · {booking.quantity} × 1{" "}
            {booking.duration}
            {booking.subtotal_pence
              ? ` · Subtotal £${(booking.subtotal_pence / 100).toFixed(2)}`
              : ""}
          </p>
        )}
      </section>

      <section className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-6 sm:px-6">
        {!booking && reference && (
          <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-6 text-center">
            <p className="text-[14px] font-extrabold text-neutral-900">
              Booking not found for reference {reference}.
            </p>
            <p className="mt-1 text-[12px] text-neutral-500">
              Ask the merchant to WhatsApp you a fresh payment link.
            </p>
          </div>
        )}

        {booking && booking.deposit_status === "paid" && (
          <div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-6 text-center">
            <p className="text-[18px] font-extrabold text-emerald-900">
              ✓ Deposit received
            </p>
            <p className="mt-1 text-[12px] text-emerald-800">
              Your booking is confirmed. See it any time under My Hires.
            </p>
          </div>
        )}

        {booking && booking.deposit_status !== "paid" && (
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
              Deposit to pay
            </p>
            <p className="mt-1 text-[36px] font-extrabold text-neutral-900">
              £{((booking.deposit_pence ?? 0) / 100).toFixed(2)}
            </p>
            {stripeReady ? (
              <>
                <p className="mt-2 text-[13px] text-neutral-600">
                  Pay by card via Stripe Checkout — secure hosted page. Card is charged when you
                  complete checkout; you&rsquo;ll be redirected back here.
                </p>
                <PayNowButton bookingReference={booking.reference} />
              </>
            ) : (
              <p className="mt-2 text-[13px] text-neutral-600">
                Card checkout is not enabled on this platform. Use one of the accepted payment
                methods below, or WhatsApp {merchantName} for a payment link.
              </p>
            )}
          </div>
        )}

        {cfg.payment_gateways.enabled && (
          <PlantAcceptedPayments cfg={cfg.payment_gateways} />
        )}

        <Link
          href={`/${slug}/plant-hire/my-hires`}
          className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-800 hover:bg-neutral-50"
        >
          ← Back to my hires
        </Link>
      </section>

      <div className="mt-auto pt-12">
        <TradeProfileFooter listing={listing} appName={`${primary} Service`} />
      </div>
    </main>
  );
}
