// Xrated Trades — /trade-off/why — "Why do I need one?" objection-
// handler page. Highest-priority page for a sceptical tradie who
// thinks their Facebook page / WhatsApp / business card / existing
// website is "good enough." Job: walk through each competing channel,
// show what it cannot do, then prove Xrated covers everything in one
// URL.
//
// Layout: hero ("Already got a Facebook page?") -> 5-card comparison
// grid (Facebook / WhatsApp / Business card / Website / Xrated) ->
// "What your customers actually want to see" bullet list -> "The
// 30-second tap" narrative paragraph -> closing CTA. Pattern + tokens
// match src/app/trade-off/pricing/page.tsx and /trade-off/what.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Why do I need Xrated Trades? Facebook, WhatsApp and business cards can't do this.",
  description:
    "Already have a Facebook page, a WhatsApp number, business cards or a basic website? Here's exactly what each one cannot do — and how Xrated Trades covers all of it on one shareable URL. Photos of real work, real reviews, your prices, instant WhatsApp and a verified badge. 14-day free trial, no card.",
  alternates: { canonical: "/trade-off/why" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Already got a Facebook page? Here's why that's not enough.",
    description:
      "Facebook posts disappear. WhatsApp can't show your prices. A business card can't show your reviews. A website costs £1,000+ and breaks. Xrated covers all of it on one URL. 14-day free trial.",
    url: absolute("/trade-off/why")
  }
};

type CompareCard = {
  title: string;
  status: "fail" | "win";
  problem: string;
  detail: string;
};

const COMPARE_CARDS: CompareCard[] = [
  {
    title: "Facebook page",
    status: "fail",
    problem: "Posts disappear in 48 hours.",
    detail:
      "Your best job is buried by Monday. The algorithm shows it to nobody you don't already know. And the customer needs a Facebook account just to see it."
  },
  {
    title: "WhatsApp alone",
    status: "fail",
    problem: "No prices, no portfolio, no proof.",
    detail:
      "The customer messages cold with no idea if you cost £200 or £2,000. You spend the next hour quoting blind. Three out of four conversations go silent."
  },
  {
    title: "Business card",
    status: "fail",
    problem: "Can't show reviews or real work.",
    detail:
      "Hands the customer your name and number — and nothing else. They Google you and find an old Yell.com listing, no photos, no idea who you are."
  },
  {
    title: "Custom website",
    status: "fail",
    problem: "£1,000+ to build, then it breaks.",
    detail:
      "Agency builds it once, then disappears. Domain renewal expires, the contact form stops working, the SSL certificate goes red. Customers see 'not secure' and leave."
  },
  {
    title: "Xrated Trades",
    status: "win",
    problem: "Everything in one URL.",
    detail:
      "Photos of real work, real customer reviews, services with prices, instant WhatsApp, a 60-second intro video and a verified badge. Updated from your phone in seconds. £14.99/mo, no upfront cost, no developer."
  }
];

const WANT_BULLETS = [
  {
    title: "Photos of real work you've done",
    body: "Not stock images. Not the same brochure shot every plumber on Google has. Real before-and-afters from real jobs."
  },
  {
    title: "Real reviews from real customers",
    body: "Names, dates, photos of the job they reviewed. Screenshots in WhatsApp don't count anymore."
  },
  {
    title: "Your prices — or at least a starting point",
    body: "£80 callout. £350/day. Boiler service from £120. A rough number tells the customer you're real and stops the tyre-kickers cold."
  },
  {
    title: "An instant WhatsApp button",
    body: "Not a contact form that emails you on Tuesday. One tap, prefilled message, conversation in seconds."
  },
  {
    title: "Proof you are who you say you are",
    body: "A verified badge backed by a company-registration check — so the customer knows you're a real registered trade, not a one-job ghost."
  }
];

