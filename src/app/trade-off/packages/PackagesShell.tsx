"use client";

// Packages page — 4-tier model (Free / Canteen / Marketplace / Ultimate)
// with per-tier detail containers below. Design language: cream page bg
// (#FBF6EC — brand standard), white cards with tan hairline borders,
// yellow for chips only, dark green for CTAs. No Sparkles / Star icons
// as tier markers (per Philip: "the ai star icon is crap"). Mobile-first.

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  Check,
  Home,
  ShoppingBag,
  ShieldCheck,
  MessageCircle,
  ArrowRight,
  TrendingUp,
  Layers,
  Clock,
  Radio,
  Truck,
  Star,
  ChevronDown,
  ClipboardList,
  BookOpen,
  Users
} from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

const CREAM = "#FBF6EC";
const TAN = "#B8860B";
const TAN_HAIRLINE = "rgba(184,134,11,0.20)";
const TAN_SOFT_TINT = "rgba(184,134,11,0.06)";

// Slight pulsing glow behind the "Most popular" badge. Uses a
// pseudo-element outside the badge so the box-shadow can fade in/out
// smoothly without repainting the entire badge every frame.
const PACKAGES_CSS = `
@keyframes packages-badge-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(255,179,0,0.55), 0 2px 6px rgba(0,0,0,0.15);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(255,179,0,0), 0 2px 6px rgba(0,0,0,0.15);
  }
}
.packages-badge-glow {
  animation: packages-badge-pulse 2.4s ease-in-out infinite;
  will-change: box-shadow;
}
@media (prefers-reduced-motion: reduce) {
  .packages-badge-glow { animation: none; }
}

/* Native details/summary open-close chevron via CSS only. */
.packages-faq details > summary { list-style: none; cursor: pointer; }
.packages-faq details > summary::-webkit-details-marker { display: none; }
.packages-faq details[open] > summary .packages-chevron { transform: rotate(180deg); }
.packages-faq details > summary .packages-chevron { transition: transform 200ms ease; }
`;

type BillingCycle = "monthly" | "annual";

// ─── Pricing model ─────────────────────────────────────────

// Pricing rebalanced 2026-07-13 to clear post-data operating buffer:
//   Canteen     >= £5/mo clear  (community CS)
//   Marketplace >= £8/mo clear  (standard WhatsApp CS)
//   Ultimate    >= £10/mo clear (priority WhatsApp CS + video + AI)
// Verified against Stripe + Supabase egress + storage at typical-heavy
// usage. Viral bandwidth outliers protected by fair-use policy.
const PRICES = {
  canteen:     { monthly: 7.99,  annual: 72,   annualSaving: 7.99 * 12 - 72 },
  marketplace: { monthly: 11.99, annual: 120,  annualSaving: 11.99 * 12 - 120 },
  ultimate:    { monthly: 15.99, annual: 175,  annualSaving: 15.99 * 12 - 175 }
};

function priceOf(tier: "canteen" | "marketplace" | "ultimate", billing: BillingCycle): number {
  const p = PRICES[tier];
  return billing === "annual" ? p.annual / 12 : p.monthly;
}

// ─── Tier definitions ─────────────────────────────────────

type TierId = "free" | "canteen" | "marketplace" | "ultimate";

type FeatureGroup = { label: string; items: string[] };

type Tier = {
  id: TierId;
  /** Number of yellow stars shown beside the tier name — Free=1, up
   *  to The Works=4. Ladder progression at a glance. */
  stars: 1 | 2 | 3 | 4;
  /** Hero image rendered at the top of the pricing card. Provided by
   *  Philip, one per tier, aspect ~4:3. Falls back to a subtle
   *  brand-gradient placeholder if omitted. */
  heroImage?: string;
  name: string;
  positioning: string;
  audience: string;
  badge?: string;
  ctaLabel: string;
  ctaHref: string;
  groups: FeatureGroup[];
};

