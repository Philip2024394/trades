// Xrated Trades — pricing page (Free vs Paid 2-tier comparison).
// Two-tier freemium: Free Profile on hammerexdirect.com (basic, forever
// free) vs Paid Profile on xratedtrade.com (£14.99/mo or £139.99/yr, 14-day
// trial). Every signup starts FREE with all premium features unlocked
// for 14 days; if they don't convert by day 15 the profile auto-reverts
// to the free-for-life tier. No card required either way. The brandable
// xratedtrade.com URL is the central upgrade lever.
//
// Page layout: hero → two-card comparison (PricingTierCards client child)
// → side-by-side feature comparison table → FAQ → closing CTA.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute, faqJsonLd } from "@/lib/seo";
import { PricingTierCards } from "./PricingTierCards";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Pricing — Xrated Trades. Free · Paid £14.99/mo · Verified £19.99/mo. The Yard + xratedtrades.com listing included.",
  description:
    "Three tiers — Free forever, Paid £14.99/mo on your brandable xratedtrade.com URL, or Verified £19.99/mo with a real badge customers see. Every paid tier includes The Yard (private trades-only forum), auto-listing on xratedtrades.com (UK search portal), 10 add-ons (Shop, Services, Job Diary, Quote Pipeline, Lead Alerts, Custom Domain + 4 more), full SEO + free future updates. Verified Plus £29.99/mo by application. 14-day free trial, no card on signup.",
  alternates: { canonical: "/trade-off/pricing" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Xrated Trades — Pricing. Free · Paid £14.99/mo · Verified £19.99/mo · Verified Plus £29.99/mo.",
    description:
      "Every paid tier now includes The Yard private forum + auto-listing on xratedtrades.com + 10 add-ons + all future features free. 14-day free trial, no card.",
    url: absolute("/trade-off/pricing")
  }
};

type FeatureRow = {
  label: string;
  free: string | boolean;
  paid: string | boolean;
  verified: string | boolean;
  highlight?: boolean;
  /** Section divider — when set, this row renders as a sub-heading row
   *  with the section name in the label column, no values. Lets us
   *  group ~40 rows into scannable sections (Yard / Search / Profile
   *  / Add-ons / SEO / Support). */
  section?: string;
};

