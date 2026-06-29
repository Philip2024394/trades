// Xrated Trades — Tips guide: pricing trade work.
// Long-form Article-schema page targeting "how to price brickwork",
// "tradesperson day rate" + related long-tail queries. Server
// component, reuses XratedHeader/Footer. Honest where the answer is
// "it depends" — no fabricated rates.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { CaseStudyCallout } from "@/components/xrated/tips/CaseStudyCallout";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { TRADE_OFF_HERO_IMAGES } from "@/lib/tradeOffHeroes";

export const revalidate = 3600;

const TITLE = "The best way to price brickwork (and other trades)";
const DESCRIPTION =
  "Day rate, per-square-metre or fixed price — which one wins more jobs at a healthier margin. An honest guide to pricing your trade, written for working tradies.";
const SLUG = "/trade-off/tips/pricing-trade-work";
const HERO =
  "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/guide-pricing-trade-work.png";

export const metadata: Metadata = {
  title: `${TITLE} | xratedtrade.com guides`,
  description: DESCRIPTION,
  alternates: { canonical: SLUG },
  openGraph: {
    type: "article",
    siteName: BRAND.name,
    title: TITLE,
    description: DESCRIPTION,
    url: absolute(SLUG),
    images: [{ url: HERO, alt: TITLE }]
  }
};

const ARTICLE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  author: { "@type": "Organization", name: "xratedtrade.com" },
  publisher: {
    "@type": "Organization",
    name: "xratedtrade.com",
    logo: { "@type": "ImageObject", url: BRAND.logo }
  },
  datePublished: "2026-06-28",
  dateModified: "2026-06-28",
  description: DESCRIPTION,
  mainEntityOfPage: { "@type": "WebPage", "@id": absolute(SLUG) },
  image: HERO
};

