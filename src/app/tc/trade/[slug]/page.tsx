// /tc/trade/[slug] — Public trade profile.
//
// The customer's entry point to a specific trade. Composes R07 identity
// + R08 rate card + Trade Center Guaranteed indicator + customer-signed
// reviews + recent-work gallery. This is the "front door" — everything
// else Trade Center gives the trade builds up to this surface.

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  PoundSterling,
  MapPin,
  MessageSquare,
  ShieldCheck
} from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { TradeProfileHero } from "@/apps/trades/components/TradeProfileHero";
import { TradeGallerySection } from "@/apps/trades/components/TradeGallerySection";
import { TradeTestimonialsSection } from "@/apps/trades/components/TradeTestimonialsSection";
import { RateCardPanel } from "@/apps/rates/components/RateCardPanel";
import { VerifiedTradeIdentityPanel } from "@/apps/identity/components/VerifiedTradeIdentityPanel";
import { findTradeIdentity } from "@/apps/identity/data/tradeIdentities";
import { findRateCard } from "@/apps/rates/data/rateCards";
import { findTradeProfile } from "@/apps/trades/data/tradeProfiles";

export const dynamic = "force-dynamic";

export default async function TradeProfilePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const identity = findTradeIdentity(slug);
  const profile = findTradeProfile(slug);
  if (!identity || !profile) notFound();

  const rateCard = findRateCard(slug);
  const reviewCount = profile.testimonials.length;
  const avgStars = reviewCount === 0
    ? 0
    : profile.testimonials.reduce((sum, t) => sum + t.starRating, 0) / reviewCount;

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
        <Link
          href="/tc/trades"
          className="inline-flex min-h-[44px] items-center gap-2 text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          All verified trades
        </Link>

        {/* Hero */}
        <div className="mt-3">
          <TradeProfileHero
            identity={identity}
            profile={profile}
            reviewCount={reviewCount}
            averageStars={avgStars}
          />
        </div>

        {/* Body — two columns on desktop */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-6">
            {/* About */}
            <section
              className="rounded-2xl border bg-white p-5 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                About
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-800">
                {profile.bio}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-neutral-600">
                <div className="inline-flex items-center gap-1">
                  <MapPin size={11}/>
                  <span>Serves {profile.serviceAreaCities.join(", ")} · {profile.serviceRadiusMiles}mi radius</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.disciplines.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-full border bg-neutral-50 px-2 py-0.5 text-[11px] font-bold text-neutral-700"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </section>

            {/* Rate card */}
            {rateCard && rateCard.visibility === "public" && (
              <RateCardPanel card={rateCard}/>
            )}

            {/* Gallery */}
            <TradeGallerySection gallery={profile.gallery}/>

            {/* Reviews */}
            <TradeTestimonialsSection testimonials={profile.testimonials}/>
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            {/* Get a quote CTA */}
            <section
              className="rounded-2xl border p-5 shadow-sm"
              style={{
                borderColor: "rgba(22,101,52,0.35)",
                backgroundColor: "#F0FDF4"
              }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#166534]">
                Get a quote
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-neutral-700">
                Message {identity.displayName.split(" ")[0]} directly. Every conversation stays
                on your Trade Center record — quote, invoice, dispute evidence all included.
              </p>
              <Link
                href={`/tc/messages?compose=${identity.slug}`}
                className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full px-5 text-[13px] font-black uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: "#166534" }}
              >
                <MessageSquare size={14} strokeWidth={2.5}/>
                Message {identity.displayName.split(" ")[0]}
              </Link>
            </section>

            {/* Trade Center Guaranteed */}
            <section
              className="rounded-2xl border bg-white p-4 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-[#166534]"/>
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#166534]">
                  Trade Center Guaranteed
                </div>
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-neutral-700">
                Any invoice over £100 has your payment held by our regulated partner (Stripe
                up to £5k, Shieldpay above) until you confirm the work is done. Trade Center
                arbitrates any dispute.
              </p>
            </section>

            {/* Verified Identity panel (compact) */}
            <VerifiedTradeIdentityPanel trade={identity} compact/>

            {/* Rate benchmark hint */}
            {rateCard && (
              <section
                className="rounded-2xl border p-4 shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FFFDF8" }}
              >
                <div className="flex items-center gap-2">
                  <PoundSterling size={12} className="text-amber-700"/>
                  <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">
                    Priced transparently
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-neutral-700">
                  Published rate card — no surprise pricing. Every line above is a fixed labour
                  rate. Trade Center never sets or recommends rates.
                </p>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
