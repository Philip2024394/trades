// Xrated Trades — /trade-off/add-ons — public marketing page for the
// add-on registry. Iterates XRATED_ADDONS so any new add-on appended
// to the registry shows up here automatically. Server component, no
// client state, matches the design system used across
// /trade-off/pricing, /trade-off/why and /trade-off/how (black hero
// surface, yellow accent, max-w-5xl body, 13px text floor).

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import {
  XRATED_ADDONS,
  formatAddonPrice,
  ADDON_BADGE_LABEL,
  type XratedAddon
} from "@/lib/xratedAddons";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Xrated Trades · Add-ons — make your profile do more",
  description:
    "Every Xrated profile starts strong. Add-ons let you tune yours to your trade — recommend other tradies, sell products, point a custom domain, get SMS alerts. Stack any combination. 14-day free trial.",
  alternates: { canonical: "/trade-off/add-ons" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title:
      "Xrated Trades — Add-ons. Tune your profile to your trade.",
    description:
      "Recommend other tradies, sell products, point your own domain, get SMS lead alerts. Toggle on, pay only for what's on. 14-day free trial.",
    url: absolute("/trade-off/add-ons")
  }
};

const HOW_STEPS = [
  {
    n: "1",
    title: "Start free for 14 days.",
    body:
      "Sign up and every add-on we ship is unlocked for your trial — no card needed. Try the ones that fit your trade before you commit."
  },
  {
    n: "2",
    title: "Add what you need.",
    body:
      "From your dashboard, toggle any add-on on or off. Stack as many as you want — they layer on top of your base profile."
  },
  {
    n: "3",
    title: "Pay only for what's on.",
    body:
      "Each paid add-on bills monthly on top of your base subscription. Cancel a single add-on any time without losing your profile."
  }
];

const FAQ = [
  {
    q: "Can I run two add-ons at once?",
    a: "Yes. Stack as many as you need — they all live on the same profile and bill independently."
  },
  {
    q: "Do I lose my profile if I cancel an add-on?",
    a: "No. Your base profile stays exactly as it is. The add-on feature simply hides, and you stop being billed for it from the next cycle."
  },
  {
    q: "Can customers see what add-ons I've turned on?",
    a: "No. They only see the resulting features — a Shop tab, a Trusted Trades list, a custom URL. The SaaS plumbing behind it never shows up."
  },
  {
    q: "What happens to my products if I switch off Shop Mode?",
    a: "Archived, not deleted. Switch the add-on back on and every product reappears with its photos, prices and stock intact."
  }
];