const COMPARE_ROWS: FeatureRow[] = [
  // ─────────────────── URL + identity ───────────────────
  { section: "URL & identity", label: "", free: "", paid: "", verified: "" },
  { label: "URL domain", free: "hammerexdirect.com", paid: "xratedtrade.com", verified: "xratedtrade.com", highlight: true },
  { label: "Branded URL slug (yours forever)", free: true, paid: true, verified: true },
  { label: "Xrated header on profile", free: "Visible", paid: "Hidden (white-label)", verified: "Hidden (white-label)", highlight: true },
  { label: "Custom domain (yourtrade.co.uk)", free: false, paid: "Add-on £5/mo", verified: "Add-on £5/mo" },
  { label: "Forever free", free: true, paid: false, verified: false },

  // ─────────────────── The Yard (private forum) ───────────────────
  { section: "The Yard — private trades-only board", label: "", free: "", paid: "", verified: "" },
  { label: "Read The Yard feed", free: false, paid: true, verified: true, highlight: true },
  { label: "Post Available (offer slots)", free: false, paid: true, verified: true },
  { label: "Post Hiring (sub-contract crew)", free: false, paid: true, verified: true },
  { label: "Post Trade Chat (rates, suppliers, anything)", free: false, paid: true, verified: true },
  { label: "Post For Sale (tools / materials)", free: false, paid: true, verified: true },
  { label: "Reactions + replies + image attachments", free: false, paid: true, verified: true },
  { label: "14-day auto-vanish (no public footprint)", free: false, paid: true, verified: true, highlight: true },
  { label: "Builder trades get free Yard access", free: false, paid: "If builder-grade trade", verified: "If builder-grade trade" },

  // ─────────────────── xratedtrades.com search portal ───────────────────
  { section: "xratedtrades.com — customer search portal", label: "", free: "", paid: "", verified: "" },
  { label: "Auto-listed on xratedtrades.com", free: false, paid: true, verified: true, highlight: true },
  { label: "Verified badge on every search result", free: false, paid: false, verified: true, highlight: true },
  { label: "Priority sort on search results", free: false, paid: false, verified: true },
  { label: "Receives Project Beacons (3-nearest customer pings)", free: false, paid: true, verified: true, highlight: true },
  { label: "Push notification + sound when a beacon fires", free: false, paid: "With Lead Alerts add-on", verified: "With Lead Alerts add-on" },
  { label: "Visible across UK + international searches", free: false, paid: true, verified: true },

  // ─────────────────── Profile / app features ───────────────────
  { section: "Your premium app — surface", label: "", free: "", paid: "", verified: "" },
  { label: "AvailabilityPill (live 'back online at 7am')", free: true, paid: true, verified: true, highlight: true },
  { label: "Operating-hours editor (Mon-Sun)", free: true, paid: true, verified: true },
  { label: "Profile banner", free: "Default", paid: "Custom upload", verified: "Custom upload" },
  { label: "Theme colour", free: "Yellow only", paid: "7-colour picker", verified: "7-colour picker" },
  { label: "Photo gallery", free: "Up to 8 images", paid: "Unlimited", verified: "Unlimited" },
  { label: "Intro video tile (self-hosted)", free: false, paid: "Up to 60s", verified: "Up to 60s" },
  { label: "Meet-the-team grid", free: false, paid: true, verified: true },

  // ─────────────────── Customer interaction ───────────────────
  { section: "How customers contact you", label: "", free: "", paid: "", verified: "" },
  { label: "WhatsApp message button", free: true, paid: true, verified: true },
  { label: "Call Now button", free: false, paid: true, verified: true },
  { label: "Get Directions deep-link to Google/Apple Maps", free: true, paid: true, verified: true },
  { label: "Lead-capture contact form", free: false, paid: true, verified: true },
  { label: "Enquire-prefill flow on every card", free: false, paid: true, verified: true },
  { label: "Business Card — one-tap share to WhatsApp", free: true, paid: true, verified: true, highlight: true },
  { label: "QR code on van + business cards", free: true, paid: true, verified: true },

  // ─────────────────── Reviews + trust ───────────────────
  { section: "Reviews + trust", label: "", free: "", paid: "", verified: "" },
  { label: "Customer reviews (read)", free: true, paid: true, verified: true },
  { label: "Customers can submit reviews", free: false, paid: true, verified: true },
  { label: "Per-service star badges", free: false, paid: true, verified: true },
  { label: "Trust Score live gauge", free: true, paid: true, verified: true, highlight: true },
  { label: "Trusted Trades — recommend other trades", free: true, paid: true, verified: true },
  { label: "Verified badge backed by Companies House check", free: false, paid: false, verified: true, highlight: true },
  { label: "Dispute mediation", free: false, paid: false, verified: true },

  // ─────────────────── Add-ons (all paid-tier compatible) ───────────────────
  { section: "Add-ons — bolt on the ones you need", label: "", free: "", paid: "", verified: "" },
  { label: "Services Prices — priced service grid", free: false, paid: "Add-on £4/mo", verified: "Add-on £4/mo" },
  { label: "Shop Mode — products + cart + WhatsApp checkout", free: false, paid: "Add-on £5/mo *", verified: "Add-on £5/mo *" },
  { label: "Wholesale Mode — B2B pricing tiers", free: false, paid: "Add-on £7/mo", verified: "Add-on £7/mo" },
  { label: "Job Diary — project portfolio + updates", free: false, paid: "Add-on £4/mo", verified: "Add-on £4/mo" },
  { label: "Downloads — gated PDFs with email capture", free: false, paid: "Add-on £2/mo", verified: "Add-on £2/mo" },
  { label: "FAQ Page — visual ref-numbered knowledge base", free: false, paid: "Add-on £2/mo", verified: "Add-on £2/mo" },
  { label: "Materials Network — earn from merchants", free: false, paid: "Add-on £3/mo", verified: "Add-on £3/mo" },
  { label: "Lead Alerts — PWA push the moment WhatsApp lands", free: false, paid: "Add-on £4/mo", verified: "Add-on £4/mo" },
  { label: "Custom Domain — bring your own .co.uk", free: false, paid: "Add-on £5/mo", verified: "Add-on £5/mo" },
  { label: "Quote Pipeline — kanban CRM for crews", free: false, paid: "Add-on £5/mo", verified: "Add-on £5/mo" },

  // ─────────────────── SEO + technical ───────────────────
  { section: "SEO + technical", label: "", free: "", paid: "", verified: "" },
  { label: "Server-rendered profile (Google-ranked)", free: true, paid: true, verified: true, highlight: true },
  { label: "PWA — Add to Home Screen", free: true, paid: true, verified: true },
  { label: "OG tags + structured data (Schema.org)", free: true, paid: true, verified: true },
  { label: "Sitemap auto-submitted to Google", free: true, paid: true, verified: true },

  // ─────────────────── Support + updates ───────────────────
  { section: "Support + the always-shipping promise", label: "", free: "", paid: "", verified: "" },
  { label: "Email + WhatsApp support", free: "Community only", paid: "Priority", verified: "Priority + verification queue" },
  { label: "All future updates + new features", free: false, paid: "Free, automatic", verified: "Free, automatic", highlight: true },
  { label: "Cancel any time", free: true, paid: true, verified: true }
];

