import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { resolveAppHero } from "@/lib/tradeAppBanners";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { VideoLightbox } from "@/components/xrated/profile/VideoLightbox";
import { EnquireButton } from "@/components/xrated/profile/EnquireButton";
import { ServicesTabbedGallery } from "@/components/xrated/profile/ServicesTabbedGallery";
import { TeamGrid } from "@/components/xrated/profile/TeamGrid";
import { RecommendedTrades } from "@/components/xrated/profile/RecommendedTrades";
import { AboutFlipPanel } from "@/components/xrated/profile/AboutFlipPanel";
import { TradeIcon } from "@/lib/tradeIcons";
import { ReviewsCarousel } from "@/components/xrated/profile/ReviewsCarousel";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { GuideShareBar } from "@/components/guides/GuideShareBar";
import { TradePhotoGallery } from "@/components/trade-off/TradePhotoGallery";
import { TradeReportButton } from "@/components/trade-off/TradeReportButton";
import { TradeAreaMap } from "@/components/trade-off/TradeAreaMap";
import { TradeMobileActionBar } from "@/components/trade-off/TradeMobileActionBar";
import { TradeProfileUrlChip } from "@/components/trade-off/TradeProfileUrlChip";
import { InstantQuoteForm } from "@/components/trade-off/InstantQuoteForm";
import { ProjectGalleryGrid } from "@/components/trade-off/ProjectGalleryGrid";
import { TradeSocialIcons } from "@/components/trade-off/TradeSocialIcons";
import { websiteUrl } from "@/lib/tradeOffSocial";
import { XratedViewTracker } from "@/components/trade-off/XratedViewTracker";
import { WhatsappClickTracker } from "@/components/trade-off/WhatsappClickTracker";
import { PreviewModeBar } from "@/components/trade-off/PreviewModeBar";
import { AvatarFrame } from "@/components/xrated/AvatarFrame";
import { HeroTextOverlay } from "@/components/xrated/HeroTextOverlay";
import { XratedCtaButton } from "@/components/xrated/XratedCtaButton";
import { XratedSocialShareStrip } from "@/components/xrated/XratedSocialShareStrip";
import { PortfolioCarousel } from "@/components/xrated/profile/PortfolioCarousel";
import { OperatingHoursPanel } from "@/components/xrated/profile/OperatingHoursPanel";
import { StarRatingRow } from "@/components/xrated/profile/StarRatingRow";
import { ProfileActionTriple } from "@/components/xrated/profile/ProfileActionTriple";
import { ShareIconButton } from "@/components/xrated/profile/ShareIconButton";
import { PricedServicesCarousel } from "@/components/xrated/profile/PricedServicesCarousel";
import { QrFooterDock } from "@/components/xrated/profile/QrFooterDock";
import { PremiumStickyTrust } from "@/components/xrated/profile/PremiumStickyTrust";
import { ProfileExpandPanels } from "@/components/xrated/profile/ProfileExpandPanels";
import { AboutBio } from "@/components/xrated/profile/AboutBio";
import { ProductCardGrid } from "@/components/xrated/profile/ProductCardGrid";
import { ShopCartIsland } from "@/components/xrated/profile/ShopCartIsland";
import { ServicesPricedSection } from "@/components/xrated/profile/ServicesPricedSection";
import { isServicesGridOn, isShopModeOn } from "@/lib/xratedAddons";
import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexTradeOffProject,
  type HammerexProduct
} from "@/lib/supabase";
import {
  absolute,
  BRAND,
  breadcrumbJsonLd,
  clampDescription,
  localBusinessJsonLd,
  stripMarkdown
} from "@/lib/seo";
import {
  HAMMEREX_STANDARD_BLURBS,
  STANDARD_TIER_LABELS,
  standardTierFor,
  tradeLabel,
  whatsappQuoteUrl
} from "@/lib/tradeOff";
import { effectiveTier, inkForTheme } from "@/lib/xratedTrades";

export const revalidate = 300;

async function loadListing(slug: string) {
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  const listing = (res.data ?? null) as HammerexTradeOffListing | null;
  if (!listing) {
    return {
      listing: null,
      projects: [] as HammerexTradeOffProject[],
      reviews: [] as XratedReviewPublic[]
    };
  }

  const projectsRes = await supabase
    .from("hammerex_trade_off_projects")
    .select("*")
    .eq("listing_id", listing.id)
    .order("sort_order", { ascending: true });
  const projects = (projectsRes.data ?? []) as HammerexTradeOffProject[];

  const reviewsRes = await supabase
    .from("hammerex_xrated_reviews")
    .select(
      "id, customer_name, customer_postcode, customer_avatar_url, project_type, service_name, overall_rating, workmanship_rating, communication_rating, value_rating, timeliness_rating, body, status, public_response, submitted_at"
    )
    .eq("listing_id", listing.id)
    .in("status", ["live", "disputed"])
    .order("submitted_at", { ascending: false })
    .limit(20);
  const reviews = (reviewsRes.data ?? []) as XratedReviewPublic[];

  return { listing, projects, reviews };
}

