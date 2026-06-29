// Public profile — dedicated Trade Center Pick detail page.
//
// One pick, one page. Built for "I saw this banner, tell me more about
// THIS specific offer" — the editorial story (long_description), the
// commercial detail (price, arrival window, delivery / installation
// availability), and a primed WhatsApp CTA that references the exact
// status + product so the merchant never has to guess which pick is
// being discussed.
//
// All commercial fields are OPTIONAL — missing fields render NOTHING
// (no "Not specified" prompt). Labels generalise across merchant
// categories: "Delivery available" not "Yard delivery", "Installation
// available" not "Site fitting".
//
// Gated to paid tier AND `trade_center_picks` add-on enabled AND
// merchant-grade trade. Anything else redirects to /<slug>. 404 when
// the pick id is missing or belongs to a different listing.

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
import {
  STATUS_LABELS,
  TradeCenterPickStatusChip
} from "@/components/xrated/profile/merchant/TradeCenterPickStatusChip";
import { SharePickButton } from "@/components/xrated/profile/merchant/SharePickButton";
import {
  isMerchantGradeTrade,
  tradeLabel,
  whatsappPickEnquiryUrl,
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

async function loadPick(
  listingId: string,
  pickId: string
): Promise<PickWithProduct | null> {
  const res = await supabase
    .from("hammerex_xrated_trade_center_picks")
    .select("*")
    .eq("id", pickId)
    .eq("listing_id", listingId)
    .maybeSingle();
  const pick = (res.data ?? null) as HammerexXratedTradeCenterPick | null;
  if (!pick) return null;
  const prodRes = await supabase
    .from("hammerex_xrated_products")
    .select("id, name, slug, cover_url")
    .eq("id", pick.product_id)
    .maybeSingle();
  const product = (prodRes.data ?? null) as Pick<
    HammerexXratedProduct,
    "id" | "name" | "slug" | "cover_url"
  > | null;
  return { ...pick, product };
}

function formatPence(pence: number): string {
  const pounds = pence / 100;
  return pounds.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pounds % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function metaDescription(pick: PickWithProduct, firstName: string): string {
  const source = pick.long_description ?? pick.note;
  if (source) return source.slice(0, 160);
  const status = STATUS_LABELS[pick.status].label;
  const name = pick.product?.name ?? "this product";
  return `${status} on ${name} from ${firstName}. Enquire on WhatsApp for availability and delivery.`;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string; pickId: string }>;
}): Promise<Metadata> {
  const { slug, pickId } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Trade Center pick" };
  const pick = await loadPick(listing.id, pickId);
  if (!pick) return { title: "Trade Center pick" };

  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const statusLabel = STATUS_LABELS[pick.status].label;
  const productName = pick.product?.name ?? "Product";
  const title = `${productName} — ${firstName}'s ${statusLabel} | Xrated`;
  const ogImage = pick.banner_image_url ?? pick.product?.cover_url ?? null;

  return {
    title,
    description: metaDescription(pick, firstName),
    alternates: { canonical: `/${slug}/picks/${pickId}` },
    openGraph: {
      title,
      description: metaDescription(pick, firstName),
      url: `/${slug}/picks/${pickId}`,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: "article"
    }
  };
}

