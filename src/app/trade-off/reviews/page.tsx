// Xrated Trades — Customer Reviews feature explainer page.
// Pitch: real verified reviews are what gets the NEXT customer over the
// line. This page mocks the live review card layout, explains the
// review flow tied to specific services, the fake-review policy and the
// dispute process, then closes with the trust stat.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Customer Reviews — Real reviews. Real proof. Real next-leads. | Xrated Trades",
  description:
    "Real verified reviews tied to the exact service you delivered. We verify customers via WhatsApp or postcode. Tradies can dispute unfair reviews with evidence.",
  alternates: { canonical: "/trade-off/reviews" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title:
      "Customer Reviews — Real reviews. Real proof. Real next-leads.",
    description:
      "Reviews tied to specific services. Verified customers. Dispute unfair reviews with evidence. The proof the next customer needs.",
    url: absolute("/trade-off/reviews")
  }
};

type HowStep = {
  n: number;
  title: string;
  body: string;
};

const HOW_STEPS: HowStep[] = [
  {
    n: 1,
    title: "Ask the customer after the job",
    body: "Send them your Xrated URL — xratedtrade.com/your-name — with a 'leave a review' prompt. One tap from WhatsApp. No app download, no sign-up wall."
  },
  {
    n: 2,
    title: "They rate 1-5 stars + write a quick comment",
    body: "Two minutes from their phone. Star rating, short comment, optional photo. We verify them via the WhatsApp number or postcode that booked the job."
  },
  {
    n: 3,
    title: "Their review attaches to the exact service",
    body: "If they hired you for the Garden Wall service card, the review sits under that service — not floating in a generic list. Future customers see proof of THAT specific job."
  },
  {
    n: 4,
    title: "Next customer scrolling sees real vouches",
    body: "When the next lead lands on your profile, the review they read is from a verified customer who hired you for the same job they want. That is what closes the lead."
  }
];

export default function ReviewsPage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — black surface, yellow accent on the verb phrase. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Feature
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Real reviews. Real proof. Real{" "}
            <span style={{ color: XRATED_BRAND.accent }}>next-leads.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Customer reviews are what closes the next lead. On Xrated Trades
            every review is verified, tied to the specific service you
            delivered, and visible on your profile to the next customer
            scrolling. No anonymous trolls, no fake rivals — just the proof
            the next job needs.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Verified customers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Tied to the exact service
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Dispute process for unfair reviews
            </span>
          </div>
        </div>
      </section>

      {/* Section 1 — visual mock of the review card. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          What a review looks like on your profile
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          A live mock. Customer name, postcode, service, stars, comment.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Hero review card — full-width on its own row on mobile,
              spans two columns on desktop. */}
          <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm lg:col-span-2 lg:p-6">
            <div className="flex items-center gap-1" aria-label="5 out of 5 stars">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} />
              ))}
            </div>
            <blockquote className="mt-3 text-base font-bold leading-snug text-neutral-900 sm:text-lg">
              &ldquo;Top job. Turned up when he said, did exactly what he
              quoted. Garden wall is solid as a rock. Would have him back
              tomorrow.&rdquo;
            </blockquote>
            <div className="mt-4 flex items-center gap-3">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold text-neutral-900"
                style={{ background: XRATED_BRAND.accent }}
                aria-hidden="true"
              >
                SK
              </span>
              <div className="text-xs sm:text-sm">
                <p className="font-extrabold text-neutral-900">Sarah K</p>
                <p className="text-neutral-500">
                  Manchester ·{" "}
                  <span
                    className="font-bold"
                    style={{ color: XRATED_BRAND.accent }}
                  >
                    Garden wall
                  </span>
                </p>
              </div>
              <span
                className="ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider"
                style={{
                  borderColor: `${XRATED_BRAND.accent}80`,
                  color: XRATED_BRAND.accent
                }}
              >
                <Tick /> Verified
              </span>
            </div>
          </article>

          {/* Secondary stat card — sets up the proof angle. */}
          <aside
            className="flex flex-col justify-center rounded-2xl p-5 lg:p-6"
            style={{ background: "#0A0A0A" }}
          >
            <p
              className="text-xs font-extrabold uppercase tracking-widest"
              style={{ color: XRATED_BRAND.accent }}
            >
              Why it matters
            </p>
            <p className="mt-3 text-3xl font-extrabold leading-none text-white sm:text-4xl">
              86%
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/80 sm:text-sm">
              of customers check reviews before hiring a tradesperson. Your
              profile needs them — verified, dated, tied to the job you
              actually did.
            </p>
          </aside>
        </div>
      </section>

      {/* Section 2 — How reviews work (4 numbered steps). */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          How reviews work
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Four steps from finished job to a review the next customer reads.
        </p>

        <ol className="mt-6 flex flex-col gap-3">
          {HOW_STEPS.map((step) => (
            <li
              key={step.n}
              className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5"
            >
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-neutral-900 sm:h-12 sm:w-12 sm:text-lg"
                style={{ background: XRATED_BRAND.accent }}
                aria-hidden="true"
              >
                {step.n}
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-neutral-900 sm:text-base">
                  {step.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Section 3 — Fake review policy + dispute process. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Fake review policy
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          The platform only works if both sides trust the reviews. Here is
          how we keep them clean.
        </p>

        <div
          className="mt-6 rounded-2xl border p-5 sm:p-6"
          style={{
            borderColor: `${XRATED_BRAND.accent}66`,
            background: `${XRATED_BRAND.accent}0A`
          }}
        >
          <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
            <span className="font-extrabold text-neutral-900">
              We verify every reviewer.
            </span>{" "}
            Before a review goes live we match the reviewer against the
            WhatsApp number that contacted you through the Enquire button,
            or the postcode tied to the job. If we cannot match either, the
            review is held in a moderation queue and you are notified.
            Anonymous troll reviews from competitors do not get through.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-neutral-700 sm:text-sm">
            <span className="font-extrabold text-neutral-900">
              You can dispute unfair reviews.
            </span>{" "}
            If a review is inaccurate, retaliatory or refers to a job you
            never did, open a dispute from your dashboard with evidence
            (photos, WhatsApp screenshots, the original quote). The
            disputed review carries a visible &ldquo;Under review&rdquo;
            badge while we mediate, so the next customer sees that you are
            challenging it rather than ignoring it. Most disputes resolve
            inside 5 working days.
          </p>
        </div>
      </section>

      {/* Section 4 — Trust-building callout (the big stat). */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <div
          className="overflow-hidden rounded-2xl px-5 py-10 text-center sm:px-10 sm:py-14"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-extrabold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            How reviews build trust
          </p>
          <p
            className="mt-4 text-5xl font-extrabold leading-none sm:text-7xl"
            style={{ color: XRATED_BRAND.accent }}
          >
            86%
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base font-bold leading-snug text-white sm:text-xl">
            &ldquo;of customers check reviews before hiring.&rdquo;
          </p>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/70 sm:text-sm">
            Your profile is the first thing they see after they search your
            trade. Reviews are what tips them from &lsquo;maybe&rsquo; to
            &lsquo;tap Enquire&rsquo;.
          </p>
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
            Collect verified reviews on your URL
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Start your 14-day free trial.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            Full Paid-tier access for 14 days. No card on signup. Build the
            review wall the next customer reads.
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

function Star() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={XRATED_BRAND.accent}
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function Tick() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke={XRATED_BRAND.accent}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
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