// Just the columns the public profile needs — keeps the page server-side
// load lean and stops the customer-email/IP from ever leaving the API.
type XratedReviewPublic = {
  id: string;
  customer_name: string;
  customer_postcode: string | null;
  customer_avatar_url: string | null;
  project_type: string | null;
  service_name: string | null;
  overall_rating: number;
  workmanship_rating: number | null;
  communication_rating: number | null;
  value_rating: number | null;
  timeliness_rating: number | null;
  body: string;
  status: "live" | "disputed";
  public_response: string | null;
  submitted_at: string;
};

async function loadStandardProducts(slugs: string[]): Promise<HammerexProduct[]> {
  if (slugs.length === 0) return [];
  const res = await supabase
    .from("hammerex_products")
    .select("*")
    .in("slug", slugs);
  return (res.data ?? []) as HammerexProduct[];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { listing } = await loadListing(slug);
  if (!listing) return { title: "Tradie not found" };
  const primary = tradeLabel(listing.primary_trade);
  const title = `${listing.display_name} — ${primary} in ${listing.city} | Hammerex Trade Off`;
  const description = clampDescription(stripMarkdown(listing.bio), 160) ||
    `${listing.display_name}, ${primary.toLowerCase()} in ${listing.city}. Free WhatsApp quotation on Hammerex Trade Off.`;
  const url = absolute(`/trade/${listing.slug}`);
  return {
    title,
    description,
    alternates: { canonical: `/trade/${listing.slug}` },
    openGraph: {
      type: "profile",
      title: `${listing.display_name} — ${primary} in ${listing.city}`,
      description,
      url,
      siteName: BRAND.name
    },
    twitter: {
      card: "summary_large_image",
      title: `${listing.display_name} — ${primary} in ${listing.city}`,
      description
    }
  };
}

function formatJoinedMonth(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────
// Shared sub-blocks used by BOTH layouts (premium + standard).
// Kept inside this file so we don't pollute /components with single-use bits.
// ─────────────────────────────────────────────────────────────────────────

function AcceptingBanner({ accepting }: { accepting: boolean }) {
  if (accepting) return null;
  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-xs font-semibold text-red-700">
      Currently fully booked — please check back
    </div>
  );
}

function AvailablePill({ themeColor }: { themeColor: string }) {
  return (
    <span
      className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-bold"
      style={{ background: themeColor, color: inkForTheme(themeColor) }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: inkForTheme(themeColor) }}
        aria-hidden="true"
      />
      Available for new jobs
    </span>
  );
}

