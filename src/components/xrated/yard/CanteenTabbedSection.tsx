"use client";

// CanteenTabbedSection — the canteen home dashboard's core content
// section. Three tabs (Feed / Products / Jobs) render into the same
// scrollable strip so the section stays in prime real estate and the
// user never has to leave the page to browse.
//
// Quick Action buttons ("Products", "My Jobs") deep-link into the
// right tab via URL hash (#tab-products / #tab-jobs) so the tap-to-
// switch feels instant. Owners get a "+ Add" button in the section
// header when the active tab has an add flow.
//
// Row cards share a **landscape** template — image on the right,
// content on the left — matching the feed card language so posts,
// products, and jobs feel visually unified.

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Heart,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Star,
  Sparkles,
  MessageCircle,
  X,
  Map as MapIcon,
  MapPin,
  Clock
} from "lucide-react";
import type { CanteenProduct } from "@/lib/canteens";
import type { RotatorPost } from "@/components/xrated/yard/CanteenMobilePostsRotator";
import { competitorSlugsFor, tradeLabel as lookupTradeLabel } from "@/lib/tradeOff";
import { reviewsForMerchant, overallForReview } from "@/lib/reviews";

const TAN = "#B8860B";
const TAN_SOFT = "#F5E9D3";
const BRAND_BLACK = "#0A0A0A";

type TabSlug = "feed" | "products" | "jobs" | "contact" | "trades" | "reviews";
const TABS: { slug: TabSlug; label: string }[] = [
  { slug: "feed",     label: "Feed" },
  { slug: "products", label: "Products" },
  { slug: "jobs",     label: "Jobs" },
  { slug: "contact",  label: "Contact" },
  { slug: "trades",   label: "Trades" },
  { slug: "reviews",  label: "Reviews" }
];

// Demo reviews for the Reviews tab. Real review data will land when
// the review submission UI ships. Format matches what the review
// system will emit: name, rating (1-5), body, date, verified flag.
type DemoReview = {
  id: string;
  reviewerName: string;
  reviewerCity: string;
  rating: number;
  body: string;
  createdAt: string;
  jobType: string;
  /** Reviewer photo. Falls back to black initials chip when missing. */
  avatarUrl?: string | null;
  /** Project photo — when present the card shows the work delivered
   *  as the large right-hand image. Overrides the avatar chip. */
  photoUrl?: string | null;
};

const DEMO_REVIEWS: DemoReview[] = [
  { id: "r1", reviewerName: "Rachel S.",   reviewerCity: "Sale",       rating: 5, body: "The joinery is spec you don't get from a showroom. On time, priced clearly, no callbacks.",                                       createdAt: new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString(), jobType: "Kitchen refit" },
  { id: "r2", reviewerName: "Andrew D.",   reviewerCity: "Altrincham", rating: 5, body: "Full-height carcass fit-out. Turned my tired kitchen into something I'm proud of. Two-week turnaround.",                          createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(), jobType: "Full kitchen fit" },
  { id: "r3", reviewerName: "Priya M.",    reviewerCity: "Stockport",  rating: 4, body: "Great craftsmanship. Small delay on the worktop but communicated well throughout. Would hire again.",                              createdAt: new Date(Date.now() - 34 * 24 * 60 * 60 * 1000).toISOString(), jobType: "Cabinet refresh" },
  { id: "r4", reviewerName: "Sam B.",      reviewerCity: "Manchester", rating: 5, body: "First call for unusual bespoke work — anything our designers draw, his team builds. Six years running.",                          createdAt: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString(), jobType: "Custom joinery" },
  { id: "r5", reviewerName: "Emma T.",     reviewerCity: "Cheadle",    rating: 5, body: "Beautiful shaker doors and brushed brass handles. Clean site, tidy install, dust-free hand-back.",                                createdAt: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString(), jobType: "Shaker kitchen" },
  { id: "r6", reviewerName: "James O.",    reviewerCity: "Bolton",     rating: 4, body: "Solid work. Not the cheapest but you get what you pay for. Two years on and everything still perfect.",                            createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(), jobType: "Kitchen refit" }
];

// Demo trades for the Find Trades tab. When real trade signups roll
// in these will be pulled from the DB and filtered by competitor set
// server-side. For now this is a curated subset to prove the flow.
type DemoTrade = {
  slug: string;
  displayName: string;
  tradeSlug: string;
  city: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  whatsapp: string;
  bio: string;
};