const TIERS: Tier[] = [
  {
    id: "free",
    stars: 1,
    heroImage: "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsvvvvffsdsddsdsdsd.png",
    name: "Free",
    positioning: "Start moving",
    audience: "Homeowners + browsing merchants",
    ctaLabel: "Get started free",
    ctaHref: "/trade-off/signup",
    groups: [
      {
        label: "Your presence",
        items: [
          "Your own thenetworkers.app/{slug} URL — kept as long as you log in once every 30 days",
          "Basic profile page + business card modal",
          "QR share code",
          "30-day full Canteen trial (all features unlocked)"
        ]
      },
      {
        label: "Discovery & community",
        items: [
          "Browse The Yard + Live Listings feeds",
          "Browse Find Trades directory",
          "Buy freely from Trade Center Marketplace",
          "All 20+ material calculators"
        ]
      },
      {
        label: "Notebook OS (homeowner)",
        items: [
          "Personal Construction Notebook vault",
          "Property Vault records",
          "Submit projects to matched merchants",
          "Materials passport"
        ]
      }
    ]
  },
  {
    id: "canteen",
    stars: 2,
    heroImage: "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsvvvvffsdsddsd.png",
    name: "Canteen",
    positioning: "Step up. Get seen.",
    audience: "Service trades — kitchen fitters, sparks, plumbers",
    ctaLabel: "Start 14 day trial",
    ctaHref: "/trade-off/signup?plan=canteen",
    groups: [
      {
        label: "Everything Free +",
        items: [
          "Live canteen: Feed / Products / Designs / Reviews / Contact / Jobs",
          "Priority placement in Find Trades",
          "20 outbound network posts per month",
          "Reviews aggregation + moderation queue",
          "Slug reserved — kept for life while subscription is active"
        ]
      },
      {
        label: "Portfolio tools",
        items: [
          "Design portfolio with customer Ref codes",
          "Products with photo galleries",
          "Job Diary + Meet the team + FAQ page",
          "Business card + QR handoff"
        ]
      },
      {
        label: "Reach & signals",
        items: [
          "Follow / Follow button",
          "Notifications inbox",
          "Trade Connections cross-referrals",
          "Lead alerts on Notebook project matches"
        ]
      }
    ]
  },
  {
    id: "marketplace",
    stars: 3,
    heroImage: "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsvvvvffsdsddsdsdsddd.png",
    // User-facing name is "Trade Center" (Philip 2026-07-16 — the
    // £11.99/mo tier that unlocks Trade Center features). The
    // internal id stays "marketplace" for now to avoid churning
    // signup URLs, Stripe products, DB rows, and feature gates —
    // a coordinated id rename is a separate pass.
    name: "Trade Center",
    positioning: "Load up. Get selling.",
    audience: "Product sellers — timber merchants, quartz, tools, kitchens",
    ctaLabel: "Start selling",
    ctaHref: "/trade-off/signup?plan=marketplace",
    groups: [
      {
        label: "Everything Canteen +",
        items: [
          "Trade Center listings — products, parts, services",
          "Stripe / PayPal / Coinbase payouts (direct to your bank)",
          "Cart + checkout on your listings",
          "Slug reserved — kept for life while subscription is active"
        ]
      },
      {
        label: "Trade selling",
        items: [
          "Bulk-buy campaigns + tiered pricing",
          "Wholesale mode (trade-only rates)",
          "Trade Center Picks curation",
          "Orders management dashboard"
        ]
      },
      {
        label: "Product info blocks",
        items: [
          "In-the-box + pairs-with + warranty",
          "Product Q&A section",
          "Product comparison"
        ]
      },
      {
        label: "Opt-in modules",
        items: [
          "Plant Hire (machines / delivery zones / haulage)",
          "Key Cutting (postal form)",
          "Materials Network access",
          "Newsletter opt-in capture"
        ]
      }
    ]
  },
  {
    // Internal id kept as "ultimate" for URL / migration stability.
    // Display name changed to "The Works" per Philip 2026-07-13 —
    // trades-native ("give me the works"), not corporate.
    id: "ultimate",
    stars: 4,
    heroImage: "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsvvvvffsdsd.png",
    name: "The Works",
    positioning: "All terrain. Everything unlocked.",
    audience: "Hybrid merchants — sell products AND run service",
    badge: "Most popular",
    ctaLabel: "Get The Works",
    ctaHref: "/trade-off/signup?plan=ultimate",
    groups: [
      {
        label: "Everything Marketplace +",
        items: [
          "Verified badge on every listing + Find Trades",
          "Auto-syndication — every canteen update to Yard + Live Listings",
          "Slug reserved for life (never lose your URL)"
        ]
      },
      {
        label: "Video",
        items: [
          "Hero video on your canteen",
          "Product-detail videos (autoplay muted)",
          "Video posts across Yard + Live Listings",
          "Hosted on our CDN, no third-party account",
          "60 GB/mo bandwidth included (£1 per +25 GB above)"
        ]
      },
      {
        label: "AI tools",
        items: [
          "AI Visualiser — kitchen / room mockups from photos",
          "Business Coach AI advisor",
          "Automated project matching alerts"
        ]
      },
      {
        label: "Business ops",
        items: [
          "CRM + Quote Workspace",
          "Insights + Analytics dashboards",
          "Custom domain (bring your own .com)",
          "Team management (up to 5 staff)"
        ]
      },
      {
        label: "Support",
        items: [
          "Priority WhatsApp support (4-hour reply)",
          "Direct line to product for feedback"
        ]
      }
    ]
  }
];

// ─── Comparison matrix rows ────────────────────────────────

type MatrixSection = {
  label: string;
  rows: { feature: string; free: string | boolean; canteen: string | boolean; marketplace: string | boolean; ultimate: string | boolean }[];
};

