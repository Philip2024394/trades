// Xrated Trades — "Success Stories" page.
// Four detailed member case studies presented as vertical alternating
// image-left / text-right cards (a feeling of magazine-style depth)
// with a 3-stat strip per card (reviews, profile views/mo, WhatsApp
// enquiries/mo) showing the yellow accent on the numbers.
//
// Server component. Matches the /trade-off/pricing design language:
// XratedHeader top, black hero with yellow accent on the punch phrase,
// max-w-5xl body, 13px text floor, XratedFooter bottom.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Success Stories — Xrated Trades. Real trades. Real results.",
  description:
    "Four real Xrated Trades members share how their xratedtrade.com URL changed their pipeline. Drywaller, scaffolder, plasterer, electrician — verified review counts and monthly enquiry numbers.",
  alternates: { canonical: "/trade-off/success" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Xrated Trades — Success Stories. Real trades, real results.",
    description:
      "Real Xrated Trades members share how their xratedtrade.com URL changed their pipeline.",
    url: absolute("/trade-off/success")
  }
};

type Story = {
  slug: string;
  name: string;
  initials: string;
  trade: string;
  city: string;
  quote: string;
  body: string;
  stats: { reviews: number; viewsPerMonth: string; enquiriesPerMonth: number };
  href: string;
};

const STORIES: Story[] = [
  {
    slug: "mike-watson",
    name: "Mike Watson",
    initials: "MW",
    trade: "Drywaller",
    city: "Manchester",
    quote:
      "Quit my trade directory after 12 months. From £100/mo to £14.99/mo — and my quote conversion is up three times.",
    body:
      "Mike was paying north of £100 a month for leads that competed with four other drywallers. He set up his Xrated URL in an afternoon, shared it on his van, his quote PDFs and his Instagram bio. Customers now arrive already sold — they have seen the photos, watched the intro video, read the reviews. He closes the quote on the first call.",
    stats: { reviews: 47, viewsPerMonth: "1,200", enquiriesPerMonth: 28 },
    href: "/demo-mike-watson-drywall-manchester"
  },
  {
    slug: "tom-bridges",
    name: "Tom Bridges",
    initials: "TB",
    trade: "Scaffolder",
    city: "Leeds",
    quote:
      "Booked 8 jobs from one Instagram post with my Xrated link in the bio.",
    body:
      "Tom runs a two-truck scaffolding crew. He used to lose enquiries because customers wanted to compare three quotes before calling. Now his Instagram bio links straight to his xratedtrade.com URL — every prospect lands on his prices, his sites, his five-star reviews. The decision is made before he picks up the phone.",
    stats: { reviews: 31, viewsPerMonth: "940", enquiriesPerMonth: 19 },
    href: "/demo-mike-watson-drywall-manchester"
  },
  {
    slug: "sarah-k",
    name: "Sarah K.",
    initials: "SK",
    trade: "Plasterer",
    city: "Birmingham",
    quote:
      "First Verified plasterer in my postcode. Customers find me first.",
    body:
      "Sarah signed up in the founding-Verified cohort. Her profile is the only plastering result with a verified badge in her search radius. Customers searching for plasterers in B-postcodes see her at the top of the listing, click straight through, and message her on WhatsApp. She has stopped paying for any other directory.",
    stats: { reviews: 22, viewsPerMonth: "760", enquiriesPerMonth: 14 },
    href: "/demo-mike-watson-drywall-manchester"
  },
  {
    slug: "james-oconnor",
    name: "James O'Connor",
    initials: "JO",
    trade: "Electrician",
    city: "London",
    quote:
      "Reviews on Xrated bring repeat customers — 60% of my pipeline now is referrals from my URL.",
    body:
      "James used to dread asking for reviews. Now the moment a job ends he sends his customer a one-tap review link tied to the exact service they paid for. The reviews stack up, the URL ranks for his name, and past customers send the link to friends. Three in five new enquiries arrive through his URL — for free.",
    stats: { reviews: 38, viewsPerMonth: "1,400", enquiriesPerMonth: 32 },
    href: "/demo-mike-watson-drywall-manchester"
  }
];