export default function AddOnsPage() {
  return (
    <main className="pb-24 md:pb-0" style={{ background: "#0A0A0A" }}>
      <XratedHeader />

      {/* Hero — black surface, eyebrow + headline with yellow accent on
          the last two words ("do more"), short value-prop subhead, and a
          pricing-strip line that frames the commercial deal. */}
      <section
        className="relative overflow-hidden border-b border-white/10"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-8 pt-12 sm:px-6 sm:pb-10 sm:pt-16">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.28em] sm:text-xs"
            style={{ color: XRATED_BRAND.accent }}
          >
            Add-ons
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Make your profile{" "}
            <span style={{ color: XRATED_BRAND.accent }}>do more.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-base">
            Every Xrated profile starts strong. Add-ons let you tune your
            profile to your trade — pure service, full shop, or somewhere
            in between. Pay only for the ones you turn on.
          </p>
          <p className="mt-5 text-xs leading-relaxed text-white/65 sm:text-sm">
            From <span className="font-bold text-white">£0/mo</span> · stack
            as many as you need · cancel a single add-on without losing
            your profile.
          </p>
        </div>
      </section>

      {/* Add-on grid — iterates XRATED_ADDONS so the page picks up any
          new entry automatically. Single column on mobile, 2-up on
          sm:, 3-up on lg:. */}
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.28em] sm:text-xs"
          style={{ color: XRATED_BRAND.accent }}
        >
          The add-ons
        </p>
        <h2 className="mt-2 text-xl font-extrabold text-white sm:text-2xl">
          Switch on what fits your trade.
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-white/60 sm:text-sm">
          Every add-on is independent. Turn on what you need, leave the
          rest off.
        </p>

        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {XRATED_ADDONS.map((addon) => (
            <AddOnCard key={addon.slug} addon={addon} />
          ))}
        </ul>
      </section>

      {/* How add-ons work — three-step explainer. Yellow numerals in
          circles, white headings, muted body copy. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.28em] sm:text-xs"
          style={{ color: XRATED_BRAND.accent }}
        >
          How add-ons work
        </p>
        <h2 className="mt-2 text-xl font-extrabold text-white sm:text-2xl">
          Three steps from signup to a tuned profile.
        </h2>

        <ol className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
          {HOW_STEPS.map((step) => (
            <li
              key={step.n}
              className="rounded-2xl border border-white/10 bg-[#141414] p-5"
            >
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-base font-extrabold"
                style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
                aria-hidden="true"
              >
                {step.n}
              </span>
              <h3 className="mt-3 text-sm font-extrabold text-white sm:text-base">
                {step.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-white/70 sm:text-sm">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ — native details/summary accordion. White text on the
          dark surface; yellow plus that rotates on open. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.28em] sm:text-xs"
          style={{ color: XRATED_BRAND.accent }}
        >
          Common questions
        </p>
        <h2 className="mt-2 text-xl font-extrabold text-white sm:text-2xl">
          Add-ons — the short answers.
        </h2>

        <ul className="mt-6 flex flex-col gap-3">
          {FAQ.map((qa) => (
            <li key={qa.q}>
              <details className="group rounded-2xl border border-white/10 bg-[#141414] p-4 transition open:border-white/25">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-3 text-sm font-bold text-white marker:content-['']">
                  <span>{qa.q}</span>
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition group-open:rotate-45"
                    style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-xs leading-relaxed text-white/70">
                  {qa.a}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {/* Final CTA strip — full-width yellow band, dark text. Stacks on
          mobile, side-by-side on desktop. Button height 44px+ per WCAG. */}
      <section className="mx-auto mt-12 max-w-5xl px-4 sm:px-6">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 sm:px-10 sm:py-10"
          style={{ background: XRATED_BRAND.accent }}
        >
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <div className="max-w-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-neutral-900/70 sm:text-xs">
                One profile · every add-on
              </p>
              <h2 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
                All add-ons. One profile. Start your 14-day free trial.
              </h2>
            </div>
            <a
              href="/trade-off/signup"
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-lg bg-neutral-900 px-6 text-xs font-extrabold uppercase tracking-wider text-white transition active:scale-[0.98] sm:text-sm"
            >
              Claim my URL
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      <XratedFooter />
    </main>
  );
}