const COMPARISON: MatrixSection[] = [
  {
    label: "Discovery & community",
    rows: [
      { feature: "Your thenetworkers.app URL", free: true, canteen: true, marketplace: true, ultimate: true },
      { feature: "Browse Yard + Live Listings + Find Trades", free: true, canteen: true, marketplace: true, ultimate: true },
      { feature: "Priority placement in Find Trades", free: false, canteen: true, marketplace: true, ultimate: true },
      { feature: "Trade Connections cross-referrals", free: false, canteen: true, marketplace: true, ultimate: true },
      { feature: "Auto-syndicate updates to Yard + Live Listings", free: false, canteen: false, marketplace: false, ultimate: true }
    ]
  },
  {
    label: "Your page (Canteen)",
    rows: [
      { feature: "Live canteen (Feed / Products / Reviews / etc)", free: "30-day trial", canteen: true, marketplace: true, ultimate: true },
      { feature: "Design portfolio with customer Refs", free: false, canteen: true, marketplace: true, ultimate: true },
      { feature: "Products with photo galleries", free: false, canteen: true, marketplace: true, ultimate: true },
      { feature: "Job Diary + Meet the team + FAQ", free: false, canteen: true, marketplace: true, ultimate: true },
      { feature: "Business card + QR handoff", free: true, canteen: true, marketplace: true, ultimate: true },
      { feature: "20 outbound network posts / month", free: false, canteen: true, marketplace: true, ultimate: true }
    ]
  },
  {
    label: "Selling (Trade Center Marketplace)",
    rows: [
      { feature: "Trade Center product/parts/service listings", free: false, canteen: false, marketplace: true, ultimate: true },
      { feature: "Stripe / PayPal / Coinbase payouts", free: false, canteen: false, marketplace: true, ultimate: true },
      { feature: "Cart + checkout", free: false, canteen: false, marketplace: true, ultimate: true },
      { feature: "Bulk-buy + Wholesale mode", free: false, canteen: false, marketplace: true, ultimate: true },
      { feature: "Orders management dashboard", free: false, canteen: false, marketplace: true, ultimate: true },
      { feature: "Plant Hire module", free: false, canteen: false, marketplace: true, ultimate: true },
      { feature: "Key Cutting module", free: false, canteen: false, marketplace: true, ultimate: true },
      { feature: "Materials Network access", free: false, canteen: false, marketplace: true, ultimate: true }
    ]
  },
  {
    label: "Reputation & Trust",
    rows: [
      { feature: "Reviews aggregation + Bayesian rating", free: false, canteen: true, marketplace: true, ultimate: true },
      { feature: "Verified badge on every listing", free: false, canteen: false, marketplace: false, ultimate: true },
      { feature: "Slug reserved for life", free: false, canteen: false, marketplace: false, ultimate: true }
    ]
  },
  {
    label: "Media & Video",
    rows: [
      { feature: "Hero video on your canteen", free: false, canteen: false, marketplace: false, ultimate: true },
      { feature: "Product-detail videos", free: false, canteen: false, marketplace: false, ultimate: true },
      { feature: "Video posts to feeds", free: false, canteen: false, marketplace: false, ultimate: true }
    ]
  },
  {
    label: "AI tools",
    rows: [
      { feature: "AI Visualiser (kitchen / room mockups)", free: false, canteen: false, marketplace: false, ultimate: true },
      { feature: "Business Coach AI advisor", free: false, canteen: false, marketplace: false, ultimate: true }
    ]
  },
  {
    label: "Business operations",
    rows: [
      { feature: "CRM + Quote Workspace", free: false, canteen: false, marketplace: false, ultimate: true },
      { feature: "Insights + Analytics dashboards", free: false, canteen: false, marketplace: false, ultimate: true },
      { feature: "Custom domain (your own .com)", free: false, canteen: false, marketplace: false, ultimate: true },
      { feature: "Team management (up to 5 staff)", free: false, canteen: false, marketplace: false, ultimate: true }
    ]
  },
  {
    label: "Notebook OS (homeowner)",
    rows: [
      { feature: "Personal Construction Notebook", free: true, canteen: true, marketplace: true, ultimate: true },
      { feature: "Property Vault records", free: true, canteen: true, marketplace: true, ultimate: true },
      { feature: "Submit projects to matched merchants", free: true, canteen: true, marketplace: true, ultimate: true },
      { feature: "Receive lead alerts on project matches", free: false, canteen: true, marketplace: true, ultimate: true }
    ]
  },
  {
    label: "Support",
    rows: [
      { feature: "Standard WhatsApp support", free: true, canteen: true, marketplace: true, ultimate: true },
      { feature: "Priority WhatsApp support (4-hour reply)", free: false, canteen: false, marketplace: false, ultimate: true }
    ]
  }
];

// ─── Feature cards data ────────────────────────────────────

type FeatureCardData = {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;
  title: string;
  description: string;
  tierBadge: string;
  demoHref: string;
};

// Feature cards grouped by intent: Traffic side first (where the
// customers come from), then Merchant side (what you show them), then
// Extensibility (how you make it yours). Merchants read top-down and
// understand the whole platform loop, not just the surfaces they'll
// build on.

type FeatureGroupCards = { label: string; blurb: string; cards: FeatureCardData[] };