export default async function TradeCenterPickDetailPage({
  params
}: {
  params: Promise<{ slug: string; pickId: string }>;
}) {
  const { slug, pickId } = await params;
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

  const pick = await loadPick(listing.id, pickId);
  if (!pick) notFound();

  // Banner falls off when expired — keep the detail page in lock-step
  // with the public banner component so a share link can't outlive the
  // promo.
  if (pick.expires_at && new Date(pick.expires_at).getTime() < Date.now()) {
    notFound();
  }

  const primary = tradeLabel(listing.primary_trade);
  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const statusEntry = STATUS_LABELS[pick.status];
  const productName = pick.product?.name ?? "Product";
  const heroImage = pick.banner_image_url ?? pick.product?.cover_url ?? null;
  const productHref = pick.product?.slug
    ? `/${slug}/shop/${pick.product.slug}`
    : null;

  // Header WhatsApp pill — generic "quote" deeplink. The dedicated pick
  // CTA below the hero uses the picks-specific helper so the inbound
  // message references this exact promo.
  const waHeaderUrl = whatsappQuoteUrl(
    listing.whatsapp,
    listing.display_name,
    primary
  );
  const waPickUrl = whatsappPickEnquiryUrl(
    listing.whatsapp,
    listing.display_name,
    productName,
    statusEntry.label
  );

  // Back link prefers the picks index when the listing has more than
  // one active pick visible — otherwise straight back to the profile.
  const backHref =
    isTradeCenterPicksOn(listing)
      ? `/${listing.slug}/trade-center-picks`
      : `/${listing.slug}`;

  // Price block render mode — numeric beats label, label beats fallback.
  const hasNumericPrice = typeof pick.cta_price_pence === "number";
  const priceMain = hasNumericPrice
    ? formatPence(pick.cta_price_pence as number)
    : pick.cta_price_label && pick.cta_price_label.trim().length > 0
      ? pick.cta_price_label
      : "Enquire for price";
  const priceIsNumeric = hasNumericPrice;

  return (
    <main className="flex flex-1 flex-col pb-20 md:pb-0">
      <TradeProfileHeader
        listing={listing}
        appName={`${primary} Service`}
        backHref={backHref}
      />
      <PremiumHero listing={listing} waUrl={waHeaderUrl} currentPage="contact" />

      {/* ── Hero block — full-bleed landscape banner ────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
        <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900 shadow-sm">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt={productName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[13px] text-neutral-400">
              No image
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0) 75%)"
            }}
          />
          <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
            <TradeCenterPickStatusChip status={pick.status} />
          </div>
          <div className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6">
            <h1 className="text-xl font-extrabold leading-tight text-white sm:text-3xl md:text-4xl">
              {productName}
            </h1>
            {pick.note && (
              <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-white/90 sm:text-sm">
                {pick.note}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Body — story (left) + commercial card (right) ───────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-5 md:gap-8">
          {/* ── Left: editorial ─────────────────────────────────────── */}
          <div className="md:col-span-3">
            {pick.long_description && (
              <div>
                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
                  style={{ color: "#FFB300" }}
                >
                  Why this {statusEntry.label.toLowerCase()}
                </p>
                <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
                  {pick.long_description
                    .split(/\n{2,}/)
                    .map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                </div>
              </div>
            )}

            <p className="mt-6 text-[13px] text-neutral-500">
              Brought to you by{" "}
              <span className="font-bold text-neutral-700">
                {firstName}
              </span>
              {" "}&middot; {primary} in {listing.city}.
            </p>

            {productHref && (
              <a
                href={productHref}
                className="mt-6 inline-flex h-11 items-center gap-1 text-[13px] font-bold text-neutral-500 transition hover:text-[#FFB300]"
              >
                See the full product
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
                  className="ml-1"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </a>
            )}
          </div>

          {/* ── Right: commercial card (sticky on desktop) ───────────── */}
          <aside className="md:col-span-2">
            <div className="md:sticky md:top-24">
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
                  style={{ color: "#FFB300" }}
                >
                  This offer
                </p>
                <p
                  className={`mt-2 leading-tight text-neutral-900 ${
                    priceIsNumeric
                      ? "text-3xl font-extrabold sm:text-4xl"
                      : "text-xl font-extrabold sm:text-2xl"
                  }`}
                >
                  {priceMain}
                </p>

                {pick.arrival_window_label && (
                  <p className="mt-3 text-[13px] font-bold text-neutral-700">
                    {pick.arrival_window_label}
                  </p>
                )}

                {(pick.delivery_available === true ||
                  pick.installation_available === true) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pick.delivery_available === true && (
                      <span
                        className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-bold"
                        style={{
                          borderColor: "rgba(255,179,0,0.5)",
                          background: "rgba(255,179,0,0.08)",
                          color: "#8a5a00"
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Delivery available
                      </span>
                    )}
                    {pick.installation_available === true && (
                      <span
                        className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-bold"
                        style={{
                          borderColor: "rgba(255,179,0,0.5)",
                          background: "rgba(255,179,0,0.08)",
                          color: "#8a5a00"
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Installation available
                      </span>
                    )}
                  </div>
                )}

                <a
                  href={waPickUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "#25D366" }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M20.52 3.48A11.78 11.78 0 0 0 12.06 0C5.5 0 .15 5.34.13 11.9a11.84 11.84 0 0 0 1.6 5.95L0 24l6.34-1.66a11.86 11.86 0 0 0 5.72 1.46h.01c6.55 0 11.9-5.34 11.92-11.9a11.79 11.79 0 0 0-3.47-8.42ZM12.07 21.78h-.01a9.85 9.85 0 0 1-5.02-1.38l-.36-.21-3.76.98 1-3.66-.23-.38a9.83 9.83 0 0 1-1.51-5.24c0-5.44 4.43-9.87 9.89-9.87a9.82 9.82 0 0 1 6.98 2.89 9.78 9.78 0 0 1 2.89 6.98c0 5.45-4.43 9.89-9.87 9.89Zm5.41-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48a9.05 9.05 0 0 1-1.67-2.07c-.17-.3 0-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01a1.1 1.1 0 0 0-.8.37 3.36 3.36 0 0 0-1.04 2.5c0 1.47 1.06 2.9 1.21 3.1.15.2 2.1 3.2 5.07 4.49.71.3 1.26.49 1.69.62.71.23 1.35.2 1.86.12.57-.08 1.76-.72 2-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z" />
                  </svg>
                  Enquire on WhatsApp
                </a>

                <div className="mt-3">
                  <SharePickButton
                    slug={listing.slug}
                    pickId={pick.id}
                    bannerUrl={heroImage}
                    productName={productName}
                    statusLabel={STATUS_LABELS[pick.status].label}
                    merchantName={listing.display_name}
                  />
                </div>

                {productHref && (
                  <a
                    href={productHref}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center text-[13px] font-bold text-neutral-500 transition hover:text-[#FFB300]"
                  >
                    Or view full product specs
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
                      className="ml-1"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="mt-auto pt-12">
        <TradeProfileFooter listing={listing} appName={`${primary} Service`} />
      </div>
    </main>
  );
}
