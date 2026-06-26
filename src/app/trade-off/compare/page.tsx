// Xrated Trades — "Why choose us?" comparison page.
// Hero -> 4-column feature comparison table (Facebook / Website /
// XRatedTrade with yellow-highlighted Xrated column) -> 3 testimonial
// cards -> narrative side-by-side -> closing CTA.
// Server-only; matches the design system in /trade-off/pricing.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Why choose Xrated Trades? Stop juggling Facebook, a website and trade directories — use 1 link.",
  description:
    "Side-by-side comparison. Facebook posts disappear, websites cost £1k+ and break, trade directories rent you visibility for £100/mo. Xrated is one short xratedtrade.com URL — £14.99/mo, no card on signup.",
  alternates: { canonical: "/trade-off/compare" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Xrated Trades — Stop juggling 5 tools. Use 1 link.",
    description:
      "WhatsApp, reviews, service cards with prices, shareable link, built for trades — Xrated does in one URL what tradies were stitching together across Facebook, a website and trade directories.",
    url: absolute("/trade-off/compare")
  }
};

type Cmp = string | boolean;
type Row = {
  feature: string;
  facebook: Cmp;
  website: Cmp;
  xrated: Cmp;
};

const ROWS: Row[] = [
  {
    feature: "WhatsApp button",
    facebook: false,
    website: "Optional",
    xrated: true
  },
  {
    feature: "Customer reviews",
    facebook: "Limited",
    website: "Optional",
    xrated: true
  },
  {
    feature: "Service cards with prices",
    facebook: false,
    website: true,
    xrated: true
  },
  {
    feature: "Shareable link",
    facebook: false,
    website: "Long URL",
    xrated: "Short URL"
  },
  {
    feature: "Built for trades",
    facebook: false,
    website: false,
    xrated: true
  },
  {
    feature: "Cost",
    facebook: "Ads only",
    website: "£1k+ setup",
    xrated: "£14.99/mo"
  },
  {
    feature: "Time to launch",
    facebook: "Instant",
    website: "Weeks",
    xrated: "5 minutes"
  },
  {
    feature: "Updates",
    facebook: "Manual",
    website: "Expensive",
    xrated: "Free + automatic"
  }
];

type Testimonial = {
  initials: string;
  quote: string;
  name: string;
  trade: string;
  city: string;
  tint: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    initials: "DW",
    quote:
      "Cancelled my trade directory the week I signed up. Customers send me a WhatsApp the same minute they open the link.",
    name: "Dave W.",
    trade: "Plumber",
    city: "Manchester",
    tint: "#1E88E5"
  },
  {
    initials: "AK",
    quote:
      "I tried to build a Wix site for two years. Did Xrated in twenty minutes on the train. Pictures, prices, reviews, done.",
    name: "Adi K.",
    trade: "Electrician",
    city: "Birmingham",
    tint: "#43A047"
  },
  {
    initials: "TM",
    quote:
      "Stuck the QR sticker on the van and on three jobs I had two new bookings. Cheapest fifteen quid I have ever spent.",
    name: "Tom M.",
    trade: "Bricklayer",
    city: "Leeds",
    tint: "#E53935"
  }
];