const FEATURE_GROUPS: FeatureGroupCards[] = [
  {
    label: "Where the customers come from",
    blurb: "The demand side. Traffic engines that put your listing in front of a real buyer.",
    cards: [
      {
        icon: ClipboardList,
        title: "Submit Project",
        description: "Homeowner posts their project on their private Notebook. Matched trades in the postcode get an alert. You reply on WhatsApp — no lead fee, no bidding, no cut.",
        tierBadge: "All tiers",
        demoHref: "/trade-off/notebook"
      },
      {
        icon: BookOpen,
        title: "Construction Notebook",
        description: "Every homeowner gets a personal vault — quotes, photos, warranties, invoices — all tied to their property forever. That's why they come back and hire you again.",
        tierBadge: "All tiers",
        demoHref: "/trade-off/notebook"
      },
      {
        icon: Users,
        title: "The Yard",
        description: "Active community feed where UK trades share jobs, tools, tips and shortcuts. You're not alone here — the yard has your back when a quote goes sideways.",
        tierBadge: "All tiers",
        demoHref: "/trade-off/yard"
      }
    ]
  },
  {
    label: "What you show them",
    blurb: "The supply side. Your live canteen page and the tools inside it.",
    cards: [
      {
        icon: Home,
        title: "Live canteen feed",
        description: "Trade posts scroll up slowly, all day. Pause on hover. Members reply in one tap. Feels like a WhatsApp group that lives on your website.",
        tierBadge: "Canteen +",
        demoHref: "/trade-off/yard/canteens/uk-kitchen-fitters#tab-feed"
      },
      {
        icon: Layers,
        title: "Design portfolio with Refs",
        description: "Every design has a Ref (DS-101, DS-102) that customers quote when they message. Photo gallery per design.",
        tierBadge: "Canteen +",
        demoHref: "/trade-off/yard/canteens/uk-kitchen-fitters#tab-designs"
      },
      {
        icon: ShoppingBag,
        title: "Products with galleries",
        description: "Hero image plus up to 5 thumbnails. Prices, blurb, WhatsApp button. Customers see enough to enquire with intent.",
        tierBadge: "Canteen +",
        demoHref: "/trade-off/yard/canteens/uk-kitchen-fitters#tab-products"
      },
      {
        icon: TrendingUp,
        title: "Priority in Find Trades",
        description: "Pro-tier merchants sit at the top of the directory. Customers browsing for your trade see you before free-tier listings.",
        tierBadge: "Canteen +",
        demoHref: "/trade-off/find-trades?fromTrade=kitchen-fitter"
      },
      {
        icon: Truck,
        title: "Trade Center Marketplace",
        description: "Sell products, parts and services. Cart + Stripe payouts direct to your bank. Bulk-buy, Wholesale, Plant Hire, Key Cutting modules.",
        tierBadge: "Marketplace +",
        demoHref: "/trade-off/trade-center"
      },
      {
        icon: ShieldCheck,
        title: "Verified badge + slug for life",
        description: "Verified mark on every listing and every Find Trades result. Your slug reserved for life, no-one can claim it even if you cancel.",
        tierBadge: "The Works",
        demoHref: "/trade-off/verified"
      }
    ]
  },
  // App Warehouse group pulled 2026-07-13 per Philip — needs a proper
  // canteen-side work area designed before we advertise it. Keep in
  // the codebase; re-add when the Studio install/manage flow lands.
];

// Flattened for anywhere that still expects a plain array.
const FEATURES: FeatureCardData[] = FEATURE_GROUPS.flatMap((g) => g.cards);

// ─── FAQ ──────────────────────────────────────────────────
//
// Every question we hear pre-purchase, grouped. Answers are honest
// and match the current build (30-day slug, Companies House optional,
// no lead-selling, Stripe direct-to-bank, etc). Update as policies
// change so merchants never get a stale answer.

const FAQ_GROUPS: { label: string; questions: { q: string; a: React.ReactNode }[] }[] = [
  {
    label: "Trial & payment",
    questions: [
      {
        q: "Do I need to enter a card for the 14-day trial?",
        a: "No. Start on Free with no card. The 30-day full Canteen trial fires automatically the day you sign up. When it ends, your canteen features lock but your URL and account stay live — nothing goes away without you choosing it."
      },
      {
        q: "What happens when my trial ends?",
        a: "Canteen features (feed, products, designs, reviews) lock, but everything else stays. You can still log in, browse The Yard, submit to Notebook, and use your business card. Upgrade to any paid tier and everything unlocks instantly."
      },
      {
        q: "Do you take a cut on Marketplace sales?",
        a: "Never. Funds go direct from customer to your bank via Stripe Connect, PayPal, or Coinbase. We're not the counterparty. You keep 100% of every sale. That's the whole point of the platform."
      },
      {
        q: "How much are Stripe fees?",
        a: "Stripe's UK card fees are 1.5% + 20p per successful charge. We don't add anything on top. Annual subscribers pay less in fees per year than monthly ones (fewer transactions)."
      }
    ]
  },
  {
    label: "What's included",
    questions: [
      {
        q: "What's the actual difference between Canteen and Marketplace?",
        a: (
          <>
            <strong>Canteen</strong> is your live website + reputation surface — feed, products showcase, designs portfolio, reviews, contact form. Perfect for service trades (kitchen fitters, sparks, plumbers).
            <br/><br/>
            <strong>Marketplace</strong> adds Trade Center selling on top — cart, checkout, Stripe payouts, orders management, Plant Hire, Key Cutting, Materials Network. Perfect for product sellers (timber merchants, quartz suppliers, tool retailers).
          </>
        )
      },
      {
        q: "Is video available on Canteen or Marketplace?",
        a: "No — video is The Works only. Hero video, product-detail videos, and video posts across your feeds. It's the biggest cost driver on our side (bandwidth), so it lives at the top tier where the pricing supports it."
      },
      {
        q: "What happens if I hit The Works' 60 GB/mo bandwidth cap?",
        a: "£1 per +25 GB above 60 GB. Fair use only kicks in if you go viral — normal traffic (a few thousand visitors/month) uses 10-30 GB. If you're consistently blowing through, we'll help you optimise before your bill grows."
      },
      {
        q: "Is Companies House verification required?",
        a: "No. If you type a business-name-like slug and we find a matching active UK company, we offer auto-verify as a bonus. You can also just verify manually later. Free tier merchants can't verify at all — Verified badge is Ultimate only."
      },
      {
        q: "How does project matching work? Are you selling leads?",
        a: "We never sell leads. When a homeowner submits a project through Notebook (their private vault), matched merchants get an alert. You choose which to reply to. No fee per lead, no bidding, no charge for a reply. It's yours to close."
      }
    ]
  },
  {
    label: "Cancel & control",
    questions: [
      {
        q: "Can I cancel any time?",
        a: "Yes. No contracts, no notice period. Cancel from your dashboard — your subscription stops at the end of the current billing period. Nothing auto-charges after that."
      },
      {
        q: "Do I keep my data if I cancel?",
        a: "Yes. Reviews, products, designs, photos, opening hours, WhatsApp number — all stay with you. Your account reverts to Free and everything paid-only locks (but doesn't delete). Re-subscribe any time and it all snaps back on."
      },
      {
        q: "Will I keep my URL?",
        a: "Paid tiers reserve your slug for life while your subscription is active. Free tier keeps the slug as long as you log in at least once every 30 days — otherwise it's released back to the pool. We email you at 15, 25 and 29 days before releasing."
      },
      {
        q: "Can I switch tiers later?",
        a: "Yes. Upgrade or downgrade any time from your dashboard. Upgrades take effect immediately with the price prorated. Downgrades take effect at the end of your current billing period."
      },
      {
        q: "What's your refund policy?",
        a: "First payment is 100% refundable within 14 days, no questions. After that, cancel any time for period-end — no partial refunds on active periods, but no further charges either."
      },
      {
        q: "Where does support come from?",
        a: "WhatsApp support during UK business hours. Canteen tier gets community/pooled response. Marketplace tier gets standard support (24-48h reply). The Works gets priority support (4-hour reply during business hours)."
      }
    ]
  }
];

