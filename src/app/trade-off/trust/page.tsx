// Xrated Trades — Trust Score signature feature page.
// The Trust Score is a single 0-100 number that summarises every trust
// signal on a tradie's profile: profile completeness, video, reviews,
// services with prices, WhatsApp button, verified badge, insurance. The
// score updates live as the tradesperson ticks each item. This is the
// signature feature of the platform — the page is built to be the most
// visually impressive in the trade-off marketing surface.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Trust Score — Build your Trust Score. Win more jobs. | Xrated Trades",
  description:
    "A single 0-100 score that shows customers at a glance you are the safest choice. Earn points for a complete profile, video, reviews, prices, WhatsApp, verified badge and insurance.",
  alternates: { canonical: "/trade-off/trust" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Build your Trust Score. Win more jobs.",
    description:
      "One score, 0-100, summarising every trust signal on your profile. Updates live as you tick each item. Verified profiles win 3x more enquiries.",
    url: absolute("/trade-off/trust")
  }
};

type ChecklistItem = {
  icon: string;
  label: string;
  points: number;
  tip: string;
  achieved: boolean;
};

// Eight items make up the Trust Score. The mock profile in the hero
// shows 7 of 8 ticked (no insurance uploaded yet) — which is how we
// arrive at the 92/100 hero number. Each item below carries its weight
// and a 1-line tip for the "How to get to 100" section.
const CHECKLIST: ChecklistItem[] = [
  {
    icon: "U",
    label: "Profile complete 100%",
    points: 15,
    tip: "Bio, photo, trade, service area, hours. The basics — done once, done forever.",
    achieved: true
  },
  {
    icon: "V",
    label: "Company video uploaded",
    points: 10,
    tip: "60-second clip introducing yourself or showing a recent job. Customers connect with a face.",
    achieved: true
  },
  {
    icon: "R",
    label: "12+ customer reviews",
    points: 20,
    tip: "Verified reviews are the heaviest single signal. Ask every customer after every job.",
    achieved: true
  },
  {
    icon: "S",
    label: "Services listed",
    points: 10,
    tip: "Add at least 4 services with photos. The card grid is the conversion unit of your profile.",
    achieved: true
  },
  {
    icon: "P",
    label: "Prices shown",
    points: 10,
    tip: "A real number or 'from-price' on every service. 67% of customers will not hire without a price upfront.",
    achieved: true
  },
  {
    icon: "W",
    label: "WhatsApp enabled",
    points: 7,
    tip: "Connect your business number so the Enquire button lands the lead in your phone in seconds.",
    achieved: true
  },
  {
    icon: "B",
    label: "Verified badge",
    points: 20,
    tip: "Upgrade to the Verified tier (£19.99/mo). We check active company registration. Verified profiles win 3x more enquiries.",
    achieved: true
  },
  {
    icon: "I",
    label: "Insurance uploaded",
    points: 8,
    tip: "Upload public-liability + employer's certificate to earn the 'Insured for private work' add-on badge.",
    achieved: false
  }
];

// Mini stats for "Why customers look for a high score".
const TRUST_STATS: { stat: string; label: string }[] = [
  { stat: "86%", label: "of customers read reviews before hiring" },
  { stat: "67%", label: "will not hire a tradie who does not list prices" },
  { stat: "3x", label: "more enquiries land on Verified profiles" }
];

// Hero score — 92/100 (everything except Insurance ticked).
const HERO_SCORE = 92;
const HERO_MAX = 100;