const PRICING_FAQ = [
  {
    q: "What is The Yard and do I get it on the £14.99 tier?",
    a: "Yes — The Yard is a paid-tier feature, included with every Paid and Verified plan. It's the private trades-only board nobody outside the membership can read. Post 'Available next week' or 'Need 3 sparks Monday', drop a Trade Chat about rates or suppliers, or list a tool for sale. Every post auto-vanishes after 14 days so there's no public footprint your customers can google. Builder-grade trades (general-builder, building-merchant, builders-supplies) get free Yard access as a marketplace-density boost."
  },
  {
    q: "Will customers find me on xratedtrades.com?",
    a: "Yes. Every paid profile is auto-listed on xratedtrades.com — our customer-facing UK search portal. Customers search by trade + city + postcode, see a list of real Xrated apps in their area, and tap straight through to YOUR app. We don't sit in the middle — no quote forms, no message routing, no commission. The customer lands on your profile and uses YOUR WhatsApp button. Verified members get the visible badge on every search result + priority sort."
  },
  {
    q: "What is the Verified tier and why does it cost £19.99/mo?",
    a: "Verified is the £19.99/mo / £199.99/yr tier with a real badge backed by checks customers can rely on. The required check is active company registration (Companies House or your local registry) — we confirm the company exists, is in good standing, and you are a director or named owner. Two optional add-on badges layer on top: 'Insured for private work' (if you upload a public-liability + employer's insurance certificate, useful for direct-to-customer work) and 'On-site checked' (for high-risk trades like gas, electrical, structural, scaffolding — we confirm credentials at the work address). The £5 over Paid pays for the verification queue, the dispute mediation service, and priority lead-routing in search."
  },
  {
    q: "Do I need insurance to qualify for Verified?",
    a: "No. The only required check is active company registration. Many commercial tradies are covered by the principal contractor's master policy on site and have no private-work insurance — that's fine, you can still be Verified. Insurance becomes an optional add-on badge ('Insured for private work') for tradies who do direct-to-customer work and want to show that on their profile."
  },
  {
    q: "When does Verified launch?",
    a: "Q3 2026. You can join the waitlist now and your price is locked at £19.99/mo for life as a founding Verified member. When the verification queue opens we walk you through company-registration check first, then optional insurance and on-site add-on badges if they apply."
  },
  {
    q: "How does the 14-day free trial work?",
    a: "Sign up free. Your first 14 days unlock every premium feature — brandable xratedtrade.com URL, video, contact form, custom theme, the lot. No card required. On day 15 you either start a £14.99/mo (or £139.99/yr) subscription to keep premium, or your profile auto-reverts to the free-for-life tier on hammerexdirect.com. Either change is automatic. Your slug stays yours forever either way."
  },
  {
    q: "What happens when I downgrade — do I lose my work?",
    a: "Your reviews, photos, services, opening hours and team grid all stay. What changes: the URL flips from xratedtrade.com to hammerexdirect.com (with a 301 redirect so old shared links still work), the Xrated header appears, and the paid-only widgets hide (video, contact form, Meet-the-team, service prices). Upgrade later and everything snaps back."
  },
  {
    q: "Can I keep my xratedtrade.com URL by paying?",
    a: "Yes — that is the whole point. The xratedtrade.com URL is reserved for paid profiles only. Your slug stays yours forever (no one else can claim it) but it lives on hammerexdirect.com when you are on Free and on xratedtrade.com when you are Paid."
  },
  {
    q: "What is the difference between monthly and annual?",
    a: "Annual costs £139.99 instead of £179.88 (you save £40 / nearly three months) AND unlocks two extra perks: a 5% Hammerex shop discount on every order, and a free Hammerex knife voucher delivered when you sign up. The discount alone covers the annual fee for most working tradies."
  },
  {
    q: "Is there a platform fee on the jobs I win?",
    a: "No. Xrated Trades charges only the monthly / annual subscription. We take nothing from the jobs you win. Customer contact lands in your WhatsApp or email and you bill them direct — Xrated is never in the money flow."
  },
  {
    q: "I am not based in the UK — can I still use Xrated?",
    a: "Yes. Xrated Trades works for tradies anywhere. You can list your country, city, service areas and your local currency in your enquiries. Subscriptions are billed in GBP — Stripe handles the FX at checkout, so a £14.99/mo plan charges roughly $19 / €17 / A$28 depending on your card."
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Cancel from your dashboard at any time. Monthly subscribers stop at the end of the current month and downgrade silently to Free. Annual subscribers can ask for a prorated refund within 30 days of payment."
  },
  {
    q: "Do you offer team / crew pricing?",
    a: "For now, one subscription = one tradesperson / one URL. Companies with 2+ tradesmen can add Meet-the-team cards inside the dashboard. If you have a 5+ person crew and want everyone on Xrated with separate URLs, contact us and we'll quote a team plan."
  }
];