// ─── Main component ───────────────────────────────────────

export function PackagesShell() {
  const [billing, setBilling] = useState<BillingCycle>("annual");

  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <style>{PACKAGES_CSS}</style>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-4 pt-14 sm:px-6 sm:pt-20">
        <div className="flex flex-col items-center text-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider shadow-sm"
            style={{ borderColor: TAN_HAIRLINE, backgroundColor: "#FFFFFF", color: TAN }}
          >
            <ShieldCheck size={12} strokeWidth={2.6}/>
            Simple pricing. Zero contracts.
          </span>
          <h1 className="mt-4 text-[32px] font-black leading-[1.05] tracking-tight text-neutral-900 sm:text-[42px] md:text-[52px]">
            Four packages. One clear ladder.
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-700 sm:text-[15px]">
            Free forever gives you your URL and browse-everything access. Canteen adds your live page. Marketplace unlocks Trade Center selling. The Works is everything, plus AI tools and video.
          </p>

        </div>

        {/* Billing toggle */}
        <div className="mt-8 flex justify-center">
          <div
            className="relative inline-flex items-center rounded-full border shadow-md"
            style={{ backgroundColor: "#FFFFFF", borderColor: TAN_HAIRLINE }}
          >
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`relative z-10 rounded-full px-5 py-2 text-[12px] font-black uppercase tracking-wider transition ${
                billing === "monthly" ? "text-neutral-900" : "text-neutral-500"
              }`}
              style={{
                backgroundColor: billing === "monthly" ? BRAND_YELLOW : "transparent"
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[12px] font-black uppercase tracking-wider transition ${
                billing === "annual" ? "text-neutral-900" : "text-neutral-500"
              }`}
              style={{
                backgroundColor: billing === "annual" ? BRAND_YELLOW : "transparent"
              }}
            >
              Annual
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px]"
                style={{
                  backgroundColor: billing === "annual" ? "#0A0A0A" : "#F3F4F6",
                  color: billing === "annual" ? BRAND_YELLOW : "#6B7280"
                }}
              >
                Save up to £24
              </span>
            </button>
          </div>
        </div>
        {billing === "annual" && (
          <p className="mt-2 text-center text-[11px] text-neutral-500">
            Annual = 2 months free on Canteen, Marketplace and The Works.
          </p>
        )}

        {/* Inline tier ladder — clickable jump links so visitors can
            skim the progression at a glance. Also mirrors Philip's
            vehicle metaphor: bike → motorbike → van → jeep. */}
        <nav
          aria-label="Package ladder"
          className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] font-black uppercase tracking-[0.16em] text-neutral-700"
        >
          <a href="#tier-free" className="hover:text-neutral-900">Free</a>
          <span aria-hidden style={{ color: TAN }}>—</span>
          <a href="#tier-canteen" className="hover:text-neutral-900">Canteen</a>
          <span aria-hidden style={{ color: TAN }}>—</span>
          <a href="#tier-marketplace" className="hover:text-neutral-900">Marketplace</a>
          <span aria-hidden style={{ color: TAN }}>—</span>
          <a href="#tier-ultimate" className="hover:text-neutral-900">Works</a>
        </nav>
      </section>

      {/* Pricing grid — 4 columns */}
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => (
            <PricingCard key={t.id} tier={t} billing={billing}/>
          ))}
        </div>
      </section>

      {/* Full comparison matrix */}
      <section id="compare" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6 text-center">
          <span className="inline-block text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Full comparison
          </span>
          <h2 className="mt-1 text-[24px] font-black leading-tight text-neutral-900 sm:text-[30px]">
            Every feature, every tier.
          </h2>
          <p className="mt-2 text-[13px] text-neutral-600">
            No hidden features. No sales calls. Everything you get, laid out.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border bg-white shadow-md" style={{ borderColor: TAN_HAIRLINE }}>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b" style={{ borderColor: TAN_HAIRLINE, backgroundColor: TAN_SOFT_TINT }}>
                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Feature</th>
                <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-wider text-neutral-500">Free</th>
                <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-wider text-neutral-900">Canteen</th>
                <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-wider text-neutral-900">Marketplace</th>
                <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-wider text-neutral-900">The Works</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((section) => (
                <Fragment key={section.label}>
                  <tr className="border-t" style={{ borderColor: TAN_HAIRLINE }}>
                    <td colSpan={5} className="px-4 py-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-500" style={{ backgroundColor: `${CREAM}` }}>
                      {section.label}
                    </td>
                  </tr>
                  {section.rows.map((row, i) => (
                    <tr key={`${section.label}-${i}`} className="border-t" style={{ borderColor: TAN_HAIRLINE }}>
                      <td className="px-4 py-2.5 text-neutral-800">{row.feature}</td>
                      <MatrixCell value={row.free}/>
                      <MatrixCell value={row.canteen}/>
                      <MatrixCell value={row.marketplace}/>
                      <MatrixCell value={row.ultimate}/>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* How it works — feature cards */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6 text-center">
          <span className="inline-block text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
            How it works
          </span>
          <h2 className="mt-1 text-[24px] font-black leading-tight text-neutral-900 sm:text-[30px]">
            Every feature. Live on a real merchant page.
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-[13px] text-neutral-600">
            Not screenshots. Not stock. Click any feature to see it working on Mike Watson&apos;s canteen.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {FEATURE_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-4 flex flex-col items-center text-center">
                <span className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: TAN }}>
                  {group.label}
                </span>
                <p className="mt-1 max-w-2xl text-[13px] text-neutral-600">
                  {group.blurb}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {group.cards.map((f) => (
                  <FeatureCard key={f.title} data={f}/>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Per-tier detail containers */}
      <section id="tier-detail" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6 text-center">
          <span className="inline-block text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Package detail
          </span>
          <h2 className="mt-1 text-[24px] font-black leading-tight text-neutral-900 sm:text-[30px]">
            What each package unlocks.
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-[13px] text-neutral-600">
            Screenshots landing shortly.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {TIERS.map((t) => (
            <TierDetailContainer key={t.id} tier={t} billing={billing}/>
          ))}
        </div>
      </section>

      {/* FAQ — collapsible, groups the most common pre-purchase
          questions so merchants don't have to leave the page to make
          a decision. Uses native details/summary — no client JS,
          zero layout jank, works with keyboard + screen reader. */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-6 text-center">
          <span className="inline-block text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
            FAQ
          </span>
          <h2 className="mt-1 text-[24px] font-black leading-tight text-neutral-900 sm:text-[30px]">
            Every question we get before signup.
          </h2>
        </div>

        <div className="packages-faq flex flex-col gap-6">
          {FAQ_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-2 px-1 text-[10.5px] font-black uppercase tracking-[0.18em] text-neutral-500">
                {group.label}
              </div>
              <ul className="flex flex-col gap-2">
                {group.questions.map((q) => (
                  <li key={q.q}>
                    <details
                      className="rounded-xl border bg-white shadow-sm"
                      style={{ borderColor: TAN_HAIRLINE }}
                    >
                      <summary className="flex items-center justify-between gap-3 p-4 text-[13px] font-black text-neutral-900 sm:text-[14px]">
                        <span>{q.q}</span>
                        <span
                          aria-hidden
                          className="packages-chevron flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${BRAND_YELLOW}22`, color: BRAND_BLACK }}
                        >
                          <ChevronDown size={13} strokeWidth={2.6}/>
                        </span>
                      </summary>
                      <div
                        className="border-t px-4 py-3 text-[12.5px] leading-relaxed text-neutral-700 sm:text-[13px]"
                        style={{ borderColor: TAN_HAIRLINE }}
                      >
                        {q.a}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Honest pricing — no competitor names, keeps the trust value
          without pushing traffic elsewhere. */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div
          className="flex flex-col items-center gap-2 rounded-2xl border p-6 text-center shadow-sm"
          style={{ borderColor: TAN_HAIRLINE, backgroundColor: TAN_SOFT_TINT }}
        >
          <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: TAN }}>
            <ShieldCheck size={12} strokeWidth={2.6}/>
            Honest pricing
          </div>
          <p className="max-w-2xl text-[13px] leading-relaxed text-neutral-800">
            No sales call. No hidden pricing. Every figure on this page is exactly what you pay. Cancel any time.
          </p>
        </div>
      </section>

      {/* Trust bar */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div
          className="flex flex-wrap items-center justify-around gap-6 rounded-2xl border p-6 shadow-sm"
          style={{ borderColor: TAN_HAIRLINE, backgroundColor: "#FFFFFF" }}
        >
          <div className="flex items-center gap-2 text-[12px] font-bold text-neutral-800">
            <ShieldCheck size={16} strokeWidth={2.5} style={{ color: BRAND_GREEN_DARK }}/>
            No contracts
          </div>
          <div className="flex items-center gap-2 text-[12px] font-bold text-neutral-800">
            <MessageCircle size={16} strokeWidth={2.5} style={{ color: BRAND_GREEN_DARK }}/>
            Real WhatsApp support
          </div>
          <div className="flex items-center gap-2 text-[12px] font-bold text-neutral-800">
            <Radio size={16} strokeWidth={2.5} style={{ color: BRAND_GREEN_DARK }}/>
            Cancel any time
          </div>
          <div className="flex items-center gap-2 text-[12px] font-bold text-neutral-800">
            <Clock size={16} strokeWidth={2.5} style={{ color: BRAND_GREEN_DARK }}/>
            14 day trial, no card
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
        <div
          className="flex flex-col items-center rounded-3xl p-8 text-center shadow-md"
          style={{
            backgroundImage: `linear-gradient(160deg, ${BRAND_BLACK} 0%, #1a1a1a 100%)`
          }}
        >
          <span
            className="inline-block text-[11px] font-black uppercase tracking-[0.22em]"
            style={{ color: BRAND_YELLOW }}
          >
            Start today
          </span>
          <h2 className="mt-1 text-[24px] font-black text-white sm:text-[30px]">
            Your first canteen live in under 10 minutes.
          </h2>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/85">
            No card required for the 14 day trial. Bring your logo, your first 5 photos, and your WhatsApp number.
          </p>
          <Link
            href="/trade-off/signup?plan=canteen"
            className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-lg transition active:scale-[0.98]"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            Start 14 day trial
            <ArrowRight size={14} strokeWidth={2.6}/>
          </Link>
          <p className="mt-3 text-[10.5px] text-white/60">
            No contracts. Cancel any time. Your slug stays yours forever.
          </p>
        </div>
      </section>
    </main>
  );
}

