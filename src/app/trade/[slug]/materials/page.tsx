// Dedicated /<slug>/materials page — full list of the tradesperson's
// curated merchants with soft disclosure copy. Paid + materials_network
// add-on gate; otherwise we redirect back to the main profile.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { tradeLabel, whatsappQuoteUrl } from "@/lib/tradeOff";
import { effectiveTier } from "@/lib/xratedTrades";
import { isMaterialsNetworkOn } from "@/lib/xratedAddons";

export const revalidate = 300;

type MerchantPickCard = {
  id: string;
  intro_note: string | null;
  sort_order: number;
  merchant: {
    slug: string;
    display_name: string;
    primary_trade: string;
    city: string;
    avatar_url: string | null;
  };
};

async function loadListing(slug: string): Promise<HammerexTradeOffListing | null> {
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  return (res.data ?? null) as HammerexTradeOffListing | null;
}

async function loadPicks(listingId: string): Promise<MerchantPickCard[]> {
  const picksRes = await supabase
    .from("hammerex_xrated_merchant_picks")
    .select("id, intro_note, sort_order, merchant_listing_id")
    .eq("tradie_listing_id", listingId)
    .eq("status", "live")
    .order("sort_order", { ascending: true });

  const picks = picksRes.data ?? [];
  if (picks.length === 0) return [];

  const mRes = await supabase
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, primary_trade, city, avatar_url")
    .in(
      "id",
      picks.map((p) => p.merchant_listing_id)
    )
    .eq("status", "live");

  const byId = new Map((mRes.data ?? []).map((r) => [r.id, r]));
  return picks
    .map((p) => {
      const m = byId.get(p.merchant_listing_id);
      if (!m) return null;
      return {
        id: p.id,
        intro_note: p.intro_note,
        sort_order: p.sort_order,
        merchant: {
          slug: m.slug,
          display_name: m.display_name,
          primary_trade: m.primary_trade,
          city: m.city,
          avatar_url: m.avatar_url
        }
      } satisfies MerchantPickCard;
    })
    .filter((p): p is MerchantPickCard => p !== null);
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Materials" };
  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const primary = tradeLabel(listing.primary_trade);
  return {
    title: `${firstName}'s trade materials — ${primary} in ${listing.city} | Xrated`,
    description: `${firstName}'s preferred builder's merchants and material suppliers in ${listing.city}.`,
    alternates: { canonical: `/${slug}/materials` }
  };
}

export default async function MaterialsPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid";
  if (!isPaid || !isMaterialsNetworkOn(listing)) redirect(`/${slug}`);

  const picks = await loadPicks(listing.id);
  const primary = tradeLabel(listing.primary_trade);
  const waUrl = whatsappQuoteUrl(
    listing.whatsapp,
    listing.display_name,
    primary
  );
  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;

  return (
    <main className="flex flex-1 flex-col pb-20 md:pb-0">
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="profile" />

      <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
        <a
          href={`/${slug}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:text-sm"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to {firstName}&rsquo;s profile
        </a>

        <div className="mt-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Trade materials &amp; companies {firstName} works with
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl md:text-4xl">
            Where {firstName} buys{" "}
            <span style={{ color: "#FFB300" }}>trade materials.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-neutral-600 sm:text-sm">
            Builder&rsquo;s merchants, materials yards, and tool suppliers {firstName} actually uses. Tap any tile to browse and send a WhatsApp quote.
          </p>

          {/* Soft disclosure — required on the dedicated materials page
              by the Materials Network compliance copy. Always renders
              the line, even when the picks list is empty, so the customer
              sees the policy regardless. */}
          <div
            className="mt-5 rounded-2xl border px-4 py-3 sm:px-5"
            style={{
              borderColor: "rgba(255,179,0,0.4)",
              background: "rgba(255,179,0,0.08)"
            }}
          >
            <p className="text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
              <span className="font-extrabold text-neutral-900">
                {firstName}
              </span>{" "}
              may earn a referral fee from these merchants &mdash; it costs you nothing extra.
            </p>
          </div>
        </div>
      </section>

      {picks.length === 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6">
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center">
            <p className="text-sm font-bold text-neutral-900">
              {firstName} hasn&rsquo;t added any merchants yet.
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Check back soon &mdash; or message {firstName} directly for a recommendation.
            </p>
          </div>
        </section>
      ) : (
        <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {picks.map((p) => {
              const initials = p.merchant.display_name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? "")
                .join("");
              return (
                <li key={p.id}>
                  <a
                    href={`/${listing.slug}/materials/${p.merchant.slug}`}
                    className="group flex h-full items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-[#FFB300] hover:shadow-md"
                  >
                    <span
                      className="block h-14 w-14 shrink-0 overflow-hidden rounded-full bg-neutral-200 ring-2 ring-white shadow-sm"
                      style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    >
                      {p.merchant.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.merchant.avatar_url}
                          alt={p.merchant.display_name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-black text-base font-extrabold text-[#FFB300]">
                          {initials || "M"}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span
                        className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900 sm:text-[11px]"
                        style={{ background: "#FFB300" }}
                      >
                        Merchant
                      </span>
                      <p className="mt-1.5 truncate text-sm font-extrabold text-neutral-900 sm:text-base">
                        {p.merchant.display_name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500 sm:text-sm">
                        {p.merchant.city}
                      </p>
                      {p.intro_note && (
                        <p className="mt-2 line-clamp-3 text-xs italic leading-relaxed text-neutral-600 sm:text-[13px]">
                          &ldquo;{p.intro_note}&rdquo;
                        </p>
                      )}
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500 transition group-hover:text-[#FFB300] sm:text-xs">
                        Browse merchant &amp; send quote
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition group-hover:translate-x-0.5">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-auto">
        {!isPaid && <XratedHeader />}
        <XratedFooter />
      </div>
    </main>
  );
}