function HammerexStandardBadge({
  listing,
  tierLabel,
  blurb
}: {
  listing: HammerexTradeOffListing;
  tierLabel: string | null;
  blurb: string;
}) {
  if (!listing.hammerex_standard_verified) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pb-2 pt-4">
      <div className="overflow-hidden rounded-2xl border-2 border-black bg-brand-accent text-black shadow-xl">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:p-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-black text-brand-accent">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-black/70">
              Hammerex Standard
            </p>
            <h2 className="mt-1 text-xl font-bold leading-tight text-black sm:text-2xl">
              {tierLabel}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-black/90">{blurb}</p>
            <a
              href="/product/k11-drywall-tool-station"
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-black underline-offset-4 hover:underline"
            >
              Why Hammerex Standard matters →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function ToolsIUseBlock({
  toolProducts,
  tierLabel
}: {
  toolProducts: HammerexProduct[];
  tierLabel: string | null;
}) {
  if (toolProducts.length === 0) return null;
  return (
    <section className="w-full px-4 pb-2 pt-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Advanced equipment &amp; tools we use
        </h2>
        <p className="mt-1 text-xs text-brand-muted">
          Hammerex-verified tool storage — a sign this tradesperson takes pride in their kit.
        </p>
      </div>
      {tierLabel && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent px-2.5 py-1 text-[13px] font-bold text-black">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
            {tierLabel}
          </span>
        </div>
      )}
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {toolProducts.map((p) => (
          <li key={p.id}>
            <a
              href={`/product/${p.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-brand-line bg-brand-surface transition hover:border-brand-accent"
            >
              <div className="aspect-square w-full overflow-hidden rounded-t-2xl bg-brand-bg">
                <img
                  src={p.image_url || BRAND.logo}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain p-3 transition group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-3">
                <h3 className="line-clamp-2 text-xs font-semibold text-brand-text group-hover:text-brand-accent">
                  {p.name}
                </h3>
              </div>
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl border border-brand-line bg-brand-surface/60 px-4 py-3">
        <p className="text-xs text-brand-muted">
          Hammerex Standard verifies real working trade kit.{" "}
          <a
            href="/trade-off/signup"
            className="font-semibold text-brand-accent underline-offset-4 hover:underline"
          >
            Get yours →
          </a>
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Page entry point
// ─────────────────────────────────────────────────────────────────────────

export default async function TradiePublicProfilePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = searchParams ? await searchParams : {};
  const previewRaw = Array.isArray(sp.preview) ? sp.preview[0] : sp.preview;
  // Standard-tier preview override. The whole profile is already public so
  // we don't need a signed token — anyone can preview, the tradie's owner
  // is the only person likely to care. A fixed top-bar makes it obvious.
  const previewStandard = previewRaw === "standard";
  const { listing, projects, reviews } = await loadListing(slug);
  if (!listing) notFound();

  const primary = tradeLabel(listing.primary_trade);
  const cover = listing.photos[0] ?? listing.avatar_url ?? BRAND.logo;
  const tier = standardTierFor(listing.hammerex_standard_products.length);
  const tierLabel = tier ? STANDARD_TIER_LABELS[tier] : null;

  const blurb =
    listing.hammerex_standard_blurb ||
    listing.hammerex_standard_products
      .map((s) => HAMMEREX_STANDARD_BLURBS[s])
      .find(Boolean) ||
    "This tradesperson is verified to the Hammerex Standard — they own one of our flagship trade stations or pro kits.";

  const cityLower = listing.city.toLowerCase();
  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Trade Off", url: "/trade-off" },
    { name: primary, url: `/trade-off/${listing.primary_trade}` },
    { name: listing.city, url: `/trade-off/${listing.primary_trade}/${encodeURIComponent(cityLower)}` },
    { name: listing.display_name, url: `/trade/${listing.slug}` }
  ]);

  const localBusiness = localBusinessJsonLd(listing, primary);
  const waUrl = whatsappQuoteUrl(listing.whatsapp, listing.display_name, primary);
  const profileFullUrl = absolute(`/trade/${listing.slug}`);
  const toolProducts = await loadStandardProducts(listing.hammerex_standard_products);

  // tier === "paid"   ➜ no Xrated header, no upgrade banner, full features
  // tier === "free"   ➜ Xrated header visible, upgrade banner pinned,
  //                     video / contact form / service price + description
  //                     all gated off
  const isPremium =
    !previewStandard &&
    (effectiveTier(listing) === "app_trial" || effectiveTier(listing) === "app_paid");
  const renderTier: "free" | "paid" = isPremium ? "paid" : "free";

  return (
    <main className="flex flex-1 flex-col pb-20 md:pb-0">
      <XratedViewTracker page="profile" listingId={listing.id} />
      {previewStandard && <PreviewModeBar slug={listing.slug} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }}
      />
      {/* VideoObject schema — emitted when the tradesperson has set a
          video. Self-hosted MP4 / MOV / WebM AND YouTube URLs both
          qualify; Google indexes both and the video can appear in the
          video carousel SERP feature. */}
      {listing.video_url && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "VideoObject",
              name: listing.video_caption || `${listing.display_name} — ${primary} intro video`,
              description:
                listing.video_caption ||
                `${listing.display_name}, ${primary.toLowerCase()} in ${listing.city} — a short intro video showing their work and approach.`,
              thumbnailUrl: listing.video_cover_url || listing.photos[0] || listing.avatar_url || undefined,
              contentUrl: listing.video_url,
              uploadDate: listing.joined_at,
              publisher: {
                "@type": "Organization",
                name: listing.display_name
              },
              inLanguage: "en-GB"
            })
          }}
        />
      )}
      {/* Free profiles get the Xrated header; paid profiles render a
          clean white-label page with no platform chrome above the
          hero. A small "Powered by Xrated" footer credit goes on
          every profile until the £3/mo white-label add-on ships. */}
      {renderTier === "free" && <XratedHeader />}

      {/* Single render path — both tiers go through PremiumLayout with
          feature gates driven by `tier`. Free profiles get the Xrated
          header (rendered above) + a pinned upgrade banner; paid
          profiles get the full white-label treatment with a small
          "Powered by Xrated" credit in the footer. */}
      <PremiumLayout
        listing={listing}
        projects={projects}
        reviews={reviews}
        toolProducts={toolProducts}
        tierLabel={tierLabel}
        blurb={blurb}
        waUrl={waUrl}
        profileFullUrl={profileFullUrl}
        tier={renderTier}
      />

      <div className="mt-auto">
        <XratedFooter />
      </div>

      {/* Older mobile action bar — suppressed on premium tier because the
          QrFooterDock already shows a big WhatsApp button on mobile, and
          stacking both creates a double sticky bar.
          Wrapped in WhatsappClickTracker so the WA tap fires the same
          conversion beacon the QrFooterDock uses on the premium layout. */}
      {!isPremium && (
        <WhatsappClickTracker listingId={listing.id}>
          <TradeMobileActionBar
            waUrl={waUrl}
            phone={listing.phone}
            email={listing.email}
            displayName={listing.display_name}
          />
        </WhatsappClickTracker>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PREMIUM layout — app_trial / app_paid tiers
// ─────────────────────────────────────────────────────────────────────────

function PremiumLayout({
  listing,
  projects,
  reviews,
  toolProducts,
  tierLabel,
  waUrl,
  profileFullUrl,
  tier
}: {
  listing: HammerexTradeOffListing;
  projects: HammerexTradeOffProject[];
  reviews: XratedReviewPublic[];
  toolProducts: HammerexProduct[];
  tierLabel: string | null;
  blurb: string;
  waUrl: string;
  profileFullUrl: string;
  tier: "free" | "paid";
}) {
  const isPaid = tier === "paid";
  // Shop Mode swap — only honour when the add-on is on AND the
  // tradesperson is on a paid tier (the add-on is gated on the
  // dashboard but we double-check here so a leaked toggle on a free
  // profile can't bypass the gate).
  const shopMode = isPaid && isShopModeOn(listing);
  // Services Prices add-on swap — only honour when the add-on is on AND
  // the tradesperson is on a paid tier. Independent of Shop Mode — a
  // tradesperson can run both at the same time (kit they sell + labour
  // priced by the hour). Double-checks the gate here so a leaked toggle
  // on a free profile can't bypass it.
  const servicesGrid = isPaid && isServicesGridOn(listing);
  return (
    <>
      <PremiumHero listing={listing} waUrl={waUrl} tier={tier} />

      {/* Free-tier upgrade banner — pinned high under the hero so it's
          one of the first things visitors see, BUT below the hero so
          the profile still looks legit at a glance. */}
      {!isPaid && (
        <FreeTierUpgradeBanner
          slug={listing.slug}
          displayName={listing.display_name}
        />
      )}

      <AboutAndVideo listing={listing} showVideo={isPaid} />
      {shopMode ? (
        <ProductCardGrid listing={listing} />
      ) : (
        <ServicesTabbedGallery
          slug={listing.slug}
          pricedServices={listing.priced_services ?? []}
          servicesOffered={listing.services_offered ?? []}
          reviews={reviews}
          stripped={!isPaid}
        />
      )}
      <ClientsCarousel
        listing={listing}
        reviews={reviews}
        allowAddReview={isPaid}
      />
      {/* Services & Prices inline teaser — paid tier + add-on on. Server
          component, self-renders nothing when the trade has no live
          services so a profile without entries never shows a dead
          section. View-all link to /<slug>/services-prices for the
          dedicated grid. */}
      {servicesGrid && <ServicesPricedSection listing={listing} />}
      <TeamGrid listing={listing} />
      {/* My Trusted Trades — link to the dedicated sub-page. Recommendation
          cards now live exclusively on /<slug>/trusted-trades to give
          them room to breathe. We surface the count + a yellow CTA here
          so the customer knows to tap through. Paid tier only. */}
      {isPaid && Array.isArray(listing.recommendations) && listing.recommendations.length > 0 && (
        <TrustedTradesCta
          slug={listing.slug}
          firstName={listing.display_name.split(/\s+/)[0] ?? listing.display_name}
          count={listing.recommendations.length}
        />
      )}
      <ShareAndContactCta
        listing={listing}
        waUrl={waUrl}
        profileFullUrl={profileFullUrl}
      />
      <BottomTrustStrip />
      {/* Coloured social-icon strip + website chip, sits just above the
          "Powered by Xrated" credit on paid profiles. Auto-hides if the
          tradesperson hasn't filled any social fields. */}
      {isPaid && <PremiumSocialFooter listing={listing} />}
      <PoweredByXratedFooter slug={listing.slug} />
      {isPaid && (
        <>
          {/* Spacer reserves the height of the fixed sticky element so
              the footer + last content always have room to breathe. In
              Shop Mode the floating cart island replaces the sticky
              trust bar (otherwise both fixed-bottom elements would
              collide). */}
          <div aria-hidden="true" className="h-[72px]" />
          {shopMode ? (
            <ShopCartIsland slug={listing.slug} />
          ) : (
            <PremiumStickyTrust
              ratingAvg={listing.rating_avg}
              ratingCount={listing.rating_count}
              whatsappHref={waUrl}
            />
          )}
        </>
      )}
    </>
  );
}

// ─── Free-tier upgrade banner ────────────────────────────────────────
// Pinned yellow strip sitting under the hero on every free profile.
// One-tap upgrade CTA, drops away the moment they go paid. The dismiss
// is deliberately NOT persisted — we want every visit to a free
// profile to reinforce that an upgrade is available.
function FreeTierUpgradeBanner({
  slug,
  displayName
}: {
  slug: string;
  displayName: string;
}) {
  const firstName = displayName.split(/\s+/)[0] || displayName;
  return (
    <section className="w-full px-4 pt-6 sm:px-6">
      <div
        className="flex flex-col items-start gap-3 rounded-2xl px-4 py-4 text-neutral-900 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        style={{ background: "#FFB300" }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-widest text-neutral-900/80">
            Free profile
          </p>
          <p className="mt-1 text-sm font-extrabold leading-tight sm:text-base">
            Upgrade to unlock {firstName}&apos;s full profile — video, contact form,
            prices and reviews.
          </p>
        </div>
        <a
          href={`/trade-off/pricing?slug=${encodeURIComponent(slug)}`}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-neutral-900 px-4 text-xs font-extrabold text-white shadow-sm transition active:scale-[0.97]"
        >
          Upgrade — 30 days free
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      </div>
    </section>
  );
}

// ─── Trusted Trades CTA card ────────────────────────────────────────
// Replaces the inline RecommendedTrades grid on the main profile. The
// full grid now lives at /<slug>/trusted-trades where it has room to
// breathe. This card surfaces the count + a yellow CTA so the customer
// knows to tap through.
function TrustedTradesCta({
  slug,
  firstName,
  count
}: {
  slug: string;
  firstName: string;
  count: number;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12">
      <a
        href={`/${slug}/trusted-trades`}
        className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-[#FFB300] hover:shadow-lg sm:p-6"
      >
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            My Trusted Trades
          </p>
          <p className="mt-1.5 text-lg font-extrabold leading-tight text-neutral-900 sm:text-xl">
            {count} {count === 1 ? "tradesperson I personally vouch for" : "tradespeople I personally vouch for"}
          </p>
          <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
            Need an electrician, a sparky or a roofer too? See who {firstName} works with.
          </p>
        </div>
        <span
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-4 text-xs font-extrabold uppercase tracking-wider text-neutral-900 shadow-sm transition group-hover:scale-105 sm:h-12 sm:text-sm"
          style={{ background: "#FFB300" }}
        >
          See all
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      </a>
    </section>
  );
}

// ─── Premium social-link row ────────────────────────────────────────
// Renders the coloured social-icon strip above the Powered-by credit.
// Pulls every populated social field on the listing (Instagram, TikTok,
// Facebook, X, Snapchat, Reddit, YouTube, Google Business) plus the
// website chip. Hidden when the tradesperson hasn't filled any of them.
// Home-page chip — website-only. The full coloured social grid moved
// to the /contact subpage so the main profile stays uncluttered. We
// keep the website chip on the home page because a tradesperson with
// their own website is making a different (stronger) trust signal than
// social handles alone — "I run a real business, not a side hustle."
function PremiumSocialFooter({ listing }: { listing: HammerexTradeOffListing }) {
  if (!listing.website) return null;
  const url = websiteUrl(listing.website);
  if (!url) return null;
  const display = listing.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <section className="w-full px-4 pt-8 sm:px-6">
      <div className="mx-auto flex max-w-md flex-col items-center gap-2.5 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
          Our website
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-full border-2 px-5 text-sm font-extrabold text-neutral-900 transition hover:scale-[1.02] active:scale-[0.98]"
          style={{ borderColor: "#FFB300", background: "#FFFFFF" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
          </svg>
          {display}
        </a>
        <p className="text-[11px] text-neutral-500">
          Find us on social — see the{" "}
          <a
            href={`/${listing.slug}/contact`}
            className="font-bold underline-offset-2 hover:underline"
            style={{ color: "#FFB300" }}
          >
            Contact page
          </a>
        </p>
      </div>
    </section>
  );
}

// ─── Powered by Xrated Trades footer credit ──────────────────────────
// Renders on EVERY profile, free + paid, until the £3/mo white-label
// add-on is shipped. Doubles as Linktree-style top-of-funnel — every
// visitor sees a soft "get yours" link.
function PoweredByXratedFooter({ slug }: { slug: string }) {
  return (
    <section className="w-full px-4 pb-6 pt-10 sm:px-6">
      <div className="flex flex-col items-center justify-center gap-1 text-center text-xs text-neutral-500">
        <p>
          Built on{" "}
          <a
            href={`/trade-off?ref=${encodeURIComponent(slug)}`}
            className="font-extrabold text-neutral-900 hover:text-[#FFB300]"
          >
            Xrated Trades
          </a>{" "}
          — the shareable trade profile for tradies anywhere.
        </p>
        <a
          href="/trade-off/signup"
          className="text-xs font-bold text-[#FFB300] hover:underline"
        >
          Get yours →
        </a>
      </div>
    </section>
  );
}
// ─── Section: About Us (left) + Video (right) ─────────────────────────
function AboutAndVideo({
  listing,
  showVideo = true
}: {
  listing: HammerexTradeOffListing;
  showVideo?: boolean;
}) {
  // Only break on a BLANK line (two or more newlines, possibly with
  // whitespace between). Single newlines flatten to a space, so a
  // tradesperson's continuous prose stays one paragraph unless they
  // deliberately add a blank-line break.
  const bioParas = (listing.bio || "")
    .split(/\n\s*\n+/)
    .map((s) => s.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  // Service bullets removed here — the ServicesIconRow below the About
  // section is the canonical list, no point repeating it.
  // Cover fallback when the tradesperson hasn't uploaded a custom poster:
  // try the second portfolio photo, then the first, then the avatar.
  const coverFallback =
    listing.video_cover_url ??
    listing.photos[1] ??
    listing.photos[0] ??
    listing.avatar_url ??
    null;
  const hasVideo = showVideo && !!listing.video_url;

  return (
    <section className="w-full px-4 pt-6 sm:px-6 sm:pt-8">
      {/* 5-col grid: text + ticks span 3 cols, compact video sits in 2. */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-5 md:gap-14">
        <div className="md:col-span-3">
          <AboutFlipPanel
            bioParas={bioParas}
            defaultBio={`${listing.display_name} is based in ${listing.city} with hands-on experience across all aspects of ${tradeLabel(listing.primary_trade).toLowerCase()}.`}
            slug={listing.slug}
          />
        </div>

        {/* Right column — compact X-Rated trust-level notification on
            top, video tile below. The notification renders even when
            and a tradesperson without a clip leaves the right column
            empty (the trust-level pill is now on the hero avatar). */}
        <div className="mt-[30px] md:col-span-2 md:mt-0">
          {hasVideo && listing.video_url && (
            <div>
              {listing.video_caption && (
                <p className="mb-2 text-sm font-extrabold text-neutral-900">
                  {listing.video_caption}
                </p>
              )}
              <VideoLightbox
                videoUrl={listing.video_url}
                coverUrl={coverFallback}
                altText={listing.video_caption || `${listing.display_name} — intro video`}
              />
              <p className="mt-2 text-xs text-neutral-500">
                Tap to play · keep this under 60s for best engagement.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Our Services (horizontal icon row) ──────────────────────
function ServicesIconRow({ services }: { services: string[] }) {
  // Cap at 5 — no "More" overflow tile and no "View all" link. The
  // priced-services gallery below carries any longer service list.
  const tiles = services.slice(0, 5);
  if (tiles.length === 0) return null;

  return (
    <section className="w-full px-4 pt-8 sm:px-6">
      <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
        Our Services
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((s, i) => (
          <div key={s} className="flex flex-col items-center gap-2 text-center">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-xl transition ${
                i === 0
                  ? "bg-[#FFB300] text-neutral-900 ring-2 ring-[#FFB300]"
                  : "bg-neutral-900 text-white"
              }`}
            >
              <span className="h-7 w-7">
                <TradeIcon name={s} />
              </span>
            </div>
            <span
              className={`text-xs font-semibold ${
                i === 0
                  ? "text-neutral-900 underline decoration-[#FFB300] decoration-2 underline-offset-4"
                  : "text-neutral-700"
              }`}
            >
              {s}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Section: real customer-review carousel ─────────────────────────
function ClientsCarousel({
  listing,
  reviews,
  allowAddReview = true
}: {
  listing: HammerexTradeOffListing;
  reviews: XratedReviewPublic[];
  /** Free-tier read-only mode — reviews still render, but the "Add
   *  review" CTA is replaced by a small upgrade nudge that explains
   *  paid profiles let customers leave reviews tied to specific jobs. */
  allowAddReview?: boolean;
}) {
  // Empty state — invite a review rather than hiding the section. New
  // tradies need this CTA visible, even with zero reviews.
  if (reviews.length === 0) {
    return (
      <section className="w-full px-4 pt-8 sm:px-6">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Customers say it best…
        </h2>
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center">
          <p className="text-sm font-bold text-neutral-900">
            No customer reviews yet.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {allowAddReview
              ? "Be the first — leave an honest review after your job's done."
              : "Reviews unlock on the paid profile. Upgrade to let customers leave verified reviews tied to specific jobs."}
          </p>
          <a
            href={
              allowAddReview
                ? `/trade/${listing.slug}/review`
                : `/trade-off/pricing?slug=${encodeURIComponent(listing.slug)}`
            }
            className="mt-3 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-5 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.97]"
            style={{ background: "#FFB300" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {allowAddReview ? "Add review" : "Upgrade to enable reviews"}
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full px-4 pt-8 sm:px-6">
      <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
        Customers say it best…
      </h2>
      <ReviewsCarousel
        reviews={reviews}
        displayName={listing.display_name}
        city={listing.city}
        slug={listing.slug}
        allowAddReview={allowAddReview}
      />
    </section>
  );
}

// ─── Section: Share + Get in touch dark CTA strip ─────────────────────
function ShareAndContactCta({
  listing,
  waUrl,
  profileFullUrl
}: {
  listing: HammerexTradeOffListing;
  waUrl: string;
  profileFullUrl: string;
}) {
  const phoneHref = listing.phone
    ? `tel:${listing.phone.replace(/[^0-9+]/g, "")}`
    : null;
  // Display URL trims the scheme so the dark pill reads cleanly.
  const displayUrl = profileFullUrl.replace(/^https?:\/\//, "");

  return (
    <section className="w-full px-4 pt-8 sm:px-6">
      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-black p-5 sm:grid-cols-2 sm:gap-6 sm:p-6">
        {/* LEFT — Share this profile */}
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "#FFB300" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-white">Share this profile</p>
            <p className="mt-0.5 text-xs text-neutral-400">
              Let others know about our services
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs text-neutral-200">
              <span className="truncate font-mono">{displayUrl}</span>
              <button
                type="button"
                aria-label="Copy share URL"
                className="ml-auto shrink-0 text-neutral-400 hover:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — Get in touch today */}
        <div>
          <p className="text-sm font-extrabold text-white">Get in touch today</p>
          <p className="mt-0.5 text-xs text-neutral-400">
            We&apos;re ready to help with your next project.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-neutral-900 transition active:scale-[0.97] sm:text-sm"
              style={{ background: "#FFB300" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Message Us
            </a>
            <a
              href={phoneHref ?? "#"}
              aria-disabled={!phoneHref}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 bg-transparent text-xs font-bold transition active:scale-[0.97] sm:text-sm"
              style={
                phoneHref
                  ? { borderColor: "#FFB300", color: "#FFB300" }
                  : { borderColor: "rgba(255,179,0,0.4)", color: "rgba(255,179,0,0.4)", pointerEvents: "none" }
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
              </svg>
              Call Now
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section: Bottom 3-up trust strip ─────────────────────────────────
function BottomTrustStrip() {
  return (
    <section className="w-full px-4 pb-10 pt-6 sm:px-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TrustCell
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7l-9-5z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          }
          title="Free Quotes"
          subtitle="No obligation"
        />
        <TrustCell
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 3h15v13H1z" />
              <path d="M16 8h4l3 3v5h-7z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          }
          title="Fast Response"
          subtitle="Usually replies within 1 hour"
        />
        <TrustCell
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7l-9-5z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          }
          title="Quality Guaranteed"
          subtitle="We stand by our work"
        />
      </div>
    </section>
  );
}

function TrustCell({
  icon,
  title,
  subtitle
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFB300]/15">
        {icon}
      </span>
      <div>
        <p className="text-sm font-extrabold text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-500">{subtitle}</p>
      </div>
    </div>
  );
}
function ServiceAreaAndHours({ listing }: { listing: HammerexTradeOffListing }) {
  // Service-area map moved to the dedicated /services subpage — this
  // section now only renders Opening Hours so the home page stays
  // focused on the buying decision.
  const hasHours =
    listing.operating_hours && Object.keys(listing.operating_hours).length > 0;
  if (!hasHours) return null;

  return (
    <section className="w-full px-4 pt-8 sm:px-6">
      <div className="grid gap-4 md:grid-cols-2">
        {hasHours && (
          <div>
            <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
              Opening hours
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Today is highlighted — outside these hours, leave a message.
            </p>
            <div className="mt-3">
              <OperatingHoursPanel
                hours={listing.operating_hours}
                themeColor="#FFB300"
                bare
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────
// STANDARD layout — free-for-life tier (unchanged from current page, plus
// a small "Standard listing" eyebrow + Upgrade pill, and the accepting-jobs
// pill if jobs are open).
// ─────────────────────────────────────────────────────────────────────────

function StandardLayout({
  listing,
  projects,
  toolProducts,
  tierLabel,
  blurb,
  waUrl,
  profileFullUrl
}: {
  listing: HammerexTradeOffListing;
  projects: HammerexTradeOffProject[];
  toolProducts: HammerexProduct[];
  tierLabel: string | null;
  blurb: string;
  waUrl: string;
  profileFullUrl: string;
}) {
  const primary = tradeLabel(listing.primary_trade);
  const cover = listing.photos[0] ?? listing.avatar_url ?? BRAND.logo;
  const gallery = listing.photos.slice(1);
  const cityLower = listing.city.toLowerCase();
  const initial = (listing.display_name.charAt(0) || "?").toUpperCase();
  const mailto = `mailto:${listing.email}?subject=${encodeURIComponent("Quotation request via Hammerex Trade Off")}`;

  return (
    <>
      {/* Powered-by chip */}
      <div className="mx-auto max-w-6xl px-4 pt-3">
        <div className="rounded-full bg-neutral-100 px-3 py-1.5 text-center text-[13px] text-brand-muted">
          <span aria-hidden="true">⚡</span> Powered by{" "}
          <a href="/trade-off" className="font-semibold text-brand-text hover:text-[#FFB300]">
            Hammerex Trade Off
          </a>{" "}
          · Shareable trade profile
        </div>
      </div>

      {/* Standard listing eyebrow + Upgrade pill */}
      <div className="mx-auto max-w-6xl px-4 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-widest text-brand-muted">
            Standard listing
          </p>
          <a
            href={`/trade-off/upgrade?slug=${encodeURIComponent(listing.slug)}`}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition hover:border-amber-400 hover:text-amber-800"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
            Upgrade to Xrated App for free — try 30 days
          </a>
        </div>
      </div>

      <nav className="mx-auto max-w-6xl px-4 pt-4 text-xs text-brand-muted" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2">
          <li><a href="/" className="hover:text-brand-text">Home</a></li>
          <li>/</li>
          <li><a href="/trade-off" className="hover:text-brand-text">Trade Off</a></li>
          <li>/</li>
          <li>
            <a href={`/trade-off/${listing.primary_trade}`} className="hover:text-brand-text">
              {primary}
            </a>
          </li>
          <li>/</li>
          <li>
            <a
              href={`/trade-off/${listing.primary_trade}/${encodeURIComponent(cityLower)}`}
              className="hover:text-brand-text"
            >
              {listing.city}
            </a>
          </li>
          <li>/</li>
          <li className="text-brand-text">{listing.display_name}</li>
        </ol>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pt-3">
        <TradeProfileUrlChip slug={listing.slug} fullUrl={profileFullUrl} />
      </div>

      {/* Hero / identity */}
      <section className="mx-auto max-w-6xl px-4 pb-6 pt-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <figure className="relative overflow-hidden rounded-2xl border border-brand-line bg-neutral-100">
            <img
              src={cover}
              alt={listing.display_name}
              width={1200}
              height={675}
              className="block aspect-[16/9] w-full object-cover"
            />
            <div className="absolute -bottom-8 left-5 h-20 w-20 overflow-hidden rounded-full border-4 border-brand-bg bg-brand-surface shadow-2xl sm:h-24 sm:w-24">
              {listing.avatar_url ? (
                <img
                  src={listing.avatar_url}
                  alt={`${listing.display_name} profile photo`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-brand-accent text-3xl font-bold text-black">
                  {initial}
                </div>
              )}
            </div>
          </figure>

          <div className="flex flex-col pt-10 lg:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
                Hammerex Trade Off
              </p>
            </div>
            <h1 className="mt-2 text-2xl font-bold leading-tight text-brand-text sm:text-4xl">
              {listing.display_name}
            </h1>
            {listing.trading_name && (
              <p className="mt-1 text-sm text-brand-muted">{listing.trading_name}</p>
            )}
            <p className="mt-2 text-xs text-brand-muted">
              Joined {formatJoinedMonth(listing.joined_at)}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-brand-line bg-brand-surface px-3 py-1 text-xs font-semibold text-brand-text">
                {primary}
              </span>
              {listing.secondary_trades.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center rounded-full border border-brand-line bg-neutral-100 px-3 py-1 text-xs text-brand-muted"
                >
                  {tradeLabel(s)}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-line bg-brand-surface px-3 py-1 text-xs text-brand-text">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {listing.city} · {listing.country}
              </span>
            </div>

            <div className="mt-4">
              <TradeSocialIcons listing={listing} />
            </div>

            <div className="mt-6">
              <InstantQuoteForm
                slug={listing.slug}
                displayName={listing.display_name}
                tradeLabel={primary}
                whatsapp={listing.whatsapp}
                listingId={listing.id}
              />
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              {listing.phone && (
                <a
                  href={`tel:${listing.phone.replace(/\s+/g, "")}`}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-brand-line bg-brand-surface px-6 text-sm font-semibold text-brand-text transition hover:border-brand-accent hover:text-brand-accent sm:w-fit"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
                  </svg>
                  Call
                </a>
              )}
              {listing.email && (
                <a
                  href={mailto}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-brand-line bg-brand-surface px-6 text-sm font-semibold text-brand-text transition hover:border-brand-accent hover:text-brand-accent sm:w-fit"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" />
                    <path d="m22 6-10 7L2 6" />
                  </svg>
                  Email
                </a>
              )}
            </div>

            <p className="mt-4 text-xs text-brand-muted">
              {listing.report_count > 0 && (
                <>
                  {listing.report_count} report{listing.report_count === 1 ? "" : "s"} —{" "}
                </>
              )}
              please use the report button only for inappropriate listings.
            </p>
          </div>
        </div>
      </section>

      <HammerexStandardBadge listing={listing} tierLabel={tierLabel} blurb={blurb} />

      {listing.bio && (
        <section className="mx-auto max-w-3xl px-4 pb-2 pt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-brand-accent">
            About
          </h2>
          <p className="mt-3 line-clamp-8 whitespace-pre-wrap text-sm leading-relaxed text-brand-text">
            {listing.bio}
          </p>
        </section>
      )}

      {projects.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-2 pt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-brand-accent">
            Verified work
          </h2>
          <div className="mt-3">
            <ProjectGalleryGrid projects={projects} />
          </div>
        </section>
      )}

      <ToolsIUseBlock toolProducts={toolProducts} tierLabel={tierLabel} />

      {gallery.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-2 pt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-brand-accent">
            Work in progress
          </h2>
          <div className="mt-3">
            <TradePhotoGallery photos={gallery} name={listing.display_name} />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-2 pt-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Areas served
        </h2>
        {(typeof listing.lat === "number" && typeof listing.lng === "number") && (
          <div className="mt-3">
            <TradeAreaMap
              lat={listing.lat}
              lng={listing.lng}
              city={listing.city}
              servicePostcodes={listing.service_postcodes}
            />
          </div>
        )}
        <ul className="mt-3 flex flex-wrap gap-2">
          {(listing.service_postcodes.length > 0
            ? listing.service_postcodes
            : [listing.city]
          ).map((area) => (
            <li key={area}>
              <span className="inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-surface px-4 text-xs font-semibold text-brand-text">
                {area}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-3xl px-4 pt-4">
        <div className="flex flex-wrap items-center gap-2 pt-6">
          <a
            href={`/trade/${listing.slug}/qr.png?download=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-brand-line bg-neutral-50 px-4 text-xs font-semibold text-brand-text transition hover:border-[#FFB300] hover:text-[#FFB300]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2h-4" />
              <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
              <path d="M3 9V5a2 2 0 0 1 2-2h4" />
              <path d="M15 3h4a2 2 0 0 1 2 2v4" />
            </svg>
            Download QR
          </a>
        </div>
        <GuideShareBar url={profileFullUrl} title={listing.display_name} />
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-12 pt-6">
        <TradeReportButton listingId={listing.id} />
      </section>
    </>
  );
}