// ─── Pricing card ─────────────────────────────────────────

function PricingCard({ tier, billing }: { tier: Tier; billing: BillingCycle }) {
  const priced = tier.id !== "free";
  const price = priced ? priceOf(tier.id as "canteen" | "marketplace" | "ultimate", billing) : 0;
  const annualTotal = priced ? PRICES[tier.id as "canteen" | "marketplace" | "ultimate"].annual : 0;
  const annualSaving = priced ? PRICES[tier.id as "canteen" | "marketplace" | "ultimate"].annualSaving : 0;
  const isPopular = tier.badge === "Most popular";
  const isBestValue = tier.badge === "Best value";

  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-md"
      style={{
        borderColor: (isPopular || isBestValue) ? TAN : TAN_HAIRLINE,
        borderWidth: (isPopular || isBestValue) ? 2 : 1
      }}
    >
      {tier.badge && (
        <span
          className="absolute right-4 top-3 z-10 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-900 packages-badge-glow"
          style={{ backgroundColor: BRAND_YELLOW }}
        >
          {tier.badge}
        </span>
      )}

      {/* Hero image — Philip's vehicle artwork per tier (push bike /
          motor bike / van / jeep). Real <img> with object-contain per
          the global image rule so the whole vehicle shows without
          cropping. White backdrop across all tiers. Free + Canteen
          get extra padding (smaller vehicles read better shrunken
          slightly — the bike/motorbike shapes don't need to fill the
          frame like a van or jeep does). */}
      {tier.heroImage ? (
        <div
          className="relative flex w-full items-start justify-center bg-white"
          style={{ aspectRatio: "4 / 3" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tier.heroImage}
            alt={`${tier.name} tier`}
            className={`block h-full w-full object-contain ${
              tier.id === "free" || tier.id === "canteen"
                ? "p-6 object-top"
                : "p-4"
            }`}
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : (
        <div
          className="w-full bg-white"
          style={{ aspectRatio: "4 / 3" }}
          aria-hidden
        />
      )}

      <div className="flex flex-1 flex-col p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[16px] font-black uppercase tracking-wider text-neutral-900">
          {tier.name}
        </h2>
        <span className="inline-flex items-center gap-0.5" aria-label={`${tier.stars} out of 4 tier stars`}>
          {Array.from({ length: tier.stars }).map((_, i) => (
            <Star
              key={i}
              size={13}
              fill={BRAND_YELLOW}
              strokeWidth={0}
              style={{ color: BRAND_YELLOW }}
            />
          ))}
        </span>
      </div>
      <p className="mb-3 text-[11.5px] leading-snug text-neutral-500">
        {tier.audience}
      </p>
      <div className="mb-1 flex items-baseline gap-1">
        <span className="text-[32px] font-black leading-none text-neutral-900">
          £{price.toFixed(2)}
        </span>
        <span className="text-[11px] font-bold text-neutral-500">
          {priced ? "/ mo" : "forever"}
        </span>
      </div>
      {priced && (
        <p className="mb-3 text-[10.5px] leading-snug text-neutral-500">
          {billing === "annual"
            ? `Billed £${annualTotal.toFixed(0)}/yr. Saves £${annualSaving.toFixed(2)}.`
            : `Or £${annualTotal.toFixed(0)}/yr and save £${annualSaving.toFixed(2)}.`
          }
        </p>
      )}
      {!priced && (
        <p className="mb-3 text-[10.5px] leading-snug text-neutral-500">
          No card. No trial expiry on Free features.
        </p>
      )}

      {/* Every feature listed. No "+ N more features" — merchants
          need to see the full value before they commit. Longer cards
          are fine; hiding features loses buyers. */}
      <div className="mb-5 flex flex-col gap-3">
        {tier.groups.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 text-[9.5px] font-black uppercase tracking-[0.14em] text-neutral-500">
              {group.label}
            </div>
            <ul className="flex flex-col gap-1.5 text-[11.5px] leading-snug text-neutral-800">
              {group.items.map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <Check size={12} strokeWidth={2.8} className="mt-0.5 flex-shrink-0" style={{ color: BRAND_GREEN_DARK }}/>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Link
        href={tier.ctaHref}
        className="mt-auto inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.98]"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        {tier.ctaLabel}
        <ArrowRight size={12} strokeWidth={2.6}/>
      </Link>
      </div>
    </article>
  );
}

// ─── Matrix cell ──────────────────────────────────────────

function MatrixCell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <td className="px-4 py-2.5 text-center">
        <Check size={15} strokeWidth={2.8} className="mx-auto" style={{ color: BRAND_GREEN_DARK }}/>
      </td>
    );
  }
  if (value === false) {
    return (
      <td className="px-4 py-2.5 text-center text-[14px] text-neutral-300">
        —
      </td>
    );
  }
  return (
    <td className="px-4 py-2.5 text-center text-[11px] font-black text-neutral-800">
      {value}
    </td>
  );
}

