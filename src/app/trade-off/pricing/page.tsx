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
    "Pricing — Xrated Trades. Free · Paid £14.99/mo · Verified £19.99/mo. 14-day trial. For tradies anywhere.",
  description:
    "Three tiers. Free forever on hammerexdirect.com — basic profile. Paid £14.99/mo on your brandable xratedtrade.com URL — full features, white-label. Verified £19.99/mo — everything in Paid plus a verified badge backed by company-registration check, with optional Insurance + On-site add-on badges. 14-day free trial, no card on signup.",
  alternates: { canonical: "/trade-off/pricing" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Xrated Trades — Pricing. Free · Paid £14.99/mo · Verified £19.99/mo. 14-day trial.",
    description:
      "Three tiers. Free forever, Paid £14.99/mo on your brandable xratedtrade.com URL, or Verified £19.99/mo with a real verified badge. 14-day free trial, no card on signup.",
    url: absolute("/trade-off/pricing")
  }
};

type FeatureRow = {
  label: string;
  free: string | boolean;
  paid: string | boolean;
  verified: string | boolean;
  highlight?: boolean;
};

const COMPARE_ROWS: FeatureRow[] = [
  { label: "URL domain", free: "hammerexdirect.com", paid: "xratedtrade.com", verified: "xratedtrade.com", highlight: true },
  { label: "Branded URL slug", free: true, paid: true, verified: true },
  { label: "Forever free", free: true, paid: false, verified: false },
  { label: "Xrated header on profile", free: "Visible", paid: "Hidden (white-label)", verified: "Hidden (white-label)", highlight: true },
  { label: "Verified badge on profile", free: false, paid: false, verified: "Visible — required check passed", highlight: true },
  { label: "Optional add-on badges", free: false, paid: false, verified: "Insured / On-site checked", highlight: true },
  { label: "Priority lead-routing in search", free: false, paid: false, verified: true },
  { label: "Dispute mediation", free: false, paid: false, verified: true },
  { label: "Verified-only customer filter", free: false, paid: false, verified: true },
  { label: "Profile banner", free: "Default", paid: "Custom upload", verified: "Custom upload" },
  { label: "Theme colour", free: "Yellow only", paid: "7-colour picker", verified: "7-colour picker" },
  { label: "Photo gallery", free: "Up to 8 images", paid: "Unlimited", verified: "Unlimited" },
  { label: "WhatsApp message button", free: true, paid: true, verified: true },
  { label: "Call Now button", free: false, paid: true, verified: true },
  { label: "Contact buttons", free: false, paid: true, verified: true },
  { label: "Lead-capture contact form", free: false, paid: true, verified: true },
  { label: "Intro video tile (self-hosted)", free: false, paid: "Up to 60s", verified: "Up to 60s" },
  { label: "Service cards", free: "Image + name", paid: "Full price + description", verified: "Full price + description" },
  { label: "Enquire-prefill flow", free: false, paid: true, verified: true },
  { label: "Customer reviews (read)", free: true, paid: true, verified: true },
  { label: "Customers can submit reviews", free: false, paid: true, verified: true },
  { label: "Meet-the-team grid", free: false, paid: true, verified: true },
  { label: "Opening hours + office hours widget", free: true, paid: true, verified: true },
  { label: "QR code for van + business cards", free: true, paid: true, verified: true },
  { label: "FAQ slider", free: true, paid: true, verified: true },
  { label: "Services subpage with catchment map", free: false, paid: true, verified: true },
  { label: "Email + WhatsApp support", free: "Community only", paid: "Priority", verified: "Priority + verification queue" },
  { label: "All future updates + new features", free: false, paid: "Free, automatic", verified: "Free, automatic", highlight: true }
];

const PRICING_FAQ = [
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
            Start free.{" "}
            <span style={{ color: XRATED_BRAND.accent }}>Try every feature for 14 days.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Sign up free. Your first 14 days unlock every premium feature so
            you can build your full profile. After 14 days you either keep
            premium for £14.99/mo (or £139.99/yr) — or your profile stays{" "}
            <span className="font-bold text-white">free for life</span>, on a
            slightly limited tier. Either way the change is automatic. No
            card on signup.{" "}
            <span className="font-bold text-white">
              Claim your name now — one name, one account, forever.
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
              {COMPARE_ROWS.map((row) => (
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
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile — stacked card per row, 3-cell mini-table */}
        <ul className="mt-6 flex flex-col gap-2.5 sm:hidden">
          {COMPARE_ROWS.map((row) => (
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
          ))}
        </ul>
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
