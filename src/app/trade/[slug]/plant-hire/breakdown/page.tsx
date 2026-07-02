// /<slug>/plant-hire/breakdown — 24/7 breakdown service report form.
// Renders the merchant's breakdown_service config (rates, payment
// options, terms) and captures a full breakdown report from the
// customer. Submission is a rich WhatsApp handoff so the merchant sees
// every field before dispatch.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { effectiveTier } from "@/lib/xratedTrades";
import { isPlantHireOn } from "@/lib/xratedAddons";
import { tradeLabel, whatsappDigits } from "@/lib/tradeOff";
import { TradeProfileHeader } from "@/components/xrated/TradeProfileHeader";
import { TradeProfileFooter } from "@/components/xrated/TradeProfileFooter";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { adminWhatsapp } from "@/lib/whatsapp";
import { isPlantHireConfigured, normalisePlantHireConfig } from "@/lib/plantHire";
import { PlantBreakdownForm } from "@/components/xrated/profile/PlantBreakdownForm";

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `24/7 breakdown service — ${slug}`,
    alternates: { canonical: `/${slug}/plant-hire/breakdown` }
  };
}

export default async function PlantBreakdownPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  const bd = cfg.breakdown_service;
  const wa = whatsappDigits(listing.whatsapp ?? "");
  const primary = tradeLabel(listing.primary_trade);
  const merchantName = listing.display_name ?? slug;
  const waFinal = wa || adminWhatsapp();
  const waUrl = waFinal ? `https://wa.me/${waFinal}` : "#";
  const heroTier =
    tier === "app_paid" || tier === "app_verified"
      ? "paid"
      : tier === "app_trial"
        ? "paid"
        : "free";

  return (
    <main className="flex flex-1 flex-col bg-neutral-50 pb-16">
      <TradeProfileHeader listing={listing} appName={`${primary} Service`} backHref={`/${slug}`} />
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="contact" tier={heroTier} />

      {/* Breadcrumb */}
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
        <span className="text-neutral-900">Breakdown service</span>
      </nav>

      {/* Header */}
      <section className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-red-600">
          Breakdown service · Report a fault
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-neutral-900 sm:text-4xl">
          Machine down? Report it here.
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
          Every field below helps dispatch pick the right technician, kit and parts before they
          leave the yard. SLA: <strong>{bd.sla_local_hours ?? 4}h local</strong> ·{" "}
          <strong>{bd.sla_national_hours ?? 24}h national</strong>. Submitting sends the whole
          report to {merchantName}&rsquo;s WhatsApp.
        </p>
      </section>

      {/* Form */}
      <section className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6">
        {bd.enabled ? (
          <PlantBreakdownForm
            merchantName={merchantName}
            waHref={wa ? `https://wa.me/${wa}` : null}
            config={bd}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-center">
            <p className="text-[14px] font-extrabold text-neutral-900">
              Breakdown service not configured yet.
            </p>
            <p className="mt-2 text-[12px] text-neutral-500">
              The merchant hasn&rsquo;t enabled online reports. WhatsApp them directly for emergency
              cover.
            </p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-black transition"
              style={{ background: "#FFB300" }}
            >
              WhatsApp {merchantName}
            </a>
          </div>
        )}
      </section>

      <div className="mt-auto pt-12">
        <TradeProfileFooter listing={listing} appName={`${primary} Service`} />
      </div>
    </main>
  );
}