export default function WhyPage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — eyebrow, headline with yellow accent on the channel
          the visitor is most likely defending ("Facebook"), and a
          subhead that frames the whole page as a like-for-like
          comparison. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Why Xrated
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Already got a{" "}
            <span style={{ color: XRATED_BRAND.accent }}>Facebook</span> page?
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Here's what Facebook, WhatsApp, business cards and websites
            can't do — and how Xrated covers all of it in one URL. No
            sales pitch, just five honest comparisons.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Honest like-for-like
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> 14-day free trial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> No card on signup
            </span>
          </div>
        </div>
      </section>

      {/* Section 1 — 5-card comparison grid. Four failure cards
          (red X) and one Xrated card (yellow tick) highlighted. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#7A5300" }}
        >
          Channel-by-channel
        </p>
        <h2 className="mt-2 text-xl font-extrabold text-neutral-900 sm:text-2xl">
          What every other channel can't do.
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-neutral-500 sm:text-sm">
          Four channels nearly every tradie already uses — and the one
          that does all four jobs at once.
        </p>

        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COMPARE_CARDS.map((card) => {
            const isWin = card.status === "win";
            return (
              <li
                key={card.title}
                className="flex h-full flex-col gap-2 rounded-2xl border p-4 sm:p-5"
                style={
                  isWin
                    ? {
                        background: `${XRATED_BRAND.accent}14`,
                        borderColor: XRATED_BRAND.accent,
                        boxShadow: `0 4px 14px ${XRATED_BRAND.accent}33`
                      }
                    : { borderColor: "#e5e5e5", background: "#ffffff" }
                }
              >
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    background: isWin ? XRATED_BRAND.accent : "#FEE2E2",
                    color: isWin ? "#0A0A0A" : "#991B1B"
                  }}
                  aria-hidden="true"
                >
                  {isWin ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  )}
                </span>
                <p className="text-sm font-extrabold text-neutral-900 sm:text-base">
                  {card.title}
                </p>
                <p
                  className="text-xs font-bold sm:text-sm"
                  style={{ color: isWin ? "#7A5300" : "#991B1B" }}
                >
                  {isWin ? "All of the above." : card.problem}
                </p>
                <p className="text-xs leading-relaxed text-neutral-600 sm:text-sm">
                  {card.detail}
                </p>
                {isWin && (
                  <span
                    className="mt-auto inline-flex items-center self-start rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider"
                    style={{ background: "#0A0A0A", color: XRATED_BRAND.accent }}
                  >
                    All five jobs, one URL
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Section 2 — what the customer actually wants. Punchy bullet
          list, each row a one-line headline + one short body line. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#7A5300" }}
        >
          Customer side
        </p>
        <h2 className="mt-2 text-xl font-extrabold text-neutral-900 sm:text-2xl">
          What your customers actually want to see before they hire you.
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-neutral-500 sm:text-sm">
          We asked. Here's the five things that turn a "maybe" into a
          booked job.
        </p>

        <ul className="mt-6 flex flex-col gap-3">
          {WANT_BULLETS.map((item, idx) => (
            <li
              key={item.title}
              className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:gap-4 sm:p-5"
            >
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold sm:h-10 sm:w-10 sm:text-sm"
                style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
                aria-hidden="true"
              >
                {idx + 1}
              </span>
              <div>
                <p className="text-sm font-extrabold text-neutral-900 sm:text-base">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Section 3 — "The 30-second tap" narrative. Single black
          surface card with one tight paragraph that paints the
          customer journey, plus a tiny step-by-step strip below. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            The 30-second tap
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-3xl">
            From scroll to conversation, in 30 seconds.
          </h2>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            A customer is scrolling Instagram on the bus. They tap your
            bio link. Your Xrated profile loads — photos of last week's
            extension, four 5-star reviews, the price for a callout, the
            services you actually offer, a 60-second video of you on
            site. They tap the green WhatsApp button. The message is
            prefilled with the job they want a quote for. You're talking
            in seconds. No form, no email Tuesday, no "I'll think about
            it." That's the entire pitch.
          </p>
          <ol className="mt-6 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-5 sm:text-xs">
            {[
              "Scrolls Instagram",
              "Taps your bio link",
              "Sees work + prices",
              "Reads reviews",
              "Taps WhatsApp"
            ].map((step, idx) => (
              <li
                key={step}
                className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5 text-white/85"
              >
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                  style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
                  aria-hidden="true"
                >
                  {idx + 1}
                </span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing CTA — same pattern as /trade-off/what. */}
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
            See it for yourself. Free 14 days.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            Build the full profile, share the URL, see if it works for
            you. No card on signup. Auto-downgrades to the free-for-life
            tier on day 15 if you don't subscribe.
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
              Start free — 14 day trial
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

function Dot({ accent = false }: { accent?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: accent ? XRATED_BRAND.accent : "rgba(255,255,255,0.6)" }}
    />
  );
}