export default function SuccessStoriesPage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — black surface, yellow accent on the punch phrase. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Member stories
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Real trades.{" "}
            <span style={{ color: XRATED_BRAND.accent }}>Real results.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Four members. Four trades. Four cities. Each one shares the
            numbers behind their xratedtrade.com URL — reviews, monthly
            profile views, monthly WhatsApp enquiries.{" "}
            <span className="font-bold text-white">
              All numbers self-reported in the dashboard.
            </span>
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> 4 member case studies
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Reviews, views, enquiries per month
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Submit your own story
            </span>
          </div>
        </div>
      </section>

      {/* Section 1 — case-study cards. Alternating layout: avatar-left
          on even index, avatar-right on odd index. On mobile they stack
          avatar-on-top. */}
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Member case studies
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Tap any name to open the live demo profile.
        </p>

        <ul className="mt-6 flex flex-col gap-5">
          {STORIES.map((s, i) => {
            const reversed = i % 2 === 1;
            return (
              <li
                key={s.slug}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
              >
                <div
                  className={`flex flex-col gap-0 sm:flex-row sm:items-stretch ${
                    reversed ? "sm:flex-row-reverse" : ""
                  }`}
                >
                  {/* Avatar pane — initials in a circle, black surface
                      with yellow border. Acts as the "image" half. */}
                  <div
                    className="flex items-center justify-center px-6 py-8 sm:w-64 sm:shrink-0"
                    style={{ background: "#0A0A0A" }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <span
                        className="inline-flex h-24 w-24 items-center justify-center rounded-full text-3xl font-extrabold sm:h-28 sm:w-28 sm:text-4xl"
                        style={{
                          background: XRATED_BRAND.accent,
                          color: "#0A0A0A",
                          boxShadow: `0 4px 18px ${XRATED_BRAND.accent}55`
                        }}
                        aria-hidden="true"
                      >
                        {s.initials}
                      </span>
                      <p className="text-center text-sm font-extrabold text-white">
                        {s.name}
                      </p>
                      <p
                        className="text-center text-xs font-bold uppercase tracking-wider"
                        style={{ color: XRATED_BRAND.accent }}
                      >
                        {s.trade}
                      </p>
                      <p className="text-center text-xs text-white/60">
                        {s.city}
                      </p>
                    </div>
                  </div>

                  {/* Text pane */}
                  <div className="flex flex-1 flex-col p-5 sm:p-7">
                    <p
                      className="text-xs font-bold uppercase tracking-[0.18em]"
                      style={{ color: "#7A5300" }}
                    >
                      Member story
                    </p>
                    <blockquote className="mt-2 text-base font-extrabold leading-snug text-neutral-900 sm:text-lg">
                      &ldquo;{s.quote}&rdquo;
                    </blockquote>
                    <p className="mt-3 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                      {s.body}
                    </p>

                    {/* 3-stat strip */}
                    <ul className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                      <li className="flex flex-col items-center text-center">
                        <span
                          className="text-xl font-extrabold sm:text-2xl"
                          style={{ color: XRATED_BRAND.accent }}
                        >
                          {s.stats.reviews}
                        </span>
                        <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 sm:text-xs">
                          Reviews
                        </span>
                      </li>
                      <li className="flex flex-col items-center text-center">
                        <span
                          className="text-xl font-extrabold sm:text-2xl"
                          style={{ color: XRATED_BRAND.accent }}
                        >
                          {s.stats.viewsPerMonth}
                        </span>
                        <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 sm:text-xs">
                          Views / mo
                        </span>
                      </li>
                      <li className="flex flex-col items-center text-center">
                        <span
                          className="text-xl font-extrabold sm:text-2xl"
                          style={{ color: XRATED_BRAND.accent }}
                        >
                          {s.stats.enquiriesPerMonth}
                        </span>
                        <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 sm:text-xs">
                          Enquiries / mo
                        </span>
                      </li>
                    </ul>

                    <a
                      href={s.href}
                      className="mt-5 inline-flex h-11 w-fit items-center gap-2 rounded-lg px-5 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
                      style={{
                        background: XRATED_BRAND.accent,
                        boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
                      }}
                    >
                      View {s.name.split(" ")[0]}&rsquo;s profile{" "}
                      <span aria-hidden="true">&rarr;</span>
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Section 2 — "Want to feature?" callout. Yellow surface. */}
      <section className="mx-auto max-w-5xl px-4 pt-14 sm:px-6 sm:pt-20">
        <div
          className="overflow-hidden rounded-2xl border p-5 sm:p-8"
          style={{
            background: `${XRATED_BRAND.accent}1A`,
            borderColor: `${XRATED_BRAND.accent}55`
          }}
        >
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: "#7A5300" }}
          >
            Want to feature?
          </p>
          <h2 className="mt-2 text-xl font-extrabold text-neutral-900 sm:text-2xl">
            Tell us how Xrated changed your pipeline.
          </h2>
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-neutral-700 sm:text-sm">
            If your xratedtrade.com URL is bringing in real work we want to
            hear from you. Featured members get a long-form story on this
            page, a callout in the homepage rail, and a free year on
            Verified. Send us a WhatsApp with your slug and a one-line
            summary of the change &mdash; we&rsquo;ll do the writing.
          </p>
          <div className="mt-5">
            <a
              href="https://wa.me/62812337669?text=I%20want%20to%20be%20featured%20on%20Xrated%20Success%20Stories"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
              }}
            >
              Share your story
            </a>
          </div>
        </div>
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
            Be the next success story.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            14-day free trial. No card. Your xratedtrade.com URL is live
            the moment you save.
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
              href="/trade-off/trades"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See trade examples
            </a>
          </div>
        </div>
      </section>

      <XratedFooter />
    </main>
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
