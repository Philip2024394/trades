// Xrated Trades — Tips for Trades SEO content hub.
// 8-card grid of article previews aimed at the long-tail search queries
// tradies type into Google ("how to price brickwork", "win more jobs",
// "QR codes on vans"). Each card links to a future deep-dive article;
// for now the targets are '#' placeholders. Bottom invites tradies to
// submit their own tips to tips@xratedtrade.com.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Tips for Trades — Xrated Trades. Win more jobs, get paid more.",
  description:
    "Practical advice from real tradespeople — how to win customers on social, how to price your work, how to photograph jobs, how to collect reviews and how to use QR codes on the van. Free guides for working trades.",
  alternates: { canonical: "/trade-off/tips" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Tips for Trades — win more jobs, get paid more.",
    description:
      "Real tradesperson tips on pricing, photography, social media, WhatsApp, QR codes, reviews and customer-facing mistakes to avoid.",
    url: absolute("/trade-off/tips")
  }
};

type TipCard = {
  category: string;
  title: string;
  excerpt: string;
  // Two-stop gradient used for the card's hero placeholder block when
  // no `image` is set — gives each card a distinct visual signature.
  gradientFrom: string;
  gradientTo: string;
  // Optional real photo — when present, replaces the gradient block.
  image?: string;
  alt?: string;
};

const TIPS: TipCard[] = [
  {
    category: "Marketing",
    title: "How to win more customers from social media",
    excerpt:
      "Posting your finished work isn't enough. The exact post structure that turns scrollers into enquiries — captions, hashtags, posting cadence.",
    gradientFrom: "#FFB300",
    gradientTo: "#FF6B00"
  },
  {
    category: "Pricing",
    title: "The best way to price brickwork (and other trades)",
    excerpt:
      "Day-rate vs. per-square-metre vs. fixed-price quotes — which one wins more jobs at a healthier margin, broken down by trade.",
    gradientFrom: "#0A0A0A",
    gradientTo: "#3B2200"
  },
  {
    category: "Photography",
    title: "How to photograph your work like a pro",
    excerpt:
      "Phone-camera angles, lighting tricks, and the before/after shot order that triples click-through on your Xrated profile.",
    gradientFrom: "#1F6FEB",
    gradientTo: "#0A0A0A"
  },
  {
    category: "WhatsApp",
    title: "WhatsApp Business tips for tradies",
    excerpt:
      "Quick-reply templates, auto-replies for out-of-hours, and the catalogue feature most tradies don't know exists.",
    gradientFrom: "#25D366",
    gradientTo: "#0A0A0A"
  },
  {
    category: "Van + signage",
    title: "QR codes on vans: a practical guide",
    excerpt:
      "Where to put the QR, what size to print it, what page to point it at, and the one design mistake that makes it unscannable from 6ft away.",
    gradientFrom: "#FFB300",
    gradientTo: "#0A0A0A"
  },
  {
    category: "Reviews",
    title: "How to collect reviews customers actually leave",
    excerpt:
      "The exact moment to ask, the exact words to use, and the one-tap link that takes review-collection rate from 12% to 70%.",
    gradientFrom: "#C026D3",
    gradientTo: "#3B0764",
    image:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2005_57_40%20AM.png?updatedAt=1782514693735",
    alt: "How to collect reviews — five-star feedback on a customer's phone"
  },
  {
    category: "Customer service",
    title: "5 customer-facing mistakes most tradies make",
    excerpt:
      "Voicemail that loses jobs, quotes that don't get accepted, the no-show problem and how to fix all of it in under a week.",
    gradientFrom: "#DC2626",
    gradientTo: "#0A0A0A",
    image:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2007_04_17%20AM.png?updatedAt=1782518691172",
    alt: "5 customer-facing mistakes most tradies make"
  },
  {
    category: "Bigger jobs",
    title: "How to use Xrated reviews to win bigger jobs",
    excerpt:
      "Commercial and trade buyers read reviews differently. How to curate, pin and present them so you win £10k+ jobs, not £200 jobs.",
    gradientFrom: "#0F766E",
    gradientTo: "#0A0A0A"
  }
];