export default function GuidePricingTradeWork() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_JSONLD) }}
      />

      <article className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <a
          href="/trade-off/tips"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-neutral-500 transition hover:text-neutral-900"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to all tips
        </a>

        <TopicBadge>Pricing</TopicBadge>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
          There’s no single right answer to what you should charge.
          But there is a right <em>way</em> to think about it — and
          most tradies get it wrong the first five years. Here’s
          the framework.
        </p>
        <Byline minutes={9} />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO}
          alt="Bricklayer at work — the brickwork example used throughout this guide"
          className="mt-6 w-full rounded-2xl border border-neutral-200 object-cover"
        />

        <Section heading="1. There are only three pricing models">
          <p>
            Every quote you write is one of three things: a day rate, a
            per-unit rate, or a fixed price. Knowing which to use is
            half the battle.
          </p>
          <Bullets>
            <li>
              <strong>Day rate</strong> — you charge for time. Best
              when the scope is unknown or changeable.
            </li>
            <li>
              <strong>Per-unit</strong> — per square metre, per
              linear metre, per board, per point. Best for repeatable
              work where you can measure the job up front.
            </li>
            <li>
              <strong>Fixed price</strong> — one number for the
              whole job. Best when the scope is crystal clear and you
              have done the same job recently enough to know the cost.
            </li>
          </Bullets>
          <p>
            The mistake most tradies make is using a fixed price for
            unknown-scope work (then arguing about variations later) or
            using a day rate for repeatable work (and quietly losing money
            on the days they finish early).
          </p>
        </Section>

        <Section heading="2. Setting a day rate without underpricing">
          <p>
            Pick a number out of the air and you will either lose work
            or work for nothing. Here is the calculation. Add up
            everything it costs to run the business in a year —
            van lease or finance, fuel, insurance (public liability,
            employer’s, vehicle), tools and consumables you replace
            each year, workshop or storage rent, accountant, pension
            contributions, holiday allowance, sick allowance. That is your
            cost to be in business.
          </p>
          <p>
            Divide that by the number of working days you can realistically
            bill in a year — not 365, not 250, more like 180 to
            200 once you take out weekends, holidays, weather days,
            quoting days and admin days. That gives you your break-even
            day rate. Now add your wage on top. Then add a margin (15-30%)
            for the things you forgot. <em>That</em> is your day rate.
          </p>
          <Callout>
            Why this works: it makes underpricing visible. If your number
            comes out higher than what locals charge, you know your
            overheads are out of line — not your pricing.
          </Callout>
        </Section>

        <Section heading="3. Per-unit pricing — the brickwork example">
          <p>
            Brickwork is the classic per-unit job. Most bricklayers
            price per thousand bricks laid, or per square metre of
            face brickwork. The rate varies hugely by region, brick
            type (handmade vs wirecut), bond pattern (stretcher vs
            Flemish), height (anything above scaffold level adds time)
            and weather window.
          </p>
          <p>
            The honest answer is: ask three other brickies in your
            postcode what they charge per thousand <em>before</em>{" "}
            quoting your first big job. Most will tell you. The
            tradesperson community is small enough that knowing the
            market keeps everyone’s rates sensible. The same logic
            works for tilers (per square metre), sparks (per point),
            plasterers (per wall), painters (per coat per square metre).
          </p>
        </Section>

        <Section heading="4. When fixed price is the right call">
          <p>
            Fixed price wins on jobs where the scope is completely
            defined and you have done the same job recently. A kitchen
            re-fit where the units are already on order, a re-roof on a
            standard semi, a bathroom replace-like-for-like —
            these are quotable to the pound, and customers prefer the
            certainty.
          </p>
          <p>
            On a fixed price, build a 10-15% contingency into the number
            <em> before</em> you tell them. Things go wrong. Hidden
            joists. Asbestos cement under the lino. Pipework that
            doesn’t match the drawing. The contingency is the
            difference between “I lost money on that one” and
            “the job came in on budget”.
          </p>
        </Section>

        <Section heading="5. The ‘discount to land the job’ trap">
          <p>
            A customer says “your quote is the highest we’ve
            had”. The instinct is to come down 10% to win the job.
            Don’t. The customer who haggles before the job starts
            is the customer who haggles at the end too. You will end
            up doing the same work for less money and a worse review.
          </p>
          <p>
            What works instead: hold your number, take something out of
            the spec to match the lower budget, and let the customer
            choose. “I can’t come down on price, but if we
            move to a standard worktop instead of the quartz, that saves
            you &pound;800.” You keep your margin. They make the
            decision. Everyone leaves the conversation respecting each
            other.
          </p>
        </Section>

        <Section heading="6. Always quote in writing">
          <p>
            A WhatsApp message saying “yeah, about three grand”
            is not a quote. It is a future argument. Every quote goes in
            writing — a one-page PDF or even a clear WhatsApp
            message with line items, a total, what is included, what is
            not included, payment terms and a validity date (30 days is
            the norm).
          </p>
          <p>
            This protects you legally and stops the slow drift of
            “while you’re here, can you also...”. If
            it’s not on the quote, it’s a separate piece of
            work at an agreed extra. In writing.
          </p>
        </Section>

        <Section heading="7. When to walk away from a price haggle">
          <p>
            If a customer is asking for more than 20% off your quote
            before the job has started, walk away. The conversation is
            telling you everything you need to know about how the rest
            of the job will go. You will not make it up on volume. You
            will not “build a relationship”. You will lose
            money and gain stress.
          </p>
          <p>
            The trade equivalent of “customer always right”
            is “the customer who values your work pays your
            number”. Trust that. Polite no’s now mean better
            jobs later.
          </p>
        </Section>

        <Section heading="8. Review your rates every six months">
          <p>
            Materials go up. Insurance goes up. Your skill goes up. Your
            rate should follow. Twice a year, look at your last fifty
            jobs — the actual time they took, the actual margin
            they made — and adjust. The tradies who stay solvent
            for thirty years are not the cheapest. They are the ones
            who know their numbers.
          </p>
        </Section>

        <CaseStudyCallout
          slug="demo-marcus-okafor-drywaller-manchester"
          title="See how Marcus prices his work →"
          subtitle="Drywaller in Manchester — every quote written down with the metalwork spec, board grade and acoustic rating spelled out. Real worked examples in £ per linear m."
        />

        <ClosingCta />
      </article>

      <XratedFooter />
    </main>
  );
}

function TopicBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900"
      style={{ background: XRATED_BRAND.accent }}
    >
      {children}
    </span>
  );
}

function Byline({ minutes }: { minutes: number }) {
  return (
    <p className="mt-4 text-[13px] text-neutral-500">
      {minutes} min read · The xratedtrade.com team
    </p>
  );
}

function Section({
  heading,
  children
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-extrabold leading-snug text-neutral-900 sm:text-2xl">
        {heading}
      </h2>
      <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
        {children}
      </div>
    </section>
  );
}

function Bullets({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-5 list-disc space-y-2 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
      {children}
    </ul>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border-l-4 bg-neutral-50 p-4 text-[14px] leading-relaxed text-neutral-800 sm:text-[15px]"
      style={{ borderLeftColor: XRATED_BRAND.accent }}
    >
      {children}
    </div>
  );
}

function ClosingCta() {
  return (
    <section
      className="mt-12 overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-10"
      style={{ background: "#0A0A0A" }}
    >
      <p
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color: XRATED_BRAND.accent }}
      >
        Try Xrated Trades
      </p>
      <h2 className="mt-2 text-xl font-extrabold leading-tight text-white sm:text-3xl">
        Free for 14 days. No card. No commission.
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-[13px] text-white/80 sm:text-sm">
        Claim your name, publish your services and prices, send every
        customer the same one-link quote.
      </p>
      <a
        href="/trade-off/signup"
        className="mt-5 inline-flex h-12 items-center gap-2 rounded-lg px-6 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
        style={{
          background: XRATED_BRAND.accent,
          boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
        }}
      >
        Join XratedTrade
      </a>
    </section>
  );
}
