// Xrated Trades — Service Cards feature explainer page.
// Pitch: every tradesperson lists their services with a price up front,
// so customers can tap "Enquire" on the exact job they want. The card
// itself is the conversion unit — image + name + price + WhatsApp
// pre-fill. This page mocks the live product, explains why pricing
// transparency converts, and walks through 5-minute setup.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Service Cards — Your services. Your prices. In a card customers tap. | Xrated Trades",
  description:
    "Show your services with prices, photos and a one-tap Enquire button that opens WhatsApp pre-filled. The conversion unit of every Xrated Trades profile.",
  alternates: { canonical: "/trade-off/services" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title:
      "Service Cards — Your services. Your prices. In a card customers tap.",
    description:
      "Show services with prices and photos. Customers tap Enquire and land in your WhatsApp with the job name pre-filled. Set up in 5 minutes.",
    url: absolute("/trade-off/services")
  }
};

type ExampleService = {
  title: string;
  price: string;
  hint: string;
};

const EXAMPLE_SERVICES: ExampleService[] = [
  { title: "Garden Wall", price: "£450", hint: "2-day job · materials inc." },
  { title: "Extension Wall", price: "£2,400", hint: "5-7 days · single skin" },
  { title: "Patio Build", price: "£1,200", hint: "block-paving · 20m2" },
  { title: "Roof Repair", price: "£900", hint: "ridge tile re-bed" }
];

type WhyRow = {
  eyebrow: string;
  title: string;
  body: string;
};

const WHY_IT_CONVERTS: WhyRow[] = [
  {
    eyebrow: "01",
    title: "Prices up front",
    body: "Customers see your prices on the profile — no awkward phone calls, no waiting two days for a quote. The leads who tap Enquire already know your number is in range."
  },
  {
    eyebrow: "02",
    title: "One-tap to WhatsApp",
    body: "Tap Enquire and WhatsApp opens with the service name pre-filled — 'Hi, interested in your Garden Wall service'. No copy-paste. No friction. Lead lands in your phone in under 3 seconds."
  },
  {
    eyebrow: "03",
    title: "You reply while they are warm",
    body: "Push notification straight to your WhatsApp. Reply in seconds while the customer is still scrolling — most tradies who use Xrated say first-reply speed is what wins the job."
  }
];

type SetupStep = {
  n: number;
  title: string;
  body: string;
};

const SETUP_STEPS: SetupStep[] = [
  {
    n: 1,
    title: "Open your dashboard",
    body: "Sign in to xratedtrade.com and tap 'Services' in the side nav. You get a blank card you can fill in seconds."
  },
  {
    n: 2,
    title: "Name the service + add a photo",
    body: "Use plain customer language — 'Garden Wall', not 'Single-skin brickwork to 1.2m'. Drop a photo from your phone gallery."
  },
  {
    n: 3,
    title: "Set a starting price",
    body: "Either a fixed price ('£450') or a from-price ('from £450'). Customers respect a number — even a from-price beats 'request a quote'."
  },
  {
    n: 4,
    title: "Save — it is live",
    body: "Your card appears on your profile instantly. Repeat for your top 4-6 services. Five minutes total."
  }
];

export default function ServiceCardsPage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — black surface, yellow accent on the verb. */}
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
            Your services. Your prices. In a card customers{" "}
            <span style={{ color: XRATED_BRAND.accent }}>tap.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Every Xrated Trades profile is built around one conversion unit:
            the service card. A photo, the job name, a real price, and a
            single Enquire button that lands the lead in your WhatsApp with
            the service name pre-filled. No quote forms, no waiting.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Price upfront
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> One-tap WhatsApp
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> 5-minute setup
            </span>
          </div>
        </div>
      </section>

      {/* Section 1 — visual mock of the live product (4-card grid). */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          What it looks like on your profile
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          A live mock — bricklayer example. Customers see a clean grid of
          your services with prices, ready to tap.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {EXAMPLE_SERVICES.map((s) => (
            <article
              key={s.title}
              className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
            >
              {/* Image placeholder — gray box stands in for the photo
                  upload tradies drop in from their phone. */}
              <div
                className="relative flex aspect-[4/3] items-center justify-center"
                style={{ background: "#E5E5E5" }}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                  Photo
                </span>
              </div>
              <div className="p-3 sm:p-4">
                <h3 className="text-sm font-extrabold text-neutral-900 sm:text-base">
                  {s.title}
                </h3>
                <p
                  className="mt-1 text-base font-extrabold sm:text-lg"
                  style={{ color: XRATED_BRAND.accent }}
                >
                  {s.price}
                </p>
                <p className="mt-1 text-xs text-neutral-500">{s.hint}</p>
                <button
                  type="button"
                  className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg text-xs font-extrabold uppercase tracking-wider text-neutral-900"
                  style={{ background: XRATED_BRAND.accent }}
                  aria-label={`Enquire about ${s.title} — opens WhatsApp pre-filled`}
                >
                  Enquire
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Section 2 — Why it converts (3-up grid). */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Why it converts
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          The friction between 'interested' and 'in your WhatsApp' is zero.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {WHY_IT_CONVERTS.map((row) => (
            <article
              key={row.title}
              className="rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <p
                className="text-xs font-extrabold uppercase tracking-widest"
                style={{ color: XRATED_BRAND.accent }}
              >
                {row.eyebrow}
              </p>
              <h3 className="mt-2 text-base font-extrabold text-neutral-900 sm:text-lg">
                {row.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                {row.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Section 3 — Setup walkthrough (4 numbered steps). */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Set yours up in 5 minutes
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Four steps. No design skills required.
        </p>

        <ol className="mt-6 flex flex-col gap-3">
          {SETUP_STEPS.map((step) => (
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

        {/* Free vs Paid note — sets the expectation for the freemium gate. */}
        <aside
          className="mt-6 flex items-start gap-3 rounded-2xl border p-4 sm:p-5"
          style={{
            borderColor: `${XRATED_BRAND.accent}66`,
            background: `${XRATED_BRAND.accent}0F`
          }}
        >
          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-neutral-900"
            style={{ background: XRATED_BRAND.accent }}
            aria-hidden="true"
          >
            i
          </span>
          <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
            <span className="font-extrabold text-neutral-900">
              Free vs Paid.
            </span>{" "}
            On the free tier (hammerexdirect.com) your cards show image +
            service name only — no price, no description. Upgrade to Paid
            (£14.99/mo on xratedtrade.com, 14-day free trial) to unlock full
            prices, descriptions and the WhatsApp pre-fill flow.
          </p>
        </aside>
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
            Build your service grid in 5 minutes
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Start your 14-day free trial.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            Full Paid-tier access for 14 days. No card on signup. Customers
            tap, you reply on WhatsApp, you win the job.
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

function Dot({ accent = false }: { accent?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: accent ? XRATED_BRAND.accent : "rgba(255,255,255,0.6)" }}
    />
  );
}