export default function ComparePage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Compare
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Stop juggling 5 tools. Use{" "}
            <span style={{ color: XRATED_BRAND.accent }}>1 link</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Facebook page, Wix site, your trade-directory subscription, business cards
            with last year's number on them — most tradies are paying for four
            things to do the job of one short URL. Here is how Xrated stacks
            up against the rest.
          </p>
        </div>
      </section>

      {/* Section 1 — Comparison table */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Feature comparison
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          What you get from each channel — at a glance.
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
                  Facebook
                </th>
                <th className="w-32 px-3 py-3 text-center font-bold uppercase tracking-widest text-white/60">
                  Website
                </th>
                <th
                  className="w-40 px-3 py-3 text-center font-extrabold uppercase tracking-widest"
                  style={{
                    background: `${XRATED_BRAND.accent}26`,
                    color: XRATED_BRAND.accent
                  }}
                >
                  XRatedTrade
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {ROWS.map((row) => (
                <tr key={row.feature} className="border-t border-neutral-100">
                  <th className="px-4 py-3 text-left font-semibold text-neutral-800">
                    {row.feature}
                  </th>
                  <td className="px-3 py-3 text-center text-neutral-600">
                    <Cell value={row.facebook} />
                  </td>
                  <td className="px-3 py-3 text-center text-neutral-600">
                    <Cell value={row.website} />
                  </td>
                  <td
                    className="px-3 py-3 text-center font-bold text-neutral-900"
                    style={{ background: `${XRATED_BRAND.accent}10` }}
                  >
                    <Cell value={row.xrated} accent />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile — stacked card per row */}
        <ul className="mt-6 flex flex-col gap-2.5 sm:hidden">
          {ROWS.map((row) => (
            <li
              key={row.feature}
              className="rounded-xl border border-neutral-200 bg-white p-3"
            >
              <p className="text-xs font-bold text-neutral-900">{row.feature}</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[12px]">
                <div className="rounded-md bg-neutral-50 px-2 py-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                    Facebook
                  </p>
                  <p className="mt-0.5 text-neutral-600">
                    <Cell value={row.facebook} />
                  </p>
                </div>
                <div className="rounded-md bg-neutral-50 px-2 py-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                    Website
                  </p>
                  <p className="mt-0.5 text-neutral-600">
                    <Cell value={row.website} />
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
                    Xrated
                  </p>
                  <p className="mt-0.5 font-bold text-neutral-900">
                    <Cell value={row.xrated} accent />
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Section 2 — Testimonials */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          What other tradies on Xrated say
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Real quotes from real signups. First names + initial — full
          handles available on request.
        </p>

        <ul className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <li
              key={t.name}
              className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill={XRATED_BRAND.accent}
                aria-hidden="true"
              >
                <path d="M7 7h4l-2 5h2v6H4v-7l3-4zm10 0h4l-2 5h2v6h-7v-7l3-4z" />
              </svg>
              <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
                {t.quote}
              </p>
              <div className="mt-auto flex items-center gap-3">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-extrabold text-white"
                  style={{ background: t.tint }}
                  aria-hidden="true"
                >
                  {t.initials}
                </span>
                <div>
                  <p className="text-xs font-extrabold text-neutral-900 sm:text-sm">
                    {t.name}
                  </p>
                  <p className="text-[12px] text-neutral-500">
                    {t.trade} — {t.city}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Section 3 — Side-by-side narrative */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Side by side
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          The brutal honest comparison.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
          <NarrativeCard
            label="Facebook"
            title="Posts disappear after 48 hours."
            body="Your best job photo is buried under a cousin's holiday snaps by Friday. No prices, no service cards, no permanent link to send."
          />
          <NarrativeCard
            label="A website"
            title="£1k+ to build, breaks within a year."
            body="The agency vanishes, the template plugin breaks, the contact form stops emailing. Updating a price is a half-day job."
          />
          <NarrativeCard
            label="Trade directory"
            title="Rented visibility for £100/mo."
            body="Stop paying and your listing disappears. You never owned the page, the leads or the customer relationship."
          />
          <NarrativeCard
            label="Xrated Trades"
            title="One link. Owned forever. £14.99/mo. No card."
            body="Your name, your URL, your customers in WhatsApp. Edit anything from your phone in seconds. Cancel any time."
            accent
          />
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto mt-12 max-w-5xl px-4 pb-2 sm:px-6">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Less juggling. More jobs.
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Move everything to one link.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            14 days of every premium feature, no card on signup. Auto-
            downgrades to free for life on day 15 if you do not subscribe.
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
              Start free trial
            </a>
            <a
              href="/trade-off/pricing"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See pricing
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
  accent = false
}: {
  value: Cmp;
  accent?: boolean;
}) {
  if (value === true) {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full"
        style={{ background: accent ? XRATED_BRAND.accent : "#e5e5e5" }}
        aria-label="Yes"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent ? "#0A0A0A" : "#737373"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (value === false) {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100"
        aria-label="No"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </span>
    );
  }
  return (
    <span className={accent ? "font-bold text-neutral-900" : "text-neutral-600"}>
      {value}
    </span>
  );
}

function NarrativeCard({
  label,
  title,
  body,
  accent = false
}: {
  label: string;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <article
      className="rounded-2xl border p-5"
      style={
        accent
          ? { background: "#0A0A0A", borderColor: XRATED_BRAND.accent }
          : { background: "#ffffff", borderColor: "#e5e5e5" }
      }
    >
      <p
        className="text-[11px] font-extrabold uppercase tracking-[0.18em]"
        style={{ color: accent ? XRATED_BRAND.accent : "#a3a3a3" }}
      >
        {label}
      </p>
      <h3
        className="mt-2 text-sm font-extrabold sm:text-base"
        style={{ color: accent ? "#ffffff" : "#0A0A0A" }}
      >
        {title}
      </h3>
      <p
        className="mt-2 text-xs leading-relaxed sm:text-sm"
        style={{ color: accent ? "rgba(255,255,255,0.78)" : "#525252" }}
      >
        {body}
      </p>
    </article>
  );
}
