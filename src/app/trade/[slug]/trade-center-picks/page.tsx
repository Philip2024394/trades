// Dedicated "Trade Center Picks" page.
//
// Marketing surface — INDEXABLE by default. A customer searching
// "ladders on promo Camden" should be able to discover the merchant.
// Mirrors the job-diary / downloads server-shell pattern: hero up top
// so the visitor knows whose yard this is, then the full grid of
// active picks (with status chip, note, arrival date), then the
// shared "join Xrated" footer CTA.
//
// Gated to paid tier AND `trade_center_picks` add-on enabled AND the
// listing is a merchant-grade trade. Anything else bounces to /<slug>.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedTradeCenterPick,
  type HammerexXratedProduct
} from "@/lib/supabase";
import { TradeProfileFooter } from "@/components/xrated/TradeProfileFooter";
import { TradeProfileHeader } from "@/components/xrated/TradeProfileHeader";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { TradeCenterPickStatusChip } from "@/components/xrated/profile/merchant/TradeCenterPickStatusChip";
import {
  isMerchantGradeTrade,
  tradeLabel,
  whatsappQuoteUrl
} from "@/lib/tradeOff";
import { effectiveTier } from "@/lib/xratedTrades";
import { isTradeCenterPicksOn } from "@/lib/xratedAddons";

export const revalidate = 300;

async function loadListing(
  slug: string
): Promise<HammerexTradeOffListing | null> {
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  return (res.data ?? null) as HammerexTradeOffListing | null;
}

type PickWithProduct = HammerexXratedTradeCenterPick & {
  product: Pick<
    HammerexXratedProduct,
    "id" | "name" | "slug" | "cover_url"
  > | null;
};

async function loadActivePicks(listingId: string): Promise<PickWithProduct[]> {
  const nowIso = new Date().toISOString();
  const res = await supabase
    .from("hammerex_xrated_trade_center_picks")
    .select("*")
    .eq("listing_id", listingId)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("sort_order", { ascending: true })
    .order("effective_at", { ascending: false });
  const rows = (res.data ?? []) as HammerexXratedTradeCenterPick[];
  if (rows.length === 0) return [];

  const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
  const prods = await supabase
    .from("hammerex_xrated_products")
    .select("id, name, slug, cover_url")
    .in("id", productIds);
  const byId = new Map<
    string,
    Pick<HammerexXratedProduct, "id" | "name" | "slug" | "cover_url">
  >();
  for (const p of (prods.data ?? []) as Pick<
    HammerexXratedProduct,
    "id" | "name" | "slug" | "cover_url"
  >[]) {
    byId.set(p.id, p);
  }
  return rows.map((r) => ({ ...r, product: byId.get(r.product_id) ?? null }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Trade Center Picks" };

  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const primary = tradeLabel(listing.primary_trade);
  const title = `${firstName}'s Trade Center Picks — promo, new arrivals and pre-orders in ${listing.city} | Xrated`;

  return {
    title,
    description: `Promo, new arrivals and pre-order banners from ${firstName} — ${primary.toLowerCase()} in ${listing.city}. See what's hot in the yard right now.`,
    alternates: { canonical: `/${slug}/trade-center-picks` },
    openGraph: {
      title: `${firstName}'s Trade Center Picks — ${primary} in ${listing.city}`,
      description: `What's on promo, just arrived, or available for pre-order.`,
      url: `/${slug}/trade-center-picks`,
      type: "website"
    }
  };
}

function formatArrival(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export default async function TradeCenterPicksPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const tier = effectiveTier(listing);
  const isPaid =
    tier === "app_trial" || tier === "app_paid" || tier === "app_verified";
  if (
    !isPaid ||
    !isTradeCenterPicksOn(listing) ||
    !isMerchantGradeTrade(listing.primary_trade)
  ) {
    redirect(`/${slug}`);
  }

  const primary = tradeLabel(listing.primary_trade);
  const waUrl = whatsappQuoteUrl(
    listing.whatsapp,
    listing.display_name,
    primary
  );
  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;

  const picks = await loadActivePicks(listing.id);

  return (
    <main className="flex flex-1 flex-col pb-20 md:pb-0">
      <TradeProfileHeader
        listing={listing}
        appName={`${primary} Service`}
        backHref={`/${listing.slug}`}
      />
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="contact" />

      <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
        <div className="mt-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Trade Center Picks &middot; from {firstName}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl md:text-4xl">
            {firstName}&rsquo;s{" "}
            <span style={{ color: "#FFB300" }}>yard right now.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-neutral-600 sm:text-sm">
            What&rsquo;s on promo, just arrived, or available for
            pre-order &mdash; tap a card to see the product.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        {picks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <p className="text-sm text-neutral-600">
              {firstName} doesn&rsquo;t have any active picks right now. Check
              back soon &mdash; or message direct for what&rsquo;s in.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {picks.map((pick) => {
              const arrival = formatArrival(pick.arrival_at);
              const productName = pick.product?.name ?? "Product";
              // Card prefers the per-pick banner image (matches the
              // landscape banner the customer just saw) and falls back
              // to the product cover when no banner override exists.
              const cover = pick.banner_image_url ?? pick.product?.cover_url ?? null;
              // Send clicks to the dedicated pick detail page so the
              // commercial context (price, arrival, delivery /
              // installation, primed WhatsApp CTA) survives the jump.
              const href = `/${slug}/picks/${pick.id}`;
              return (
                <li
                  key={pick.id}
                  className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                >
                  <a
                    href={href}
                    className="group flex h-full flex-col transition hover:bg-neutral-50"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt={productName}
                          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[13px] text-neutral-400">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
                      <div>
                        <TradeCenterPickStatusChip status={pick.status} />
                      </div>
                      <p className="text-lg font-extrabold leading-tight text-neutral-900 sm:text-xl">
                        {productName}
                      </p>
                      {pick.note && (
                        <p className="text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
                          {pick.note}
                        </p>
                      )}
                      {arrival && (pick.status === "pre_order" || pick.status === "new_arrival") && (
                        <p className="text-[13px] font-bold text-neutral-500">
                          Arrives {arrival}
                        </p>
                      )}
                      <p className="mt-auto inline-flex items-center gap-1 pt-1 text-[13px] font-bold text-neutral-500 transition group-hover:text-[#FFB300]">
                        See offer
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="transition group-hover:translate-x-0.5"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8 sm:px-6">
        <div
          className="overflow-hidden rounded-3xl px-6 py-8 text-center sm:px-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Are you a merchant too?
          </p>
          <h2 className="mt-2 text-xl font-extrabold leading-tight text-white sm:text-2xl">
            Want to pin promo banners on your own products?{" "}
            <span style={{ color: "#FFB300" }}>
              Start your 14-day free trial.
            </span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-relaxed text-white/70 sm:text-sm">
            Trade Center Picks lets you tag products with promo,
            arrival, in-stock and pre-order banners &mdash; they auto-fall-off
            when the offer expires. £4/mo. Cancel any time.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`/trade-off/signup?ref=${encodeURIComponent(slug)}`}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-xs font-extrabold uppercase tracking-wider text-neutral-900 shadow-lg transition active:scale-[0.98] sm:text-sm"
              style={{ background: "#FFB300" }}
            >
              Join XratedTrade
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
            <a
              href="/trade-off/add-ons"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-white/30 bg-white/5 px-5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See all add-ons
            </a>
          </div>
        </div>
      </section>

      <div className="mt-auto">
        <TradeProfileFooter listing={listing} appName={`${primary} Service`} />
      </div>
    </main>
  );
}