const DEMO_TRADES: DemoTrade[] = [
  { slug: "demo-james-holt-plumbing",       displayName: "James Holt Plumbing & Gas", tradeSlug: "plumber",                 city: "Nottingham", rating: 4.9, reviewCount: 68, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png", whatsapp: "447700900450", bio: "Gas Safe. Boiler installs, radiator swaps." },
  { slug: "demo-craig-mcdermott-electrical", displayName: "Craig McDermott Electrical", tradeSlug: "electrician",             city: "Leeds",      rating: 4.8, reviewCount: 52, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_26_18%20AM.png", whatsapp: "447700900461", bio: "NICEIC. Kitchen circuits + EV chargers." },
  { slug: "demo-sarah-yates-tiling",         displayName: "Sarah Yates Tiling",         tradeSlug: "tiler",                   city: "Sheffield",  rating: 5.0, reviewCount: 41, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_44_32%20AM.png", whatsapp: "447700900472", bio: "Porcelain + natural stone. Splashbacks." },
  { slug: "demo-bob-watson-plastering",      displayName: "Bob Watson Plastering",      tradeSlug: "plasterer",               city: "Manchester", rating: 4.9, reviewCount: 74, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png", whatsapp: "447700900483", bio: "18 years. Skim, render, damp treatment." },
  { slug: "demo-anna-forde-decorating",      displayName: "Anna Forde Decorating",      tradeSlug: "painter",                 city: "Preston",    rating: 4.9, reviewCount: 33, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2012_45_11%20AM.png", whatsapp: "447700900494", bio: "Farrow & Ball. Cabinet respraying." },
  { slug: "demo-danny-lawson-carpentry",     displayName: "Danny Lawson Joinery",       tradeSlug: "carpenter",               city: "Hull",       rating: 4.7, reviewCount: 22, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2012_01_55%20AM.png", whatsapp: "447700900505", bio: "Bespoke joinery. Wardrobes, staircases." },
  { slug: "demo-steve-obrien-roofing",       displayName: "Steve O'Brien Roofing",      tradeSlug: "roofer",                  city: "Liverpool",  rating: 4.9, reviewCount: 58, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_44_51%20PM.png", whatsapp: "447700900516", bio: "Slate, tile, flat roof. Lead flashing." },
  { slug: "demo-paul-webb-bricklaying",      displayName: "Paul Webb Bricklayer",       tradeSlug: "bricklayer",              city: "Bolton",     rating: 4.8, reviewCount: 39, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_46_00%20PM.png", whatsapp: "447700900527", bio: "RSJ specialist. Open-plan builds." },
  { slug: "demo-ryan-cross-steel",           displayName: "Ryan Cross Steel Erector",   tradeSlug: "structural-steel-erector", city: "Glasgow",    rating: 4.7, reviewCount: 18, imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_34_38%20PM.png", whatsapp: "447700900538", bio: "Steel installs, RSJ lifts, mezzanines." }
];

function isLive(iso: string): boolean {
  return Date.now() - Date.parse(iso) < 5 * 60 * 1000;
}

function timeAgoShort(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

// Demo thumbnails keyed off author slug so demo posts always look
// consistent. Same technique as the LiveFeed rotator.
const DEMO_THUMBS = [
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2011_04_56%20PM.png",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_44_32%20AM.png",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_00_58%20AM.png"
];

// Default row count shown in the collapsed view. "See all" reveals
// this many MORE rows on top of the default (so expanded = default +
// DEFAULT_LIMIT reveal), giving the user a chunk to scan without a
// full page navigation.
const DEFAULT_LIMIT = 4;
const REVEAL_MORE = 10;

export function CanteenTabbedSection({
  canteenSlug,
  isHost: _isHost,
  posts,
  products,
  hostDisplayName,
  hostFirstName,
  hostSlug,
  hostWhatsapp,
  tradeSlug,
  tradeLabel,
  hostRating,
  addressLine,
  postcode,
  city,
  postcodeArea,
  openingHours
}: {
  canteenSlug: string;
  isHost: boolean;
  posts: RotatorPost[];
  products: CanteenProduct[];
  hostDisplayName?: string;
  hostFirstName: string;
  /** Merchant slug — powers the Reviews tab lookup against the
   *  canonical `reviewsForMerchant()` source. Same reviews that appear
   *  on `/trade/{hostSlug}/reviews`. */
  hostSlug?: string;
  hostWhatsapp: string | null;
  /** Current trade slug — powers the Trades tab's competitor filter
   *  so Mike Watson (kitchen-fitter) never sees other kitchen fitters. */
  tradeSlug?: string | null;
  tradeLabel: string;
  hostRating: { avg: number; count: number } | null;
  addressLine?: string | null;
  postcode?: string | null;
  city?: string | null;
  postcodeArea?: string | null;
  openingHours?: string | null;
}) {
  const [activeTab, setActiveTab] = useState<TabSlug>("feed");
  // Product detail lightbox — when set, the Products tab renders the
  // compact detail view for that product id instead of the row list.
  const [viewingProductId, setViewingProductId] = useState<string | null>(null);
  // Per-tab expanded state so switching tabs doesn't leak the "see
  // all" state across sections.
  const [expanded, setExpanded] = useState<Record<TabSlug, boolean>>({
    feed:     false,
    products: false,
    jobs:     false,
    contact:  false,
    trades:   false,
    reviews:  false
  });
  const isExpanded = expanded[activeTab];
  const limit = isExpanded ? DEFAULT_LIMIT + REVEAL_MORE : DEFAULT_LIMIT;
  function toggleExpanded() {
    setExpanded((s) => ({ ...s, [activeTab]: !s[activeTab] }));
  }

  // Deep-link + Quick Action wiring. TWO paths that can switch the tab:
  //   1. `canteen:set-tab` CustomEvent — dispatched by Quick Action
  //      buttons on the same page. Bulletproof cross-browser.
  //   2. URL hash `#tab-{slug}` — supports direct deep-links from
  //      other surfaces and refresh persistence.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Read hash on mount so a shared URL like /uk-kitchen-fitters#tab-jobs
    // opens on the right tab.
    const initial = window.location.hash.replace(/^#tab-/, "");
    if (initial === "products" || initial === "jobs" || initial === "feed" || initial === "contact" || initial === "trades" || initial === "reviews") {
      setActiveTab(initial as TabSlug);
    }
    function handleSetTab(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const t = detail.tab;
      if (t === "products" || t === "jobs" || t === "feed" || t === "contact" || t === "trades" || t === "reviews") {
        setActiveTab(t);
      }
    }
    function handleHashChange() {
      const h = window.location.hash.replace(/^#tab-/, "");
      if (h === "products" || h === "jobs" || h === "feed" || h === "contact" || h === "trades" || h === "reviews") {
        setActiveTab(h as TabSlug);
      }
    }
    window.addEventListener("canteen:set-tab", handleSetTab as EventListener);
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("canteen:set-tab", handleSetTab as EventListener);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  function selectTab(t: TabSlug) {
    setActiveTab(t);
    // Update the URL hash without triggering a scroll jump.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#tab-${t}`);
    }
  }

  // Clear the product quick-view whenever the user leaves the Products
  // tab so returning to it starts on the list, not a stale detail.
  useEffect(() => {
    if (activeTab !== "products") setViewingProductId(null);
  }, [activeTab]);

  // Derived data — jobs are showcase posts with at least one photo.
  const jobs = useMemo(
    () => posts.filter((p) => p.imageUrl),
    [posts]
  );
  // Trades tab filters the demo list to complementary trades only.
  const complementaryTrades = useMemo(() => {
    if (!tradeSlug) return DEMO_TRADES;
    const banned = competitorSlugsFor(tradeSlug);
    return DEMO_TRADES.filter((t) => !banned.has(t.tradeSlug));
  }, [tradeSlug]);

  // Reviews — pulled from the canonical review store keyed by merchant
  // slug so the same reviews shown on `/trade/{hostSlug}/reviews` render
  // inside the Reviews tab. Falls back to DEMO_REVIEWS when the host
  // has no reviews on file yet.
  const reviews = useMemo<DemoReview[]>(() => {
    if (!hostSlug) return DEMO_REVIEWS;
    const merchantReviews = reviewsForMerchant(hostSlug);
    if (merchantReviews.length === 0) return DEMO_REVIEWS;
    return merchantReviews.map((r) => ({
      id:            r.id,
      reviewerName:  r.reviewer.displayName,
      reviewerCity:  r.reviewer.city,
      rating:        Math.round(overallForReview(r.scores)),
      body:          r.body,
      createdAt:     r.createdAt,
      jobType:       r.reviewer.tradeLabel,
      avatarUrl:     r.reviewer.avatarUrl,
      photoUrl:      r.photoUrls[0] ?? null
    }));
  }, [hostSlug]);

  const sectionLabel = activeTab === "feed" ? "Live Feed"
    : activeTab === "products" ? "Products"
    : activeTab === "jobs" ? "Jobs"
    : activeTab === "trades" ? "Trades"
    : activeTab === "reviews" ? "Reviews"
    : "Contact";

  // Total items in the active list — powers the "N more" badge on
  // the See all button so users know how much is behind it.
  const totalForActive =
    activeTab === "feed" ? posts.length
    : activeTab === "products" ? products.length
    : activeTab === "jobs" ? jobs.length
    : activeTab === "trades" ? complementaryTrades.length
    : activeTab === "reviews" ? reviews.length
    : 0;
  const isContact = activeTab === "contact";
  const hiddenCount = Math.max(0, totalForActive - limit);
  const seeAllLabel = activeTab === "feed" ? "posts"
    : activeTab === "products" ? "products"
    : activeTab === "jobs" ? "jobs"
    : activeTab === "trades" ? "trades"
    : activeTab === "reviews" ? "reviews"
    : "";

  return (
    <section id="canteen-tabbed">
      {/* Section header — label only, no tab controls. Content
          switches based on Quick Action button hash (#tab-products /
          #tab-jobs / #tab-contact / #tab-trades) since the 5 quick
          actions are the ONLY controls for this section. */}
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[15px] font-black text-neutral-900">
          {sectionLabel}
        </span>
        {activeTab === "feed" && (
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ backgroundColor: TAN }}
          />
        )}
      </div>

      {/* Trades tab disclaimer — honest positioning: platform helps
          the customer find, never vets the trades. Legal protection +
          fair-standing brand mark for The Network. */}
      {activeTab === "trades" && (
        <p className="mb-2 text-[10.5px] leading-snug text-neutral-500">
          Trades listed to help you find a tradesperson in your area — <span className="font-black text-neutral-700">we don&apos;t verify any trade.</span> Always do your own checks.
        </p>
      )}
      {activeTab === "reviews" && (
        <p className="mb-2 text-[10.5px] leading-snug text-neutral-500">
          Reviews left by customers on The Network — <span className="font-black text-neutral-700">unverified.</span> Treat them as guidance, not proof.
        </p>
      )}

      {/* Content — landscape row cards, sliced to `limit`. No max
          height cap; the section grows as more rows reveal. */}
      <div className="relative">
        {activeTab === "feed" && (
          <FeedList
            posts={posts.slice(0, limit)}
            canteenSlug={canteenSlug}
            tradeLabel={tradeLabel}
          />
        )}
        {activeTab === "products" && (
          viewingProductId
            ? <ProductQuickView
                product={products.find((p) => p.id === viewingProductId) ?? null}
                canteenSlug={canteenSlug}
                hostFirstName={hostFirstName}
                hostWhatsapp={hostWhatsapp}
                hostRating={hostRating}
                onClose={() => setViewingProductId(null)}
              />
            : <ProductsList
                products={products.slice(0, limit)}
                canteenSlug={canteenSlug}
                hostRating={hostRating}
                onView={(id) => setViewingProductId(id)}
              />
        )}
        {activeTab === "jobs" && (
          <JobsList
            jobs={jobs.slice(0, limit)}
            canteenSlug={canteenSlug}
            hostFirstName={hostFirstName}
            hostWhatsapp={hostWhatsapp}
            tradeLabel={tradeLabel}
          />
        )}
        {activeTab === "trades" && (
          <TradesList trades={complementaryTrades.slice(0, limit)}/>
        )}
        {activeTab === "reviews" && (
          <ReviewsList reviews={reviews.slice(0, limit)}/>
        )}
        {activeTab === "contact" && (
          <ContactCard
            canteenSlug={canteenSlug}
            hostDisplayName={hostDisplayName ?? hostFirstName}
            hostFirstName={hostFirstName}
            hostWhatsapp={hostWhatsapp}
            tradeLabel={tradeLabel}
            addressLine={addressLine ?? null}
            postcode={postcode ?? null}
            city={city ?? null}
            postcodeArea={postcodeArea ?? null}
            openingHours={openingHours ?? null}
          />
        )}
      </div>

      {/* Expand / collapse control — sits at the bottom of the
          section. Reveals up to REVEAL_MORE more rows in-place, then
          the same button turns into a "Close" affordance. Only
          renders when there's more to show OR the section is
          already expanded. Hidden on the Contact tab (single card). */}
      {!isContact && (hiddenCount > 0 || isExpanded) && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={isExpanded}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-[11px] font-black uppercase tracking-wider transition active:scale-[0.97]"
            style={{
              backgroundColor: isExpanded ? "#FFFFFF" : TAN,
              color:           isExpanded ? "#1F2937"  : "#FFFFFF",
              borderColor:     isExpanded ? "rgba(139,69,19,0.20)" : TAN
            }}
          >
            {isExpanded ? (
              <>
                <X size={12} strokeWidth={2.6}/>
                Close
              </>
            ) : (
              <>
                <ChevronDown size={12} strokeWidth={2.6}/>
                See all {seeAllLabel}
                {hiddenCount > 0 && (
                  <span
                    className="ml-1 rounded-full bg-white/25 px-1.5 py-0.5 text-[9px]"
                  >
                    +{Math.min(hiddenCount, REVEAL_MORE)}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      )}

      {/* When expanded AND there's STILL more behind the extra reveal,
          a small "Open full page" link routes to the dedicated
          feed/products/jobs page for the deep browse. */}
      {!isContact && isExpanded && hiddenCount > REVEAL_MORE && (
        <div className="mt-2 flex justify-center">
          <Link
            href={activeTab === "feed"
              ? `/trade-off/yard/canteens/${canteenSlug}/feed`
              : activeTab === "products"
                ? `/trade-off/yard/canteens/${canteenSlug}/products`
                : `/trade-off/yard/canteens/${canteenSlug}/jobs`}
            className="inline-flex items-center gap-0.5 text-[10.5px] font-black uppercase tracking-wider"
            style={{ color: TAN }}
          >
            Open full page
            <ChevronRight size={11} strokeWidth={2.5}/>
          </Link>
        </div>
      )}
    </section>
  );
}

// ─── Feed rows ─────────────────────────────────────────────

function FeedList({
  posts,
  canteenSlug,
  tradeLabel
}: {
  posts: RotatorPost[];
  canteenSlug: string;
  tradeLabel: string;
}) {
  if (posts.length === 0) return <EmptyRow label="No posts yet"/>;
  return (
    <ul className="flex flex-col gap-2">
      {posts.map((p, i) => {
        const thumb = p.imageUrl || DEMO_THUMBS[
          (p.authorSlug.charCodeAt(0) + i) % DEMO_THUMBS.length
        ];
        return (
          <li key={p.id}>
            <Link
              href={`/trade-off/yard/canteens/${canteenSlug}/post?reply=${encodeURIComponent(p.id)}`}
              className="flex items-center gap-3 rounded-xl p-2 transition active:bg-neutral-900/[0.03]"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                    style={{ backgroundColor: TAN }}
                  >
                    {p.authorDisplayName.charAt(0)}
                  </span>
                  <span className="truncate text-[12px] font-black text-neutral-900">
                    {p.authorDisplayName}
                  </span>
                  <span className="text-[10px] font-bold text-neutral-500">
                    · {timeAgoShort(p.createdAt)}
                  </span>
                  {isLive(p.createdAt) && (
                    <span
                      className="ml-auto rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em]"
                      style={{ backgroundColor: "rgba(184,134,11,0.15)", color: TAN }}
                    >
                      LIVE
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 text-[11.5px] leading-snug text-neutral-800">
                  {p.body}
                </p>
                <div className="mt-1 flex items-center gap-3 text-[10px] font-black text-neutral-500">
                  <span className="inline-flex items-center gap-0.5">
                    <Heart size={11} strokeWidth={2.3}/>
                    {p.reactionsLike ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <MessageSquare size={11} strokeWidth={2.3}/>
                    {p.replyCount ?? 0}
                  </span>
                  <span className="text-neutral-400">· {tradeLabel}</span>
                </div>
              </div>
              <div
                className="h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-xl shadow-sm sm:h-20 sm:w-20"
                style={{
                  backgroundImage: `url('${thumb}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: "#F3F4F6"
                }}
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Product rows ──────────────────────────────────────────

function ProductsList({
  products,
  canteenSlug: _canteenSlug,
  hostRating,
  onView
}: {
  products: CanteenProduct[];
  canteenSlug: string;
  hostRating: { avg: number; count: number } | null;
  onView: (productId: string) => void;
}) {
  if (products.length === 0) return <EmptyRow label="No products yet"/>;
  return (
    <ul className="flex flex-col gap-2">
      {products.map((p) => {
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onView(p.id)}
              className="flex w-full items-center gap-3 rounded-xl border bg-white p-2 text-left shadow-sm transition active:bg-neutral-50 active:scale-[0.99]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  {p.featured && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: TAN_SOFT, color: TAN }}
                    >
                      <Sparkles size={8} strokeWidth={3}/>
                      Featured
                    </span>
                  )}
                  {p.bulkBuy && (
                    <span
                      className="rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-white"
                      style={{ backgroundColor: "#166534" }}
                    >
                      Bulk · {p.bulkBuy.committedCount}/{p.bulkBuy.targetCount}
                    </span>
                  )}
                </div>
                <div className="line-clamp-2 text-[12.5px] font-black leading-tight text-neutral-900">
                  {p.name}
                </div>
                {p.blurb && (
                  <p className="mt-0.5 line-clamp-1 text-[10.5px] leading-snug text-neutral-600">
                    {p.blurb}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2 text-[10.5px] font-black text-neutral-700">
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[11px] shadow-sm"
                    style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                  >
                    £{p.priceGbp}
                  </span>
                  {hostRating && (
                    <span className="inline-flex items-center gap-0.5 text-neutral-500">
                      <Star size={10} fill="currentColor" strokeWidth={0} style={{ color: "#F59E0B" }}/>
                      {hostRating.avg.toFixed(1)}
                    </span>
                  )}
                  {/* View product pill — visually reinforces that the
                      row expands to a compact detail view. Whole row is
                      still tappable; this pill just makes the action
                      obvious. */}
                  <span
                    className="ml-auto inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-[9.5px] font-black uppercase tracking-wider shadow-sm"
                    style={{ backgroundColor: TAN, color: "#FFFFFF" }}
                  >
                    View
                    <ChevronRight size={10} strokeWidth={2.6}/>
                  </span>
                </div>
              </div>
              <div
                className="h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-xl shadow-sm sm:h-20 sm:w-20"
                style={{
                  backgroundImage: `url('${p.imageUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: "#F3F4F6"
                }}
                aria-hidden
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Product Quick View (in-tab compact PDP) ───────────────
//
// Replaces the ProductsList when a row's View button is tapped.
// Compact detail card: image + name + price + description + specs +
// WhatsApp CTA + "See full details" link to the dedicated PDP page.

function ProductQuickView({
  product,
  canteenSlug,
  hostFirstName,
  hostWhatsapp,
  hostRating,
  onClose
}: {
  product: CanteenProduct | null;
  canteenSlug: string;
  hostFirstName: string;
  hostWhatsapp: string | null;
  hostRating: { avg: number; count: number } | null;
  onClose: () => void;
}) {
  if (!product) {
    return (
      <div className="rounded-xl border-2 border-dashed p-4 text-center text-[11px] font-bold text-neutral-500"
        style={{ borderColor: "rgba(139,69,19,0.20)" }}
      >
        Product not found.
        <button
          type="button"
          onClick={onClose}
          className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-black text-white"
          style={{ backgroundColor: BRAND_BLACK }}
        >
          Back
        </button>
      </div>
    );
  }
  const waUrl = hostWhatsapp
    ? `https://wa.me/${hostWhatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hi ${hostFirstName}, I'm interested in "${product.name}" on The Network. Can you tell me more?`
      )}`
    : null;

  return (
    <div className="relative">
      {/* Close X — top-right, always visible */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close product detail"
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md active:scale-[0.95]"
        style={{ backgroundColor: BRAND_BLACK }}
      >
        <X size={14} strokeWidth={2.6}/>
      </button>

      {/* Hero image — bulk-buy chip stays (it's meaningful info,
          not a badge). Featured badge + price pill removed per spec. */}
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-xl"
        style={{
          backgroundImage: `url('${product.imageUrl}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "#F3F4F6"
        }}
        aria-hidden
      >
        {product.bulkBuy && (
          <span
            className="absolute left-2 top-2 rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-md"
            style={{ backgroundColor: "#166534" }}
          >
            Bulk · {product.bulkBuy.committedCount}/{product.bulkBuy.targetCount}
          </span>
        )}
      </div>

      {/* Body — no card wrapper, sits directly on the tab section bg */}
      <div className="pt-3">
        <div className="text-[14px] font-black leading-tight text-neutral-900">
          {product.name}
        </div>
        {/* Price — plain typography, no pill. Falls back to
            "Price on request" when the host hasn't set one. */}
        <div className="mt-0.5 text-[16px] font-black leading-none text-neutral-900">
          {product.priceGbp > 0 ? `£${product.priceGbp}` : (
            <span className="italic text-neutral-600">Price on request</span>
          )}
        </div>
        {product.blurb && (
          <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-600">
            {product.blurb}
          </p>
        )}
        {hostRating && (
          <div className="mt-1 inline-flex items-center gap-0.5 text-[10.5px] font-bold text-neutral-500">
            <Star size={10} fill="currentColor" strokeWidth={0} style={{ color: "#F59E0B" }}/>
            {hostRating.avg.toFixed(1)}
            <span className="text-neutral-400">· {hostRating.count} reviews</span>
          </div>
        )}
        {product.description && (
          <p className="mt-2 whitespace-pre-wrap text-[12px] leading-snug text-neutral-800">
            {product.description.length > 240
              ? product.description.slice(0, 240) + "…"
              : product.description}
          </p>
        )}
        {product.specs && product.specs.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-[11px] leading-snug text-neutral-700">
            {product.specs.slice(0, 4).map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span
                  aria-hidden
                  className="mt-1 inline-block h-1 w-1 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: TAN }}
                />
                {s}
              </li>
            ))}
          </ul>
        )}

        {/* Action — single compact centered pill. Short width so it
            reads as a decisive CTA, not a full-width form button. */}
        {waUrl && (
          <div className="mt-3 flex justify-center">
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98]"
              style={{ backgroundColor: "#166534" }}
            >
              <MessageCircle size={13} strokeWidth={2.5}/>
              Ask about this
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Job rows ──────────────────────────────────────────────

function JobsList({
  jobs,
  canteenSlug,
  hostFirstName,
  hostWhatsapp,
  tradeLabel
}: {
  jobs: RotatorPost[];
  canteenSlug: string;
  hostFirstName: string;
  hostWhatsapp: string | null;
  tradeLabel: string;
}) {
  if (jobs.length === 0) return <EmptyRow label="No jobs uploaded yet"/>;
  return (
    <ul className="flex flex-col gap-2">
      {jobs.map((j, i) => {
        const thumb = j.imageUrl || DEMO_THUMBS[
          (j.authorSlug.charCodeAt(0) + i) % DEMO_THUMBS.length
        ];
        const jobsHref = `/trade-off/yard/canteens/${canteenSlug}/jobs`;
        const waUrl = hostWhatsapp
          ? `https://wa.me/${hostWhatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
              `Hi ${hostFirstName}, I saw one of your jobs on The Network — I'd like to book similar ${tradeLabel.toLowerCase()} work.`
            )}`
          : null;
        return (
          <li key={j.id}>
            <div className="flex items-center gap-3 rounded-xl p-2 transition">
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-neutral-500">
                  {tradeLabel} · {timeAgoShort(j.createdAt)}
                </div>
                <p className="line-clamp-2 text-[12px] font-black leading-tight text-neutral-900">
                  {j.body}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Link
                    href={jobsHref}
                    className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
                    style={{ backgroundColor: BRAND_BLACK }}
                  >
                    See
                    <ChevronRight size={10} strokeWidth={2.6}/>
                  </Link>
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
                      style={{ backgroundColor: "#166534" }}
                    >
                      <MessageCircle size={10} strokeWidth={2.5}/>
                      Book
                    </a>
                  )}
                </div>
              </div>
              <Link
                href={jobsHref}
                aria-label="See job details"
                className="h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-xl shadow-sm sm:h-20 sm:w-20"
                style={{
                  backgroundImage: `url('${thumb}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: "#F3F4F6"
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div
      className="rounded-xl border-2 border-dashed p-4 text-center text-[11px] font-bold text-neutral-500"
      style={{ borderColor: "rgba(139,69,19,0.20)" }}
    >
      {label}
    </div>
  );
}

// ─── Contact card (in-tab) ─────────────────────────────────
//
// Full contact form rendered inline when the Contact tab is active.
// Structure (top → bottom):
//
//   1. Company header — name, address, phone number (tappable to call)
//   2. Form — name / email / phone / address / postcode / message
//   3. Submit button — opens WhatsApp with the whole form pre-filled
//      as one clean enquiry message. Falls back to mailto: when the
//      host hasn't published a WhatsApp number.
//   4. Google Maps embed below the submit button — landscape,
//      tappable to open the Google Maps directions app.

function ContactCard({
  canteenSlug: _canteenSlug,
  hostDisplayName,
  hostFirstName,
  hostWhatsapp,
  tradeLabel,
  addressLine,
  postcode,
  city,
  postcodeArea,
  openingHours
}: {
  canteenSlug: string;
  hostDisplayName: string;
  hostFirstName: string;
  hostWhatsapp: string | null;
  tradeLabel: string;
  addressLine: string | null;
  postcode: string | null;
  city: string | null;
  postcodeArea: string | null;
  openingHours: string | null;
}) {
  const fullAddress = [addressLine, postcode, city].filter(Boolean).join(", ");
  const anchor = fullAddress || city || postcodeArea || "the UK";
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(anchor)}&z=${fullAddress ? 15 : 10}&output=embed`;
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(anchor)}`;
  const displayPhone = hostWhatsapp
    ? hostWhatsapp.startsWith("+") ? hostWhatsapp : `+${hostWhatsapp.replace(/^0/, "44 ")}`
    : null;

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPostcode, setCustomerPostcode] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildEnquiryText(): string {
    const lines: string[] = [];
    lines.push(`Hi ${hostFirstName}, enquiry from The Network:`);
    lines.push("");
    if (name) lines.push(`Name: ${name}`);
    if (email) lines.push(`Email: ${email}`);
    if (phone) lines.push(`Phone: ${phone}`);
    const custAddr = [customerAddress, customerPostcode].filter(Boolean).join(", ");
    if (custAddr) lines.push(`Address: ${custAddr}`);
    lines.push("");
    if (message) {
      lines.push(message);
    } else {
      lines.push(`Enquiring about ${tradeLabel.toLowerCase()}.`);
    }
    return lines.join("\n");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) {
      setError("Please add your name and a short message.");
      return;
    }
    setError(null);
    const text = buildEnquiryText();
    if (hostWhatsapp) {
      // WhatsApp deep-link with full form pre-filled as a clean text.
      const digits = hostWhatsapp.replace(/[^0-9]/g, "");
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    } else {
      // Fallback: mailto with the form contents. When the host has
      // no published email either, prefix uses `contact@` at the
      // canteen domain — the shell can wire a real address later.
      const subject = `Enquiry from ${name || "The Network"} · ${tradeLabel}`;
      window.location.href = `mailto:hello@thenetwork.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    }
    setSent(true);
  }

  const submitLabel = hostWhatsapp ? "Send via WhatsApp" : "Send via Email";
  // Dark brand green matches the rest of the app's green accents
  // (WhatsApp deep-links elsewhere use the same tone).
  const submitColor = hostWhatsapp ? "#166534" : BRAND_BLACK;

  return (
    <div className="flex flex-col gap-3">
      {/* Company header — name, address, phone. No outer container:
          sits directly on the feed section background as a header
          strip. */}
      <div className="px-1">
        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-neutral-500">
          {tradeLabel}
        </div>
        <div className="mt-0.5 text-[14px] font-black leading-tight text-neutral-900">
          {hostDisplayName}
        </div>
        <div className="mt-1 flex flex-col gap-0.5 text-[11px] leading-snug text-neutral-700">
          <div className="inline-flex items-center gap-1">
            <MapPin size={11} strokeWidth={2.4} style={{ color: TAN }}/>
            <span className="font-bold">{anchor}</span>
          </div>
          {displayPhone && (
            <a
              href={`tel:${displayPhone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1 font-black"
              style={{ color: BRAND_BLACK }}
            >
              <MessageCircle size={11} strokeWidth={2.4} style={{ color: TAN }}/>
              {displayPhone}
            </a>
          )}
          {openingHours && (
            <div className="inline-flex items-center gap-1 text-[10.5px] font-bold text-neutral-600">
              <Clock size={10} strokeWidth={2.3}/>
              {openingHours}
            </div>
          )}
        </div>
      </div>

      {/* Form — no outer card, fields sit directly in the tab section. */}
      {sent ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: "#166534" }}
          >
            <MessageCircle size={20} strokeWidth={2.4}/>
          </div>
          <div className="text-[13px] font-black text-neutral-900">Message ready to send</div>
          <p className="max-w-xs text-[11px] leading-snug text-neutral-600">
            {hostWhatsapp
              ? `WhatsApp opened with your enquiry — tap send in WhatsApp to reach ${hostFirstName}.`
              : `Email opened with your enquiry — tap send to reach ${hostFirstName}.`}
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-1 inline-flex h-9 items-center gap-1 rounded-full border px-4 text-[10.5px] font-black uppercase tracking-wider text-neutral-800"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            Send another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <FormField label="Your name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 100))}
              placeholder="e.g. Sam Butler"
              className="w-full rounded-lg border p-2 text-[12.5px] text-neutral-800"
              style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
              required
            />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.slice(0, 200))}
                placeholder="you@somewhere.co.uk"
                className="w-full rounded-lg border p-2 text-[12.5px] text-neutral-800"
                style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
              />
            </FormField>
            <FormField label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.slice(0, 20))}
                placeholder="07…"
                className="w-full rounded-lg border p-2 text-[12.5px] text-neutral-800"
                style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
            <FormField label="Your address">
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value.slice(0, 200))}
                placeholder="Street, town"
                className="w-full rounded-lg border p-2 text-[12.5px] text-neutral-800"
                style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
              />
            </FormField>
            <FormField label="Postcode">
              <input
                type="text"
                value={customerPostcode}
                onChange={(e) => setCustomerPostcode(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="M33 7QR"
                className="w-full rounded-lg border p-2 text-[12.5px] font-mono text-neutral-800"
                style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
              />
            </FormField>
          </div>
          <FormField label="Message" required>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
              rows={3}
              placeholder={`Hi ${hostFirstName}, I'd like a quote for…`}
              className="w-full resize-none rounded-lg border p-2 text-[12.5px] leading-relaxed text-neutral-800"
              style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
              required
            />
          </FormField>

          {error && (
            <div className="text-[10.5px] font-black uppercase tracking-wider text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full text-[12px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.98]"
            style={{ backgroundColor: submitColor }}
          >
            <MessageCircle size={14} strokeWidth={2.5}/>
            {submitLabel}
          </button>
        </form>
      )}

      {/* Map — landscape rectangle below the form. Whole surface is a
          tap-through to Google Maps directions; yellow "Directions"
          pill with map icon sits bottom-right. */}
      <a
        href={directionsHref}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Open in Google Maps for directions"
        className="relative block h-40 w-full overflow-hidden rounded-xl border sm:h-48"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <iframe
          title={`Map for ${hostDisplayName}`}
          src={mapSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="pointer-events-none block h-full w-full"
          style={{ border: 0 }}
        />
        <span
          className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-lg"
          style={{ backgroundColor: "#FFB300" }}
        >
          <MapIcon size={12} strokeWidth={2.5}/>
          Directions
        </span>
      </a>
    </div>
  );
}

// ─── Trades rows (Find Trades tab) ─────────────────────────

function TradesList({ trades }: { trades: DemoTrade[] }) {
  if (trades.length === 0) return <EmptyRow label="No matching trades yet"/>;
  return (
    <ul className="flex flex-col gap-2">
      {trades.map((t) => {
        const label = lookupTradeLabel(t.tradeSlug);
        const waUrl = `https://wa.me/${t.whatsapp}?text=${encodeURIComponent(
          `Hi ${t.displayName.split(" ")[0]}, I found you on The Network — I'd like to get in touch about ${label.toLowerCase()}.`
        )}`;
        return (
          <li key={t.slug}>
            <div
              className="flex items-center gap-3 rounded-xl border bg-white p-2 shadow-sm transition"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-500">
                  {label} · {t.city}
                </div>
                <div className="mt-0.5 line-clamp-1 text-[13px] font-black leading-tight text-neutral-900">
                  {t.displayName}
                </div>
                <p className="mt-0.5 line-clamp-1 text-[10.5px] leading-snug text-neutral-600">
                  {t.bio}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-black shadow-sm"
                    style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                  >
                    <Star size={9} fill="currentColor" strokeWidth={0} style={{ color: "#0A0A0A" }}/>
                    {t.rating.toFixed(1)}
                  </span>
                  <span className="text-[10px] font-bold text-neutral-500">
                    {t.reviewCount} reviews
                  </span>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`WhatsApp ${t.displayName}`}
                    className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
                    style={{ backgroundColor: "#166534" }}
                  >
                    <MessageCircle size={10} strokeWidth={2.5}/>
                    Message
                  </a>
                </div>
              </div>
              <div
                className="h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-xl shadow-sm sm:h-20 sm:w-20"
                style={{
                  backgroundImage: `url('${t.imageUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: "#F3F4F6"
                }}
                aria-hidden
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ReviewsList({ reviews }: { reviews: DemoReview[] }) {
  if (reviews.length === 0) return <EmptyRow label="No reviews yet"/>;
  return (
    <ul className="flex flex-col gap-2">
      {reviews.map((r) => {
        const posted = new Date(r.createdAt);
        const daysAgo = Math.max(1, Math.floor((Date.now() - posted.getTime()) / (24 * 60 * 60 * 1000)));
        const timeLabel = daysAgo < 7
          ? `${daysAgo}d ago`
          : daysAgo < 30
            ? `${Math.floor(daysAgo / 7)}w ago`
            : `${Math.floor(daysAgo / 30)}mo ago`;
        const initials = r.reviewerName
          .split(" ")
          .map((s) => s[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        return (
          <li key={r.id}>
            <div
              className="flex items-center gap-3 rounded-xl border bg-white p-2 shadow-sm transition"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-neutral-500">
                  {r.jobType} · {r.reviewerCity}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-black shadow-sm"
                    style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                  >
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={9}
                        fill="currentColor"
                        strokeWidth={0}
                        style={{ color: i < r.rating ? "#0A0A0A" : "rgba(10,10,10,0.25)" }}
                      />
                    ))}
                  </span>
                  <span className="text-[10.5px] font-black text-neutral-900">
                    {r.reviewerName}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-neutral-700">
                  {r.body}
                </p>
                <div className="mt-1 text-[9.5px] font-bold text-neutral-500">
                  {timeLabel}
                </div>
              </div>
              {r.photoUrl || r.avatarUrl ? (
                <div
                  className="h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-xl shadow-sm sm:h-20 sm:w-20"
                  style={{
                    backgroundImage: `url('${r.photoUrl ?? r.avatarUrl}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundColor: "#F3F4F6"
                  }}
                  aria-hidden
                />
              ) : (
                <div
                  className="flex h-[68px] w-[68px] flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-[16px] font-black text-white shadow-sm sm:h-20 sm:w-20"
                  style={{ backgroundColor: BRAND_BLACK }}
                  aria-hidden
                >
                  {initials}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FormField({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[9.5px] font-black uppercase tracking-[0.14em] text-neutral-600">
        {label}{required && <span style={{ color: TAN }}> *</span>}
      </span>
      {children}
    </label>
  );
}