export default function TipsPage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — black surface, yellow accent on H1 */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto grid max-w-5xl gap-8 px-4 pb-12 pt-12 sm:grid-cols-[1fr,auto] sm:items-center sm:gap-10 sm:px-6 sm:pb-16 sm:pt-16">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-[0.22em]"
              style={{ color: XRATED_BRAND.accent }}
            >
              Tips for Trades
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
              Win{" "}
              <span style={{ color: XRATED_BRAND.accent }}>more</span> jobs.
              Get paid{" "}
              <span style={{ color: XRATED_BRAND.accent }}>more</span>.
            </h1>
            <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
              Practical advice from real tradespeople — pricing, photography,
              social media, WhatsApp, QR codes, reviews and the customer-
              facing mistakes that quietly kill enquiries.
            </p>
          </div>
          {/* Hero artwork — sits to the right on desktop, stacks below on
              mobile. Yellow border + offset shadow gives it the brand
              chip without overpowering the headline. */}
          <div className="relative w-full max-w-[280px] justify-self-start overflow-hidden rounded-2xl sm:justify-self-end">
            <div
              className="absolute -inset-2 rounded-3xl"
              style={{ background: `${XRATED_BRAND.accent}33`, filter: "blur(12px)" }}
              aria-hidden="true"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2005_53_00%20AM.png?updatedAt=1782514405219"
              alt="Win more jobs, get paid more — tradesperson on site"
              className="relative w-full rounded-2xl border-2 object-cover shadow-xl"
              style={{ borderColor: XRATED_BRAND.accent }}
            />
          </div>
        </div>
      </section>

      {/* Tips grid — 8 cards, 2 columns on tablet, 4 on wide */}
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Latest guides
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Short reads written for working tradies, not marketers.
        </p>

        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {TIPS.map((tip) => (
            <li key={tip.title}>
              <a
                href="#"
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {/* Hero — real photo if present, else gradient placeholder */}
                {tip.image ? (
                  <div className="relative h-32 w-full overflow-hidden sm:h-36">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tip.image}
                      alt={tip.alt ?? tip.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="relative h-32 w-full sm:h-36"
                    style={{
                      background: `linear-gradient(135deg, ${tip.gradientFrom} 0%, ${tip.gradientTo} 100%)`
                    }}
                    aria-hidden="true"
                  >
                    <div className="absolute inset-0 opacity-25 mix-blend-overlay" style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 50%)" }} />
                  </div>
                )}

                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <p
                    className="text-[11px] font-extrabold uppercase tracking-widest"
                    style={{ color: XRATED_BRAND.accent }}
                  >
                    {tip.category}
                  </p>
                  <h3 className="mt-1.5 text-sm font-extrabold leading-snug text-neutral-900 sm:text-base">
                    {tip.title}
                  </h3>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                    {tip.excerpt}
                  </p>
                  <span
                    className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-neutral-900 transition group-hover:gap-2 sm:text-sm"
                    style={{ color: "#0A0A0A" }}
                  >
                    Read{" "}
                    <span style={{ color: XRATED_BRAND.accent }}>&rarr;</span>
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Submit-a-tip invitation — yellow callout box */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <div
          className="overflow-hidden rounded-2xl border-2 p-5 sm:p-7"
          style={{
            borderColor: XRATED_BRAND.accent,
            background: `${XRATED_BRAND.accent}12`
          }}
        >
          <p className="text-xs font-extrabold uppercase tracking-widest text-neutral-900">
            Got a tip to share?
          </p>
          <h2 className="mt-2 text-lg font-extrabold text-neutral-900 sm:text-xl">
            Help the trade. Email us.
          </h2>
          <p className="mt-3 text-xs leading-relaxed text-neutral-800 sm:text-sm">
            The best tips on this page come from tradies who've solved a
            problem the hard way and want to save the next person the
            headache. If you have a pricing trick, a photography habit, a
            WhatsApp template or a customer-handling move that works for
            you — email it to{" "}
            <a
              href="mailto:tips@xratedtrade.com"
              className="font-extrabold underline"
              style={{ color: "#0A0A0A" }}
            >
              tips@xratedtrade.com
            </a>
            . We credit every published tip with your name, your trade
            and a link back to your Xrated profile.
          </p>
        </div>
      </section>

      {/* Closing CTA — mirrors pricing-page rhythm */}
      <section className="mx-auto mt-12 max-w-5xl px-4 pb-2 sm:px-6">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Ready to put the tips to work?
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Claim your name. Start free.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            Full Paid-tier access for 14 days. No card on signup. Your
            slug stays yours forever, even if you stay on Free.
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
              Join XratedTrade
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