// ─── Feature card (how it works) ──────────────────────────

function FeatureCard({ data }: { data: FeatureCardData }) {
  return (
    <article
      className="flex flex-col rounded-2xl border bg-white p-5 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ borderColor: TAN_HAIRLINE }}
    >
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: `${BRAND_YELLOW}22`, color: BRAND_BLACK }}
        >
          <data.icon size={16} strokeWidth={2.6}/>
        </div>
        <div className="flex-1">
          <h3 className="text-[14px] font-black leading-tight text-neutral-900">
            {data.title}
          </h3>
          <span
            className="text-[9.5px] font-black uppercase tracking-wider"
            style={{ color: TAN }}
          >
            {data.tierBadge}
          </span>
        </div>
      </div>
      <p className="mb-4 flex-1 text-[12px] leading-relaxed text-neutral-600">
        {data.description}
      </p>
      <Link
        href={data.demoHref}
        className="inline-flex h-9 w-max items-center gap-1.5 rounded-full px-3.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.97]"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        See it live
        <ArrowRight size={11} strokeWidth={2.6}/>
      </Link>
    </article>
  );
}

// ─── Per-tier detail container ─────────────────────────────

function TierDetailContainer({ tier, billing }: { tier: Tier; billing: BillingCycle }) {
  const priced = tier.id !== "free";
  const price = priced ? priceOf(tier.id as "canteen" | "marketplace" | "ultimate", billing) : 0;
  return (
    <article
      id={`tier-${tier.id}`}
      className="rounded-2xl border bg-white p-5 shadow-md sm:p-6"
      style={{ borderColor: TAN_HAIRLINE }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        {/* Left — feature list */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: TAN }}>
                {tier.positioning}
              </div>
              <h3 className="flex items-center gap-2 text-[20px] font-black leading-tight text-neutral-900">
                {tier.name}
                <span className="inline-flex items-center gap-0.5" aria-hidden>
                  {Array.from({ length: tier.stars }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      fill={BRAND_YELLOW}
                      strokeWidth={0}
                      style={{ color: BRAND_YELLOW }}
                    />
                  ))}
                </span>
                {priced && (
                  <span className="ml-2 text-[13px] font-bold text-neutral-500">
                    from £{price.toFixed(2)} / mo
                  </span>
                )}
              </h3>
              <p className="text-[11.5px] text-neutral-500">{tier.audience}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tier.groups.map((g) => (
              <div key={g.label}>
                <div className="mb-1.5 text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-500">
                  {g.label}
                </div>
                <ul className="flex flex-col gap-1.5 text-[12px] leading-snug text-neutral-800">
                  {g.items.map((item) => (
                    <li key={item} className="flex items-start gap-1.5">
                      <Check size={12} strokeWidth={2.8} className="mt-0.5 flex-shrink-0" style={{ color: BRAND_GREEN_DARK }}/>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <Link
              href={tier.ctaHref}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.97]"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              {tier.ctaLabel}
              <ArrowRight size={12} strokeWidth={2.6}/>
            </Link>
          </div>
        </div>

        {/* Right — screenshot slots (placeholder frames) */}
        <div className="w-full flex-shrink-0 md:w-[340px] lg:w-[400px]">
          <div className="mb-2 text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-500">
            Screenshots
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ScreenshotSlot key={i}/>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-neutral-400">
            Drop {tier.name.toLowerCase()} feature screenshots into these slots.
          </p>
        </div>
      </div>
    </article>
  );
}

function ScreenshotSlot() {
  return (
    <div
      className="flex aspect-[16/10] items-center justify-center rounded-lg border-2 border-dashed text-[10px] text-neutral-400"
      style={{ borderColor: TAN_HAIRLINE, backgroundColor: `${CREAM}` }}
    >
      Screenshot slot
    </div>
  );
}