export default function TrustScorePage() {
  // Build the circular-gauge stroke math once at render time. SVG
  // arc-length on a circle is 2*pi*r; the dashoffset is the unfilled
  // remainder. r=80 gives a generous, readable gauge at any breakpoint.
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const filled = (HERO_SCORE / HERO_MAX) * circumference;
  const offset = circumference - filled;

  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — black surface, yellow accent on the signature phrase. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Build Trust
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Build your{" "}
            <span style={{ color: XRATED_BRAND.accent }}>Trust Score.</span>{" "}
            Win more jobs.
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            A single number that shows customers — at a glance — that you
            are the safest choice. Eight signals add up to one score out of
            100. Tick each item in your dashboard, watch your score climb,
            and watch your enquiries climb with it.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> One number, 0-100
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Updates live
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Visible on your public profile
            </span>
          </div>
        </div>
      </section>

      {/* Section 1 — the signature visual: circular gauge + ticked
          checklist. Built large and dramatic; this is the page hero
          moment. */}
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
        <div
          className="overflow-hidden rounded-3xl border p-5 sm:p-10"
          style={{
            background: "#0A0A0A",
            borderColor: `${XRATED_BRAND.accent}33`
          }}
        >
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
            {/* Circular gauge — SVG ring with the score in massive
                yellow numbers in the centre. */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative">
                <svg
                  width="240"
                  height="240"
                  viewBox="0 0 200 200"
                  className="block h-56 w-56 sm:h-72 sm:w-72"
                  aria-label={`Trust Score ${HERO_SCORE} out of ${HERO_MAX}`}
                  role="img"
                >
                  {/* Track */}
                  <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="14"
                  />
                  {/* Filled arc — rotated -90deg so it starts at 12 o'clock. */}
                  <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    stroke={XRATED_BRAND.accent}
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 100 100)"
                  />
                </svg>
                {/* Score readout — absolutely centered over the SVG. */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="text-7xl font-extrabold leading-none sm:text-8xl"
                    style={{ color: XRATED_BRAND.accent }}
                  >
                    {HERO_SCORE}
                  </span>
                  <span className="mt-1 text-xs font-bold text-white/60 sm:text-sm">
                    / {HERO_MAX}
                  </span>
                </div>
              </div>
              <p
                className="mt-4 text-xs font-extrabold uppercase tracking-[0.32em]"
                style={{ color: XRATED_BRAND.accent }}
              >
                Trust Score
              </p>
              <p className="mt-2 text-center text-xs text-white/60 sm:text-sm">
                Live preview — Mike Watson, Drywall, Manchester.
              </p>
            </div>

            {/* Checklist — 8 items, 7 ticked, 1 outstanding. The single
                un-ticked item shows the +8 the tradie can still earn. */}
            <ul className="flex flex-col gap-2">
              {CHECKLIST.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3"
                  style={{
                    borderColor: item.achieved
                      ? `${XRATED_BRAND.accent}40`
                      : "rgba(255,255,255,0.12)",
                    background: item.achieved
                      ? `${XRATED_BRAND.accent}14`
                      : "rgba(255,255,255,0.03)"
                  }}
                >
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8"
                    style={{
                      background: item.achieved
                        ? XRATED_BRAND.accent
                        : "rgba(255,255,255,0.08)"
                    }}
                    aria-hidden="true"
                  >
                    {item.achieved ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0A0A0A"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      <span className="text-xs font-extrabold text-white/40">
                        +{item.points}
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      item.achieved
                        ? "text-xs font-bold text-white sm:text-sm"
                        : "text-xs font-bold text-white/60 sm:text-sm"
                    }
                  >
                    {item.label}
                  </span>
                  <span
                    className="ml-auto text-[10px] font-extrabold uppercase tracking-wider"
                    style={{
                      color: item.achieved
                        ? XRATED_BRAND.accent
                        : "rgba(255,255,255,0.45)"
                    }}
                  >
                    {item.achieved ? "Earned" : "Available"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Section 2 — Why a high score matters (narrative + 3 mini-stats). */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Why customers look for a high score
        </h2>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-neutral-600 sm:text-sm">
          Hiring a tradesperson is one of the higher-trust purchases a
          customer makes online. They are inviting a stranger into their
          home, and paying a real number for it. They scan profiles fast
          and decide on a feeling — and a single, visible score gives them
          that feeling in one glance. The higher your Trust Score, the
          fewer reasons a customer has to keep scrolling.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {TRUST_STATS.map((s) => (
            <article
              key={s.stat}
              className="rounded-2xl border border-neutral-200 bg-white p-5 text-center"
            >
              <p
                className="text-3xl font-extrabold leading-none sm:text-4xl"
                style={{ color: XRATED_BRAND.accent }}
              >
                {s.stat}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                {s.label}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Section 3 — How to get to 100. Full 8-item checklist with
          points, what to do, 1-line tip. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          How to get to 100
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Eight items. Tick them all and your Trust Score is 100/100.
        </p>

        <ol className="mt-6 flex flex-col gap-3">
          {CHECKLIST.map((item, idx) => (
            <li
              key={item.label}
              className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5"
            >
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-neutral-900 sm:h-12 sm:w-12 sm:text-lg"
                style={{ background: XRATED_BRAND.accent }}
                aria-hidden="true"
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-extrabold text-neutral-900 sm:text-base">
                    {item.label}
                  </h3>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900"
                    style={{ background: XRATED_BRAND.accent }}
                  >
                    +{item.points} pts
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                  {item.tip}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* Total readout — sanity-check the maths for the reader. */}
        <p className="mt-4 text-xs text-neutral-500 sm:text-sm">
          Total available: 15 + 10 + 20 + 10 + 10 + 7 + 20 + 8 ={" "}
          <span className="font-extrabold text-neutral-900">100 points</span>.
        </p>
      </section>

      {/* Section 4 — Live updates explainer. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <div
          className="overflow-hidden rounded-2xl border p-5 sm:p-8"
          style={{
            borderColor: `${XRATED_BRAND.accent}66`,
            background: `${XRATED_BRAND.accent}0F`
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <span
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-extrabold text-neutral-900"
              style={{ background: XRATED_BRAND.accent }}
              aria-hidden="true"
            >
              {">>"}
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
                Your score updates live
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-neutral-700 sm:text-sm">
                The moment you upload your video, add a new service, or get
                a fresh verified review, your Trust Score recalculates and
                the gauge ticks up. No nightly batch, no waiting. The
                public version on your URL refreshes within a minute, so
                the next customer scrolling sees the latest number. Keep
                ticking items, keep climbing.
              </p>
            </div>
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
            One score. Every customer trusts you faster.
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Start your 14-day free trial.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            Full Paid-tier access for 14 days. No card on signup. Build
            your Trust Score, watch the gauge climb, win the next job.
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
              href="/demo-mike-watson-drywall-manchester"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See live profile
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
