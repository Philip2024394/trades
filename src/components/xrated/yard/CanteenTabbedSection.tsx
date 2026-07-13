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
import type { CanteenProduct, CanteenDesign } from "@/lib/canteens";
import type { RotatorPost } from "@/components/xrated/yard/CanteenMobilePostsRotator";
import { competitorSlugsFor, tradeLabel as lookupTradeLabel } from "@/lib/tradeOff";
import { reviewsForMerchant, overallForReview } from "@/lib/reviews";

const TAN = "#B8860B";
const TAN_SOFT = "#F5E9D3";
const BRAND_BLACK = "#0A0A0A";

type TabSlug = "feed" | "products" | "jobs" | "contact" | "trades" | "reviews" | "designs";
const TABS: { slug: TabSlug; label: string }[] = [
  { slug: "feed",     label: "Feed" },
  { slug: "products", label: "Products" },
  { slug: "designs",  label: "Designs" },
  { slug: "jobs",     label: "Jobs" },
  { slug: "contact",  label: "Contact" },
  { slug: "trades",   label: "Trades" },
  { slug: "reviews",  label: "Reviews" }
];

// Demo designs — landscape image cards with header + text overlay. Real
// design data will land when the design gallery editor ships. Format
// matches what a kitchen supplier would populate: a hero image, a
// short catchy name, a tagline, and full description for the popup.
type DemoDesign = {
  id: string;
  /** Design reference number — printed on card + modal so customers can
   *  quote "Ref DS-101" when they message the merchant. Makes the
   *  connection between "which design" and "who to contact" trivial. */
  ref: string;
  imageUrl: string;
  /** Optional extra angles / detail shots. Rendered as rounded-square
   *  thumbnails in the design modal; tap to swap the main image.
   *  Max 3 additional (4 total with the hero) so it stays a focused
   *  "here's my kitchen" story rather than a scrolling gallery. */
  galleryUrls?: string[];
  name: string;
  tagline: string;
  description: string;
  style: string;
};