export default function PricingPage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(PRICING_FAQ)) }}
      />

      {/* Hero — image banner background with dark gradient overlay for
          text legibility. Image is the bespoke pricing-page banner art
          from ImageKit; daily cron will migrate to Supabase storage. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2026,%202026,%2007_59_10%20AM.png?updatedAt=1782435570414"
          alt="Xrated Trades pricing — free forever or premium."
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Left-to-right dark gradient — keeps the left half of the
            banner heavy enough for white headline + subhead text to read
            cleanly while letting the right half of the artwork show
            through unobstructed. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.15) 75%, rgba(0,0,0,0) 100%)"
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Pricing — Free forever, or premium
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            More than an app.{" "}
            <span style={{ color: XRATED_BRAND.accent }}>The whole platform — £14.99/mo.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Your branded xratedtrade.com app{" "}
            <span className="font-bold text-white">PLUS</span> The Yard
            (private trades-only forum){" "}
            <span className="font-bold text-white">PLUS</span> auto-listing
            on xratedtrades.com so customers find you{" "}
            <span className="font-bold text-white">PLUS</span> 10 add-ons
            you bolt on as you need them. Every future feature lands free,
            automatic. 14-day trial, no card.{" "}
            <span className="font-bold text-white">
              Claim your name now — yours forever.
            </span>
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> 14-day free trial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> No card on signup
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> No platform fee on jobs you win
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Cancel any time
            </span>
          </div>
          {/* Add-ons cross-link — both paid tiers stack the same add-on
              library. Surfaced here so a tradesperson comparing prices
              also discovers they can bolt on Shop Mode, Services Prices,
              Job Diary, Downloads, etc. */}
          <a
            href="/trade-off/add-ons"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-white/30 bg-white/5 px-4 text-xs font-bold text-white/90 transition hover:border-white/60 hover:bg-white/10 sm:text-sm"
          >
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: XRATED_BRAND.accent }}
            />
            <span>
              Every paid plan supports{" "}
              <span className="font-extrabold" style={{ color: XRATED_BRAND.accent }}>
                10 add-ons
              </span>{" "}
              — Shop, Services Prices, Job Diary, Quote Pipeline &amp; more
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </a>
        </div>
      </section>

      {/* Two-tier card grid — client component handles the
          monthly/annual toggle on the paid card. */}
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
        <PricingTierCards />
      </section>

      {/* Mental anchor — frames £14.99/mo against the consumables tradies
          already buy without thinking. Three short bullets keep the
          cost-anchor + tax-deductible + web-dev framing legible without
          turning the section into a wall of text. */}
      <section className="mx-auto mt-10 max-w-5xl px-4 sm:mt-14 sm:px-6">
        <div
          className="rounded-3xl border-2 bg-white p-6 shadow-sm sm:p-10"
          style={{ borderColor: XRATED_BRAND.accent }}
        >
          <p
            className="text-xs font-extrabold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Mental anchor
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl md:text-4xl">
            Less than a single{" "}
            <span style={{ color: XRATED_BRAND.accent }}>box of screws.</span>
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-700 sm:text-base">
            £14.99/mo is less than what most tradies spend on the boxes
            of structural screws they get through in a single month. At
            £179.88/yr, it's a rounding error in your tool budget — and
            the most leveraged £15 you'll spend.
          </p>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <li className="flex items-start gap-2.5 rounded-xl bg-neutral-50 p-4">
              <span
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: XRATED_BRAND.accent }}
                aria-hidden="true"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
              <p className="text-xs leading-relaxed text-neutral-800 sm:text-sm">
                <span className="font-bold">All-in-one mobile profile</span>, set up in 5 minutes — replaces what a web developer charges <span className="font-bold">£1,000-3,000</span> to build.
              </p>
            </li>
            <li className="flex items-start gap-2.5 rounded-xl bg-neutral-50 p-4">
              <span
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: XRATED_BRAND.accent }}
                aria-hidden="true"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
              <p className="text-xs leading-relaxed text-neutral-800 sm:text-sm">
                Most tradies put it through their business as a{" "}
                <span className="font-bold">marketing expense</span> — check with your accountant, but advertising costs typically qualify as a deduction.
              </p>
            </li>
            <li className="flex items-start gap-2.5 rounded-xl bg-neutral-50 p-4">
              <span
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: XRATED_BRAND.accent }}
                aria-hidden="true"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
              <p className="text-xs leading-relaxed text-neutral-800 sm:text-sm">
                Goes on your <span className="font-bold">tax-deductible costs</span> alongside your tools, your van, and your phone plan. Effective net cost: even less than £14.99.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* "We work. You stay on the tools." — the always-shipping promise.
          Lives between the tier cards and the feature table so visitors
          read it the moment they've absorbed the price. Frames the
          subscription as an active partnership, not a static product. */}
      <section className="mx-auto mt-12 max-w-5xl px-4 sm:mt-16 sm:px-6">
        <div
          className="overflow-hidden rounded-3xl px-6 py-10 text-center sm:px-12 sm:py-14"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.28em] sm:text-xs"
            style={{ color: XRATED_BRAND.accent }}
          >
            We work. You stay on the tools.
          </p>
          <h2 className="mx-auto mt-3 max-w-3xl text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Every update.{" "}
            <span style={{ color: XRATED_BRAND.accent }}>
              Every new feature. Free. Automatic.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Xrated isn&rsquo;t a one-and-done product. Our team is in the
            code every day, building the systems that bring you customers
            with less effort on your end. No upgrade emails. No premium
            add-ons. No tier creep.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm font-extrabold text-white sm:text-base">
            You concentrate on the project at hand. We make sure
            customers connect.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900 sm:text-[11px]"
              style={{ background: XRATED_BRAND.accent }}
            >
              <InlineTick /> All updates free, forever
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900 sm:text-[11px]"
              style={{ background: XRATED_BRAND.accent }}
            >
              <InlineTick /> New features auto-unlocked
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900 sm:text-[11px]"
              style={{ background: XRATED_BRAND.accent }}
            >
              <InlineTick /> Daily improvements
            </span>
          </div>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Feature comparison
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Every widget we ship, side-by-side. Highlighted rows show the
          biggest gap between Free and Paid.
        </p>

        {/* Desktop / tablet — full 4-column table */}
        <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-neutral-200 sm:block">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead style={{ background: "#0A0A0A" }}>
              <tr>
                <th className="px-4 py-3 font-bold uppercase tracking-widest text-white/80">
                  Feature
                </th>
                <th className="w-32 px-3 py-3 text-center font-bold uppercase tracking-widest text-white/60">
                  Free
                </th>
                <th
                  className="w-36 px-3 py-3 text-center font-bold uppercase tracking-widest"
                  style={{ color: XRATED_BRAND.accent }}
                >
                  Paid
                </th>
                <th
                  className="w-44 px-3 py-3 text-center font-extrabold uppercase tracking-widest"
                  style={{ background: `${XRATED_BRAND.accent}26`, color: XRATED_BRAND.accent }}
                >
                  Verified ★
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {COMPARE_ROWS.map((row, idx) => {
                if (row.section) {
                  return (
                    <tr key={`section-${idx}`} style={{ background: "#0A0A0A" }}>
                      <th
                        colSpan={4}
                        className="px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.22em]"
                        style={{ color: XRATED_BRAND.accent }}
                      >
                        {row.section}
                      </th>
                    </tr>
                  );
                }
                return (
                  <tr
                    key={row.label}
                    className="border-t border-neutral-100"
                    style={row.highlight ? { background: `${XRATED_BRAND.accent}0A` } : undefined}
                  >
                    <th className="px-4 py-3 text-left font-semibold text-neutral-800">
                      {row.label}
                      {row.highlight && (
                        <span
                          className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                          style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
                        >
                          Key
                        </span>
                      )}
                    </th>
                    <td className="px-3 py-3 text-center text-neutral-600">
                      <Cell value={row.free} />
                    </td>
                    <td className="px-3 py-3 text-center text-neutral-900">
                      <Cell value={row.paid} accent />
                    </td>
                    <td
                      className="px-3 py-3 text-center font-bold text-neutral-900"
                      style={{ background: `${XRATED_BRAND.accent}10` }}
                    >
                      <Cell value={row.verified} accent />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile — stacked card per row, 3-cell mini-table */}
        <ul className="mt-6 flex flex-col gap-2.5 sm:hidden">
          {COMPARE_ROWS.map((row, idx) => {
            if (row.section) {
              return (
                <li
                  key={`m-section-${idx}`}
                  className="rounded-xl px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.22em]"
                  style={{ background: "#0A0A0A", color: XRATED_BRAND.accent }}
                >
                  {row.section}
                </li>
              );
            }
            return (
            <li
              key={row.label}
              className="rounded-xl border border-neutral-200 bg-white p-3"
              style={row.highlight ? { background: `${XRATED_BRAND.accent}0A` } : undefined}
            >
              <p className="text-xs font-bold text-neutral-900">
                {row.label}
                {row.highlight && (
                  <span
                    className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                    style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
                  >
                    Key
                  </span>
                )}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[12px]">
                <div className="rounded-md bg-neutral-50 px-2 py-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                    Free
                  </p>
                  <p className="mt-0.5 text-neutral-600">
                    <Cell value={row.free} />
                  </p>
                </div>
                <div
                  className="rounded-md px-2 py-1.5"
                  style={{ background: `${XRATED_BRAND.accent}1A` }}
                >
                  <p
                    className="text-[9px] font-extrabold uppercase tracking-wider"
                    style={{ color: "#7A5300" }}
                  >
                    Paid
                  </p>
                  <p className="mt-0.5 font-bold text-neutral-900">
                    <Cell value={row.paid} accent />
                  </p>
                </div>
                <div
                  className="rounded-md bg-neutral-900 px-2 py-1.5"
                >
                  <p
                    className="text-[9px] font-extrabold uppercase tracking-wider"
                    style={{ color: XRATED_BRAND.accent }}
                  >
                    Verified ★
                  </p>
                  <p className="mt-0.5 font-bold text-white">
                    <Cell value={row.verified} accent dark />
                  </p>
                </div>
              </div>
            </li>
            );
          })}
        </ul>

        <p className="mt-3 text-[11px] text-neutral-500 sm:text-xs">
          * Shop Mode is included <span className="font-bold">standard</span>{" "}
          on the £14.99/mo tier for merchant trades (kitchen-fitter,
          stair-fitter, building-merchant, builders-supplies, tool-hire,
          heavy-machinery, window-fitter, security-installer) — no
          add-on required.
        </p>
      </section>

      {/* Verified Plus — coming-soon teaser. Positioned between the
          feature table and the FAQ so visitors who scrolled the matrix
          see the £29.99 ceiling exists but it's by application. Keeps
          the visual emphasis on £14.99 vs £19.99 as the real decision. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <div
          className="overflow-hidden rounded-3xl border-2 border-dashed bg-white p-6 sm:p-8"
          style={{ borderColor: `${XRATED_BRAND.accent}55` }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p
                className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
                style={{ color: XRATED_BRAND.accent }}
              >
                Coming soon · By application
              </p>
              <h2 className="mt-2 text-xl font-extrabold leading-tight text-neutral-900 sm:text-2xl">
                Verified Plus &mdash;{" "}
                <span style={{ color: XRATED_BRAND.accent }}>£29.99/mo</span>.
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
                Everything in Verified, plus independent verification of
                your <span className="font-bold">DBS check</span>, your{" "}
                <span className="font-bold">insurance certificate</span>{" "}
                and your <span className="font-bold">trade body membership</span>{" "}
                (Gas Safe, NICEIC, FENSA, FMB, CISRS&hellip;). A different
                badge on every search result, so customers can tell
                Verified from genuinely-vetted. By application — we do
                the checks; you upload the docs once.
              </p>
            </div>
            <span
              className="inline-flex h-12 shrink-0 items-center rounded-full px-4 text-[11px] font-extrabold uppercase tracking-wider text-neutral-900"
              style={{ background: `${XRATED_BRAND.accent}26`, color: "#7A5300" }}
            >
              Waitlist open
            </span>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Pricing — common questions
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {PRICING_FAQ.map((qa) => (
            <li key={qa.q}>
              <details
                className="group rounded-2xl border border-neutral-200 bg-white p-4 transition open:border-[color:var(--accent)]"
                style={{ ["--accent" as never]: XRATED_BRAND.accent }}
              >
                <summary className="flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-3 text-sm font-bold text-neutral-900 marker:content-[''] sm:text-base">
                  <span>{qa.q}</span>
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition group-open:rotate-45"
                    style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                  {qa.a}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {/* Closing CTA — black surface mirroring the hero. */}
      <section className="mx-auto mt-12 max-w-5xl px-4 pb-2 sm:px-6">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            One link. Every customer.
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Start your 14-day free trial.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            Full Paid-tier access for 14 days. No card on signup. Auto-
            downgrades to Free on day 15 if you don&rsquo;t subscribe —
            your work, your reviews, your slug all stay yours.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/trade-off/signup"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
              }}
            >
              Start 14-day trial
            </a>
            <a
              href="/trade-off"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              Back to overview
            </a>
          </div>
        </div>
      </section>

      <XratedFooter />
    </main>
  );
}

function Cell({
  value,
  accent = false,
  dark = false
}: {
  value: string | boolean;
  accent?: boolean;
  dark?: boolean;
}) {
  if (value === true) {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full"
        style={{ background: accent ? XRATED_BRAND.accent : dark ? "rgba(255,255,255,0.15)" : "#e5e5e5" }}
        aria-label="Included"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent ? "#0A0A0A" : dark ? "#ffffff" : "#737373"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (value === false) {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full"
        style={{ background: dark ? "rgba(255,255,255,0.10)" : "#f5f5f5" }}
        aria-label="Not included"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={dark ? "rgba(255,255,255,0.45)" : "#a3a3a3"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </span>
    );
  }
  return (
    <span className={dark ? "font-bold text-white" : accent ? "font-bold text-neutral-900" : "text-neutral-600"}>
      {value}
    </span>
  );
}

function Dot({ accent = false }: { accent?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: accent ? XRATED_BRAND.accent : "rgba(255,255,255,0.6)" }}
    />
  );
}

function InlineTick() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