function AddOnCard({ addon }: { addon: XratedAddon }) {
  const isReady = addon.availability === "ready";
  const isFree = addon.pricing.kind === "free";
  const priceLabel = formatAddonPrice(addon);
  const badgeLabel = ADDON_BADGE_LABEL[addon.editorial_badge];

  return (
    <li className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141414] transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-[#1c1c1c] sm:flex-row">
      {/* Image side — square on desktop, 16:9 on mobile (image stacks
          above the content). Falls back to a phone-frame illustration
          + glyph + pointer-callout pills when image_url is null. Real
          screenshots replace the phone frame whenever image_url is set. */}
      <div className="relative aspect-[16/9] w-full overflow-hidden sm:aspect-square sm:w-2/5 sm:shrink-0 sm:self-stretch">
        {addon.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={addon.image_url}
            alt={addon.name}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center px-6 py-10 sm:py-8"
            style={{
              background: `linear-gradient(135deg, ${XRATED_BRAND.accent} 0%, ${XRATED_BRAND.accent}cc 50%, ${XRATED_BRAND.accent}99 100%)`
            }}
          >
            {/* Phone frame — width-based with aspect-ratio so the frame
                always has dimensions even inside a flex parent that
                doesn't stretch its children. */}
            <div
              className="relative w-24 sm:w-28 md:w-32"
              style={{ aspectRatio: "10 / 16" }}
            >
              {/* Black phone bezel */}
              <div className="absolute inset-0 rounded-[18px] bg-black shadow-2xl" />
              {/* Notch */}
              <div className="absolute left-1/2 top-1.5 z-10 h-1 w-7 -translate-x-1/2 rounded-full bg-white/30" />
              {/* Screen */}
              <div
                className="absolute inset-[3px] flex items-center justify-center rounded-[15px]"
                style={{ background: "#0A0A0A" }}
              >
                <span
                  className="block text-5xl font-black sm:text-6xl"
                  style={{ color: XRATED_BRAND.accent }}
                >
                  {addon.glyph}
                </span>
              </div>
            </div>
            {/* Pointer callouts — desktop only (mobile keeps the image
                clean). Row of small white pills along the bottom of the
                image area, each calling out one concrete feature the
                customer sees when the add-on is on. */}
            {addon.callouts.length > 0 && (
              <div className="absolute inset-x-3 bottom-3 hidden flex-wrap items-end justify-center gap-1.5 sm:flex">
                {addon.callouts.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-neutral-900 shadow-md"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block h-1 w-1 rounded-full"
                      style={{ background: XRATED_BRAND.accent }}
                    />
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Status pill — top-right overlay on the image area so the
            customer reads it before scanning the benefits. */}
        <div className="absolute right-3 top-3">
          <StatusChip ready={isReady} />
        </div>
        {/* Editorial badge — top-left overlay. Honest categorisation,
            not a fabricated popularity claim. */}
        <div className="absolute left-3 top-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur"
          >
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: XRATED_BRAND.accent }}
            />
            {badgeLabel}
          </span>
        </div>
      </div>

      {/* Content side */}
      <div className="flex flex-1 flex-col px-5 py-5 sm:px-6 sm:py-6">
        {/* Persona chips — small outline pills, who this add-on serves */}
        <div className="flex flex-wrap gap-1.5">
          {addon.personas.map((persona) => (
            <span
              key={persona}
              className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80"
            >
              {persona}
            </span>
          ))}
        </div>

        {/* Name + price — name dominates, price right-aligned baseline */}
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-extrabold leading-tight text-white sm:text-xl">
            {addon.name}
          </h3>
          <p
            className="shrink-0 text-sm font-extrabold"
            style={{ color: isFree ? XRATED_BRAND.accent : "#ffffff" }}
          >
            {priceLabel}
          </p>
        </div>

        {/* Tagline — one-line hook, bumped to strong white for legibility */}
        <p className="mt-1.5 text-xs font-semibold leading-relaxed text-white sm:text-sm">
          {addon.tagline}
        </p>

        {/* "What it does" — full summary in a bordered card so the
            customer reads the real scope of the add-on, not just the
            one-line hook. Yellow eyebrow + readable body copy. */}
        <div className="mt-3 rounded-xl border border-white/10 bg-[#1c1c1c] p-3">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            What it does
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/90">
            {addon.summary}
          </p>
        </div>

        {/* Benefit bullets — 3 yellow ticks, tighter spacing than the
            old card so the landscape rhythm reads cleanly. */}
        <ul className="mt-4 flex flex-col gap-1.5">
          {addon.benefits.map((benefit) => (
            <li
              key={benefit}
              className="flex items-start gap-2 text-xs leading-relaxed text-white/85"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
              >
                {"✓"}
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        {/* Footer chips — Included-with-paid when applicable. Status
            already lives on the image overlay so we don't repeat it. */}
        {addon.includedWithPaid && isReady && (
          <div className="mt-4 flex flex-wrap items-center gap-2 pt-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider"
              style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
            >
              Included with paid
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

function StatusChip({ ready }: { ready: boolean }) {
  // Solid dark backdrop so the chip reads cleanly when it sits on the
  // yellow gradient image area (the previous yellow-on-yellow rendering
  // for "Coming soon" was effectively invisible).
  const dotColor = ready ? "#10B981" : XRATED_BRAND.accent;
  const label = ready ? "Available now" : "Coming soon";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/85 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur">
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: dotColor }}
      />
      {label}
    </span>
  );
}