const DEMO_DESIGNS: DemoDesign[] = [
  {
    id: "d1",
    ref: "DS-101",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2012_31_13%20PM.png",
    galleryUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2011_04_56%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_37_29%20PM.png"
    ],
    name: "Signature Handleless",
    tagline: "Bespoke to your space",
    description: "Full-height handleless doors with a soft-close mechanism, wrapped in a warm neutral palette. Quartz worktops with a matching upstand, integrated appliances, and hidden pantry storage. A design that reads calm and clean — every line intentional. Priced from £14,500 including install and 10-year cabinet warranty.",
    style: "Modern Handleless"
  },
  {
    id: "d2",
    ref: "DS-102",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_52_07%20PM.png",
    galleryUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_49_21%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_46_41%20PM.png"
    ],
    name: "Statement Island",
    tagline: "Built around the family",
    description: "A wide central island in a bold contrast tone — quartz surface, integrated wine cooler, breakfast bar seating for four. Perfect for open-plan family homes where the kitchen is the social hub. Pairs with either shaker or slab door styles. From £18,900 fitted, typically installed in 3-4 weeks.",
    style: "Family Kitchen"
  },
  {
    id: "d3",
    ref: "DS-103",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_49_21%20PM.png",
    name: "Contemporary Two-Tone",
    tagline: "Bold and balanced",
    description: "A two-tone finish — deep base units contrasted against light wall cabinets. Brushed brass accents on handles and taps. Mitred-edge worktops for a premium seamless look. Best in kitchens over 4m wide where the contrast can breathe. From £16,200 supplied and fitted.",
    style: "Two-Tone Modern"
  },
  {
    id: "d4",
    ref: "DS-104",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_46_41%20PM.png",
    name: "Classic In-Frame",
    tagline: "Craftsmanship, no compromise",
    description: "In-frame painted doors with beaded detailing — the mark of a joiner-built kitchen. Solid oak worktops, Belfast sink, and a shaker dresser end. Built to last 30 years without a wobble. Ideal for period properties and Victorian terraces. From £22,400 including hand-finish paint job.",
    style: "Traditional"
  },
  {
    id: "d5",
    ref: "DS-105",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_37_29%20PM.png",
    name: "Compact Galley",
    tagline: "Small footprint, full function",
    description: "A galley layout designed for narrow terraces and flat conversions — every inch working hard. Corner pull-outs, integrated bin, tall pantry unit. Handleless doors keep the space feeling open. Works from 2.4m upwards. From £9,800 including appliances and install.",
    style: "Compact"
  },
  {
    id: "d6",
    ref: "DS-106",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_32_24%20PM.png",
    name: "Open-Plan Showstopper",
    tagline: "Design-led, entertain-ready",
    description: "A statement piece for open-plan spaces — long island, waterfall worktop, floor-to-ceiling larder tower. Integrated seating and hidden charging points. Colour and finish tailored to your home during the design consultation. From £26,500, install in 4-5 weeks.",
    style: "Luxury Open-Plan"
  }
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
  designs = [],
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
  /** DB-backed merchant designs. When empty, the tab falls back to the
   *  hardcoded DEMO_DESIGNS so a fresh merchant's page reads full during
   *  onboarding. The moment their first real design lands in the DB,
   *  real data takes over — no code change needed. */
  designs?: CanteenDesign[];
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
  // Design quick-view — when set the Designs tab renders a popup modal
  // overlay showing the full design image + description + details.
  const [viewingDesignId, setViewingDesignId] = useState<string | null>(null);
  // Per-tab expanded state so switching tabs doesn't leak the "see
  // all" state across sections.
  const [expanded, setExpanded] = useState<Record<TabSlug, boolean>>({
    feed:     false,
    products: false,
    jobs:     false,
    contact:  false,
    trades:   false,
    reviews:  false,
    designs:  false
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
    if (initial === "products" || initial === "jobs" || initial === "feed" || initial === "contact" || initial === "trades" || initial === "reviews" || initial === "designs") {
      setActiveTab(initial as TabSlug);
    }
    function handleSetTab(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const t = detail.tab;
      if (t === "products" || t === "jobs" || t === "feed" || t === "contact" || t === "trades" || t === "reviews" || t === "designs") {
        setActiveTab(t);
      }
    }
    function handleHashChange() {
      const h = window.location.hash.replace(/^#tab-/, "");
      if (h === "products" || h === "jobs" || h === "feed" || h === "contact" || h === "trades" || h === "reviews" || h === "designs") {
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

  // Designs — real DB rows when the merchant has published any,
  // otherwise the hardcoded DEMO_DESIGNS fallback so the surface reads
  // full during onboarding. The moment merchant adds their first real
  // design, real data takes over — no code change required.
  const activeDesigns = useMemo<DemoDesign[]>(() => {
    if (!designs || designs.length === 0) return DEMO_DESIGNS;
    return designs.map((d) => ({
      id:          d.id,
      ref:         d.ref,
      imageUrl:    d.imageUrl,
      galleryUrls: d.galleryUrls,
      name:        d.name,
      tagline:     d.tagline ?? "",
      description: d.description ?? "",
      style:       d.style ?? ""
    }));
  }, [designs]);

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
    : activeTab === "designs" ? "Design Service"
    : "Contact";

  // Total items in the active list — powers the "N more" badge on
  // the See all button so users know how much is behind it.
  const totalForActive =
    activeTab === "feed" ? posts.length
    : activeTab === "products" ? products.length
    : activeTab === "jobs" ? jobs.length
    : activeTab === "trades" ? complementaryTrades.length
    : activeTab === "reviews" ? reviews.length
    : activeTab === "designs" ? activeDesigns.length
    : 0;
  const isContact = activeTab === "contact";
  const hiddenCount = Math.max(0, totalForActive - limit);
  const seeAllLabel = activeTab === "feed" ? "posts"
    : activeTab === "products" ? "products"
    : activeTab === "jobs" ? "jobs"
    : activeTab === "trades" ? "trades"
    : activeTab === "reviews" ? "reviews"
    : activeTab === "designs" ? "designs"
    : "";

  const viewingDesign = viewingDesignId
    ? activeDesigns.find((d) => d.id === viewingDesignId) ?? null
    : null;

  return (
    <>
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
          fair-standing brand mark for Thenetworkers. */}
      {activeTab === "trades" && (
        <p className="mb-2 text-[10.5px] leading-snug text-neutral-500">
          Trades listed to help you find a tradesperson in your area — <span className="font-black text-neutral-700">we don&apos;t verify any trade.</span> Always do your own checks.
        </p>
      )}
      {activeTab === "reviews" && (
        <p className="mb-2 text-[10.5px] leading-snug text-neutral-500">
          Reviews left by customers on Thenetworkers — <span className="font-black text-neutral-700">unverified.</span> Treat them as guidance, not proof.
        </p>
      )}
      {activeTab === "designs" && (
        <p className="mb-2 text-[11px] leading-snug text-neutral-500">
          Call us today for your kitchen vision. Quote the design <span className="font-black text-neutral-700">Ref</span> when you get in touch.
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
        {activeTab === "designs" && (
          <DesignsList
            designs={activeDesigns.slice(0, limit)}
            onOpen={(id) => setViewingDesignId(id)}
          />
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

    {/* Design popup modal — renders full image + description + details
        when a design card is tapped. Click backdrop or X to close. */}
    {viewingDesign && (
      <DesignModal
        design={viewingDesign}
        hostFirstName={hostFirstName}
        hostWhatsapp={hostWhatsapp}
        onClose={() => setViewingDesignId(null)}
      />
    )}
    </>
  );
}

// ─── Feed rows ─────────────────────────────────────────────

// Slow upward marquee for the Feed tab — posts float up continuously
// so the section reads as alive even when the tab is idle. Hovering
// (or long-pressing on touch) pauses the animation so the user can
// actually read what's on screen. Respects prefers-reduced-motion.
const FEED_MARQUEE_CSS = `
@keyframes canteen-feed-scroll-up {
  0%   { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
.canteen-feed-marquee {
  animation: canteen-feed-scroll-up 180s linear infinite;
  will-change: transform;
}
.canteen-feed-shell:hover .canteen-feed-marquee,
.canteen-feed-shell:active .canteen-feed-marquee {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .canteen-feed-marquee { animation: none; }
}
`;

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
  // Duplicate the list so the -50% keyframe loops seamlessly. Only
  // marquee when there are enough posts to justify it (>= 3) —
  // otherwise render static so the section doesn't look broken.
  const shouldMarquee = posts.length >= 3;
  const rows = shouldMarquee ? [...posts, ...posts] : posts;
  return (
    <>
      <style>{FEED_MARQUEE_CSS}</style>
      <div
        className={
          shouldMarquee
            ? "canteen-feed-shell relative overflow-hidden h-[min(60vh,520px)]"
            : ""
        }
        style={
          shouldMarquee
            ? {
                maskImage:
                  "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)"
              }
            : undefined
        }
      >
    <ul className={`flex flex-col gap-2 ${shouldMarquee ? "canteen-feed-marquee" : ""}`}>
      {rows.map((p, i) => {
        const thumb = p.imageUrl || DEMO_THUMBS[
          (p.authorSlug.charCodeAt(0) + i) % DEMO_THUMBS.length
        ];
        return (
          <li key={`${p.id}-${i}`}>
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
      </div>
    </>
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
        `Hi ${hostFirstName}, I'm interested in "${product.name}" on Thenetworkers. Can you tell me more?`
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

      {/* Hero + thumb gallery — shared ImageGallery renders main
          image sharp (object-contain) + up to 3 additional shots
          from galleryUrls. Bulk-buy chip overlays on the main image. */}
      <div className="overflow-hidden rounded-xl">
        <ImageGallery
          images={[product.imageUrl, ...(product.galleryUrls ?? [])]}
          altBase={product.name}
          overlay={
            product.bulkBuy ? (
              <span
                className="absolute left-2 top-2 rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-md"
                style={{ backgroundColor: "#166534" }}
              >
                Bulk · {product.bulkBuy.committedCount}/{product.bulkBuy.targetCount}
              </span>
            ) : null
          }
        />
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
              `Hi ${hostFirstName}, I saw one of your jobs on Thenetworkers — I'd like to book similar ${tradeLabel.toLowerCase()} work.`
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

// ─── ImageGallery (shared by DesignModal + ProductQuickView) ──────
//
// Renders a main <img> (object-contain, sharp) with an optional row of
// rounded-square thumbnails below. Tap a thumb to swap the main image.
// Hidden entirely when there's only one image so single-image entries
// don't get an awkward one-thumb row.
//
// Design principle: max 4 total (1 hero + up to 3 additional). Beyond
// that a full gallery UI is warranted — this is meant to tell a focused
// "here's my kitchen" or "here's my product" story, not paginate.

function ImageGallery({
  images,
  altBase,
  overlay
}: {
  /** [hero, ...additional]. First image is the initial main. */
  images: string[];
  /** Alt-text prefix — the position index is appended per image. */
  altBase: string;
  /** Absolute-positioned overlays to render on top of the main image
   *  (chips, badges, etc). Renders inside the main-image container. */
  overlay?: React.ReactNode;
}) {
  const clean = images.filter((s) => s && s.trim().length > 0);
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => { setActiveIndex(0); }, [images]);
  if (clean.length === 0) return null;
  const active = clean[Math.min(activeIndex, clean.length - 1)];
  const showThumbs = clean.length > 1;

  return (
    <div className="w-full">
      {/* Main image — real <img> with object-contain so the full
          composition shows sharp, no CSS-scaled blur, no crop. */}
      <div className="relative w-full bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active}
          alt={`${altBase} — image ${activeIndex + 1} of ${clean.length}`}
          className="block h-auto max-h-[60vh] w-full object-contain"
          loading="eager"
          decoding="async"
        />
        {overlay}
        {showThumbs && (
          <span
            className="absolute left-3 bottom-3 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-black tracking-wider text-white backdrop-blur"
          >
            {activeIndex + 1} / {clean.length}
          </span>
        )}
      </div>

      {/* Thumb row — hidden if there's only one image. Rounded-square
          (rectangles that read as "kitchen angles", not round chips
          which read as products). */}
      {showThumbs && (
        <div className="mt-2 flex items-center gap-2 px-1">
          {clean.slice(0, 4).map((src, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`Show image ${i + 1} of ${clean.length}`}
                className={`relative block h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg transition ${
                  isActive ? "" : "opacity-70 hover:opacity-100"
                }`}
                style={{
                  boxShadow: isActive
                    ? "0 0 0 2px #FFB300"
                    : "0 0 0 1px rgba(139,69,19,0.15)"
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  aria-hidden
                  className="block h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            );
          })}
        </div>
      )}
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
    lines.push(`Hi ${hostFirstName}, enquiry from Thenetworkers:`);
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
      const subject = `Enquiry from ${name || "Thenetworkers"} · ${tradeLabel}`;
      window.location.href = `mailto:hello@thenetworkers.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
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
          `Hi ${t.displayName.split(" ")[0]}, I found you on Thenetworkers — I'd like to get in touch about ${label.toLowerCase()}.`
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

// Reviews marquee — same slow upward scroll pattern as the Feed tab.
// Keyframe named separately so both lists animate independently.
const REVIEWS_MARQUEE_CSS = `
@keyframes canteen-reviews-scroll-up {
  0%   { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
.canteen-reviews-marquee {
  animation: canteen-reviews-scroll-up 210s linear infinite;
  will-change: transform;
}
.canteen-reviews-shell:hover .canteen-reviews-marquee,
.canteen-reviews-shell:active .canteen-reviews-marquee {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .canteen-reviews-marquee { animation: none; }
}
`;

function ReviewsList({ reviews }: { reviews: DemoReview[] }) {
  if (reviews.length === 0) return <EmptyRow label="No reviews yet"/>;
  const shouldMarquee = reviews.length >= 3;
  const rows = shouldMarquee ? [...reviews, ...reviews] : reviews;
  return (
    <>
      <style>{REVIEWS_MARQUEE_CSS}</style>
      <div
        className={
          shouldMarquee
            ? "canteen-reviews-shell relative overflow-hidden h-[min(60vh,520px)]"
            : ""
        }
        style={
          shouldMarquee
            ? {
                maskImage:
                  "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)"
              }
            : undefined
        }
      >
    <ul className={`flex flex-col gap-2 ${shouldMarquee ? "canteen-reviews-marquee" : ""}`}>
      {rows.map((r, i) => {
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
          <li key={`${r.id}-${i}`}>
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
      </div>
    </>
  );
}

function DesignsList({
  designs,
  onOpen
}: {
  designs: DemoDesign[];
  onOpen: (id: string) => void;
}) {
  if (designs.length === 0) return <EmptyRow label="No designs yet"/>;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {designs.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => onOpen(d.id)}
            aria-label={`View ${d.name} design`}
            className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
            style={{
              borderColor: "rgba(139,69,19,0.15)",
              backgroundImage: `url('${d.imageUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundColor: "#F3F4F6"
            }}
          >
            {/* Bottom-up gradient for text legibility */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-3/5"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.85) 15%, rgba(0,0,0,0.30) 60%, transparent 100%)"
              }}
            />
            {/* Style chip top-left */}
            <span
              className="absolute left-2 top-2 rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-md"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
            >
              {d.style}
            </span>
            {/* Ref badge top-right — customers quote this when they
                message the merchant. Dark chip for high contrast on
                the light-image top corner. */}
            <span
              className="absolute right-2 top-2 rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-md"
              style={{ backgroundColor: "rgba(10,10,10,0.85)", backdropFilter: "blur(4px)" }}
            >
              Ref {d.ref}
            </span>
            {/* Header + tagline overlay */}
            <div className="absolute inset-x-0 bottom-0 p-2.5 text-left">
              <div className="text-[13px] font-black leading-tight text-white drop-shadow-md">
                {d.name}
              </div>
              <div className="mt-0.5 text-[10.5px] font-bold text-white/85 drop-shadow-sm">
                {d.tagline}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DesignModal({
  design,
  hostFirstName,
  hostWhatsapp,
  onClose
}: {
  design: DemoDesign;
  hostFirstName: string;
  hostWhatsapp: string | null;
  onClose: () => void;
}) {
  // Pre-filled WhatsApp deep link that includes the design ref so the
  // merchant instantly knows which kitchen the customer is asking about.
  const waUrl = hostWhatsapp
    ? `https://wa.me/${hostWhatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hi ${hostFirstName}, I'm interested in the ${design.name} kitchen design (Ref ${design.ref}). Can you tell me more?`
      )}`
    : null;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label={`${design.name} design details`}
      className="fixed inset-0 z-[100] flex items-center justify-center px-3 py-6"
      style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "calc(100vh - 3rem)" }}
      >
        {/* Close — yellow chip so it reads as a positive dismiss action
            rather than a warning. Sits on the top-right corner of the
            entire modal (not the hero). */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full shadow-md transition active:scale-[0.95]"
          style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
        >
          <X size={16} strokeWidth={2.8}/>
        </button>

        {/* Hero + thumb gallery — shared ImageGallery renders main
            image sharp (object-contain) + optional 3 additional angles
            below. Chips overlay on the main image. */}
        <ImageGallery
          images={[design.imageUrl, ...(design.galleryUrls ?? [])]}
          altBase={`${design.name} kitchen design`}
          overlay={
            <>
              <span
                className="absolute left-3 top-3 rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-md"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                {design.style}
              </span>
              <span
                className="absolute right-3 bottom-3 rounded-sm px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md"
                style={{ backgroundColor: "rgba(10,10,10,0.85)", backdropFilter: "blur(4px)" }}
              >
                Ref {design.ref}
              </span>
            </>
          }
        />

        {/* Details */}
        <div className="overflow-y-auto p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[9px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Kitchen Design · Ref {design.ref}
            </div>
          </div>
          <h2 className="mt-0.5 text-[18px] font-black leading-tight text-neutral-900 md:text-[20px]">
            {design.name}
          </h2>
          <p className="mt-1 text-[12px] font-bold text-neutral-600 md:text-[13px]">
            {design.tagline}
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-neutral-700 md:text-[13px]">
            {design.description}
          </p>
          <p className="mt-3 rounded-lg border p-2.5 text-[11px] leading-relaxed text-neutral-700 md:text-[12px]"
             style={{ borderColor: "rgba(184,134,11,0.20)", backgroundColor: "#FBF6EC" }}>
            <span className="font-black text-neutral-900">Quote Ref {design.ref}</span> when you enquire — we&apos;ll pull the design straight up and can price it for your space.
          </p>

          {/* Enquire Now — dark green WhatsApp pill, pre-filled with the
              design ref so the merchant knows exactly which kitchen the
              customer means. Falls back to a disabled placeholder when
              the merchant hasn't published a WhatsApp number. */}
          <div className="mt-4">
            {waUrl ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-[13px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.98]"
                style={{ backgroundColor: "#166534" }}
              >
                <MessageCircle size={14} strokeWidth={2.6}/>
                Enquire Now
              </a>
            ) : (
              <span
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full border text-[13px] font-black uppercase tracking-wider text-neutral-500"
                style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#F9FAFB" }}
              >
                <MessageCircle size={14} strokeWidth={2.4}/>
                Contact details coming soon
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
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
