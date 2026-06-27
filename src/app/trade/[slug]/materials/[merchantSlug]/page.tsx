// /<slug>/materials/<merchantSlug>
//
// Customer landing surface where the attribution chain begins. Renders
// the merchant's profile in a compact "you're here via {tradie}"
// presentation, plus the soft disclosure line and a "Send quote on
// WhatsApp" button that posts to the referral-create API and opens
// WhatsApp with the MN-{ref_code} attribution token in the message.
//
// Gates: tradie must be paid + materials_network on; merchant must
// be live + not paused; pair must be a live pick. Any failure
// redirects back to the tradie's materials page.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { effectiveTier } from "@/lib/xratedTrades";
import { isMaterialsNetworkOn } from "@/lib/xratedAddons";
import { tradeLabel } from "@/lib/tradeOff";
import { MaterialsQuoteButton } from "@/components/xrated/profile/MaterialsQuoteButton";

export const revalidate = 0;

async function loadListing(slug: string): Promise<HammerexTradeOffListing | null> {
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  return (res.data ?? null) as HammerexTradeOffListing | null;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string; merchantSlug: string }>;
}): Promise<Metadata> {
  const { slug, merchantSlug } = await params;
  return {
    title: `Materials enquiry via Xrated`,
    description: `Send a WhatsApp quote enquiry — referred by ${slug}.`,
    alternates: { canonical: `/${slug}/materials/${merchantSlug}` },
    robots: { index: false }
  };
}

export default async function MerchantDeepLinkPage({
  params
}: {
  params: Promise<{ slug: string; merchantSlug: string }>;
}) {
  const { slug, merchantSlug } = await params;
  const tradie = await loadListing(slug);
  if (!tradie) notFound();

  const tier = effectiveTier(tradie);
  const isPaid = tier === "app_trial" || tier === "app_paid";
  if (!isPaid || !isMaterialsNetworkOn(tradie)) redirect(`/${slug}`);

  const merchant = await loadListing(merchantSlug);
  if (!merchant) redirect(`/${slug}/materials`);
  if (merchant.materials_network_paused) redirect(`/${slug}/materials`);

  const pickRes = await supabase
    .from("hammerex_xrated_merchant_picks")
    .select("id, intro_note")
    .eq("tradie_listing_id", tradie.id)
    .eq("merchant_listing_id", merchant.id)
    .eq("status", "live")
    .maybeSingle();
  if (!pickRes.data) redirect(`/${slug}/materials`);

  const tradieFirstName =
    tradie.display_name.split(/\s+/)[0] ?? tradie.display_name;
  const merchantTrade = tradeLabel(merchant.primary_trade);
  const introNote = pickRes.data.intro_note;
  const merchantInitials = merchant.display_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <main className="flex flex-1 flex-col bg-white pb-20 md:pb-0">
      <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-10">
        <a
          href={`/${slug}/materials`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:text-sm"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to {tradieFirstName}&rsquo;s merchants
        </a>

        <div className="mt-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Referred by {tradieFirstName}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
            {merchant.display_name}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {merchantTrade} &middot; {merchant.city}
          </p>
        </div>

        <div className="mt-6 flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
          <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-full bg-neutral-200 ring-2 ring-white shadow-sm">
            {merchant.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={merchant.avatar_url}
                alt={merchant.display_name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-black text-base font-extrabold text-[#FFB300]">
                {merchantInitials || "M"}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            {introNote && (
              <p className="text-[13px] italic leading-relaxed text-neutral-600 sm:text-sm">
                &ldquo;{introNote}&rdquo;{" "}
                <span className="not-italic font-bold text-neutral-500">
                  &mdash; {tradieFirstName}
                </span>
              </p>
            )}
            {merchant.bio && (
              <p
                className={`whitespace-pre-line text-[13px] leading-relaxed text-neutral-700 sm:text-sm ${introNote ? "mt-3" : ""}`}
              >
                {merchant.bio.length > 320
                  ? `${merchant.bio.slice(0, 320).trim()}…`
                  : merchant.bio}
              </p>
            )}
            <a
              href={`/${merchant.slug}`}
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-neutral-600 underline-offset-2 transition hover:text-[#FFB300] hover:underline"
            >
              See {merchant.display_name.split(/\s+/)[0] ?? merchant.display_name}&rsquo;s full profile
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
          </div>
        </div>

        <div
          className="mt-5 rounded-2xl border px-4 py-3 sm:px-5"
          style={{
            borderColor: "rgba(255,179,0,0.4)",
            background: "rgba(255,179,0,0.08)"
          }}
        >
          <p className="text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
            <span className="font-extrabold text-neutral-900">{tradieFirstName}</span>{" "}
            may earn a referral fee from {merchant.display_name} &mdash; it costs you nothing extra.
          </p>
        </div>

        <div className="mt-6">
          <MaterialsQuoteButton
            tradieSlug={tradie.slug}
            merchantSlug={merchant.slug}
            merchantDisplayName={merchant.display_name}
            merchantWhatsapp={merchant.whatsapp}
            tradieDisplayName={tradie.display_name}
          />
          <p className="mt-3 text-[12px] text-neutral-500">
            Tapping &ldquo;Send quote on WhatsApp&rdquo; opens {merchant.display_name}&rsquo;s WhatsApp with a short message including your referral code. No card payment in the app &mdash; {merchant.display_name} replies with a final quote.
          </p>
        </div>
      </section>

      <div className="mt-auto">
        <XratedFooter />
      </div>
    </main>
  );
}
