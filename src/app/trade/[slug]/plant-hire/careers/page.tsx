// /<slug>/plant-hire/careers — full drivers-wanted page, moved off the
// plant hire home so the recruitment content has room to breathe.

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
import { PlantDriverRecruitmentSection } from "@/components/xrated/profile/PlantHireExtraSections";
import { PlantCareersApplicationForm } from "@/components/xrated/profile/PlantCareersApplicationForm";
import { DRIVER_POSITION_PRESETS } from "@/lib/plantHire";

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Careers · Drivers wanted — ${slug}`,
    alternates: { canonical: `/${slug}/plant-hire/careers` }
  };
}

export default async function CareersPage({
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
  if (!cfg.driver_recruitment.enabled) redirect(`/${slug}/plant-hire`);

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
        <span className="text-neutral-900">Careers</span>
      </nav>

      <section className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          We are hiring
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-neutral-900 sm:text-4xl">
          Drivers, mechanics, yard, office — join {merchantName}.
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
          Full application below — pick your role(s), tell us about your experience, attach your
          CV. We reply on WhatsApp inside 2 working days.
        </p>
        {cfg.driver_recruitment.positions_available.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {cfg.driver_recruitment.positions_available.map((slug) => {
              const meta = DRIVER_POSITION_PRESETS.find((p) => p.slug === slug);
              if (!meta) return null;
              return (
                <span
                  key={slug}
                  className="inline-flex items-center rounded-full bg-neutral-900 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white"
                >
                  Open · {meta.label}
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* Snapshot — location, salary display, benefits */}
      <section className="mx-auto mt-4 w-full max-w-4xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cfg.driver_recruitment.salary_range_display && (
            <SnapshotCard
              kicker="Salary"
              value={cfg.driver_recruitment.salary_range_display}
              body="Guide range — depends on role + experience."
            />
          )}
          {cfg.driver_recruitment.base_location && (
            <SnapshotCard
              kicker="Base"
              value={cfg.driver_recruitment.base_location}
              body="Home-run daily from the yard."
            />
          )}
          <SnapshotCard
            kicker="Turnaround"
            value={`${cfg.driver_recruitment.turnaround_days ?? 2} working days`}
            body="Reply time on your application."
          />
        </div>
        {cfg.driver_recruitment.benefits.length > 0 && (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cfg.driver_recruitment.benefits.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2 rounded-2xl border border-neutral-200 bg-white p-3 text-[12px] font-bold text-neutral-800"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-black"
                  style={{ background: "#FFB300" }}
                >
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto mt-6 w-full max-w-4xl px-4 pb-4 sm:px-6">
        <PlantCareersApplicationForm
          merchantName={merchantName}
          merchantSlug={listing.slug}
          waHref={wa ? `https://wa.me/${wa}` : null}
          cfg={cfg.driver_recruitment}
        />
      </section>

      {/* Old PDF-form / whatsapp CTAs remain as an optional shortcut. */}
      {(cfg.driver_recruitment.pdf_download_enabled && cfg.driver_recruitment.pdf_url) && (
        <section className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center">
            <p className="text-[11px] text-neutral-600">
              Prefer paper? Download the application form and hand it in at the yard.
            </p>
            <a
              href={cfg.driver_recruitment.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex h-10 items-center rounded-xl border border-neutral-200 bg-white px-3 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900 hover:bg-neutral-50"
            >
              Download PDF form
            </a>
          </div>
        </section>
      )}

      <div className="mt-auto pt-12">
        <TradeProfileFooter listing={listing} appName={`${primary} Service`} />
      </div>
    </main>
  );
}

function SnapshotCard({ kicker, value, body }: { kicker: string; value: string; body: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        {kicker}
      </p>
      <p className="mt-1 text-[15px] font-extrabold text-neutral-900">{value}</p>
      <p className="mt-1 text-[11px] text-neutral-500">{body}</p>
    </div>
  );
}
