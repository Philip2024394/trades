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
  UserRound,
  Home,
  ShoppingBag,
  Package,
  ShieldCheck,
  MessageCircle,
  ArrowRight,
  TrendingUp,
  Layers,
  Clock,
  Radio,
  Truck
} from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

const CREAM = "#FBF6EC";
const TAN = "#B8860B";
const TAN_HAIRLINE = "rgba(184,134,11,0.20)";
const TAN_SOFT_TINT = "rgba(184,134,11,0.06)";

type BillingCycle = "monthly" | "annual";

// ─── Pricing model ─────────────────────────────────────────

const PRICES = {
  canteen:     { monthly: 6.99,  annual: 60,   annualSaving: 6.99 * 12 - 60 },
  marketplace: { monthly: 9.99,  annual: 99,   annualSaving: 9.99 * 12 - 99 },
  ultimate:    { monthly: 14.99, annual: 149,  annualSaving: 14.99 * 12 - 149 }
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
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;
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
    icon: UserRound,
    name: "Free",
    positioning: "Get discovered",
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
    icon: Home,
    name: "Canteen",
    positioning: "Your website + community presence",
    audience: "Service trades — kitchen fitters, sparks, plumbers",
    badge: "Most popular",
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
    icon: ShoppingBag,
    name: "Marketplace",
    positioning: "Sell products, parts + services",
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
    id: "ultimate",
    icon: Package,
    name: "Ultimate",
    positioning: "Everything + premium tools",
    audience: "Hybrid merchants — sell products AND run service",
    badge: "Best value",
    ctaLabel: "Go Ultimate",
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
          "Hosted on our CDN, no third-party account"
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

const FEATURES: FeatureCardData[] = [
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
    tierBadge: "Ultimate",
    demoHref: "/trade-off/verified"
  }
];

// ─── Main component ───────────────────────────────────────

export function PackagesShell() {
  const [billing, setBilling] = useState<BillingCycle>("annual");

  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
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
            Free forever gives you your URL and browse-everything access. Canteen adds your live page. Marketplace unlocks Trade Center selling. Ultimate is everything, plus AI tools and video.
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
                Save up to £30
              </span>
            </button>
          </div>
        </div>
        {billing === "annual" && (
          <p className="mt-2 text-center text-[11px] text-neutral-500">
            Annual = 2 months free on Canteen, Marketplace and Ultimate.
          </p>
        )}
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
                <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-wider text-neutral-900">Ultimate</th>
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} data={f}/>
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
      className="relative flex flex-col rounded-2xl border bg-white p-5 shadow-md"
      style={{
        borderColor: (isPopular || isBestValue) ? TAN : TAN_HAIRLINE,
        borderWidth: (isPopular || isBestValue) ? 2 : 1
      }}
    >
      {tier.badge && (
        <span
          className="absolute right-4 top-[-10px] rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-md"
          style={{ backgroundColor: BRAND_BLACK }}
        >
          {tier.badge}
        </span>
      )}
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: `${BRAND_YELLOW}22`, color: BRAND_BLACK }}
        >
          <tier.icon size={17} strokeWidth={2.6}/>
        </div>
        <h2 className="text-[16px] font-black uppercase tracking-wider text-neutral-900">
          {tier.name}
        </h2>
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
        className="mt-auto inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-white shadow-sm transition active:scale-[0.98]"
        style={{ backgroundColor: priced ? BRAND_GREEN_DARK : BRAND_BLACK }}
      >
        {tier.ctaLabel}
        <ArrowRight size={12} strokeWidth={2.6}/>
      </Link>
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
        className="inline-flex h-9 w-max items-center gap-1.5 rounded-full px-3.5 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm transition active:scale-[0.97]"
        style={{ backgroundColor: BRAND_GREEN_DARK }}
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
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
            >
              <tier.icon size={18} strokeWidth={2.6}/>
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: TAN }}>
                {tier.positioning}
              </div>
              <h3 className="text-[20px] font-black leading-tight text-neutral-900">
                {tier.name}
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
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm transition active:scale-[0.97]"
              style={{ backgroundColor: priced ? BRAND_GREEN_DARK : BRAND_BLACK }}
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

