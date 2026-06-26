// Xrated Trades — Verified Business explainer page.
// Pitches the paid annual Verified tier (£199.99/yr) — the trust layer
// that sits on top of Paid. Backed by a real Companies House (or
// local-registry) check, with two optional add-on badges (Insurance
// + On-site checked) that customers can filter on.
//
// Page layout: hero (black, yellow accent) → "What we verify"
// (1 large primary card + 2 add-on cards) → "Why customers trust"
// bullet list → 4-step "How to become verified" → annual-only
// rationale → closing CTA to the verified waitlist.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Verified Business — Xrated Trades. The badge backed by a real Companies House check. £199.99/yr.",
  description:
    "Xrated Verified is the £199.99/yr trust tier. We confirm active company registration with Companies House (or your local registry) so customers know you are real. Optional add-on badges for Insurance and On-site checked. Verification launches Q3 2026 — waitlist members lock £199.99/yr for life.",
  alternates: { canonical: "/trade-off/verified" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title:
      "Xrated Verified — the badge that says: this tradesperson is real. £199.99/yr.",
    description:
      "Active company registration check, optional Insurance + On-site add-on badges, priority search ranking. £199.99/yr, annual only. Launches Q3 2026 — join the waitlist.",
    url: absolute("/trade-off/verified")
  }
};

export default function VerifiedPage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — black surface with yellow accent eyebrow + H1 highlight,
          mirroring the pricing-page hero rhythm. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Xrated Verified
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            The badge that says: this tradesperson is{" "}
            <span style={{ color: XRATED_BRAND.accent }}>real.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Verified is our paid annual tier — £199.99/yr, annual only — backed
            by a real registration check, not a self-declared tick. We
            confirm your company exists, is in good standing, and that you
            are the named owner or director. Two optional add-on badges
            (Insurance + On-site checked) layer on top so customers can
            filter the directory for trades that match their job.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Real registration check
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Optional Insurance + On-site add-ons
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Priority search ranking
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Launches Q3 2026 — waitlist now
            </span>
          </div>
        </div>
      </section>

      {/* Section 1 — What we verify. Large primary card (the required
          check) + 2 smaller optional add-on cards in a side-by-side grid
          on desktop, stacked on mobile. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          What we verify
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          One required check, two optional add-on badges. Pick what fits
          your trade.
        </p>

        {/* Primary check — full-width card with yellow accent rail */}
        <div
          className="mt-6 overflow-hidden rounded-2xl border-2 bg-white p-5 sm:p-7"
          style={{ borderColor: XRATED_BRAND.accent }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: XRATED_BRAND.accent }}
              aria-hidden="true"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 12 2 2 4-4" />
                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9Z" />
              </svg>
            </div>
            <div className="flex-1">
              <p
                className="text-xs font-extrabold uppercase tracking-widest"
                style={{ color: XRATED_BRAND.accent }}
              >
                Required check
              </p>
              <h3 className="mt-1 text-lg font-extrabold text-neutral-900 sm:text-xl">
                Active company registration
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-700 sm:text-sm">
                We confirm your business exists in the public registry —
                Companies House for UK trades, the equivalent national
                registry for everyone else. We check the company is active
                (not dissolved, not in liquidation), and that you are
                listed as a director, partner or sole-trader owner. This
                is the one non-negotiable check — every Verified profile
                passes this before the badge appears.
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-1.5 text-xs text-neutral-700 sm:grid-cols-2 sm:gap-2">
                <li className="flex items-start gap-2">
                  <span style={{ color: XRATED_BRAND.accent }}>+</span>
                  Confirms the company is real and active
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: XRATED_BRAND.accent }}>+</span>
                  Confirms you are the owner / director
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: XRATED_BRAND.accent }}>+</span>
                  Sole traders accepted via HMRC UTR or local equivalent
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: XRATED_BRAND.accent }}>+</span>
                  Re-checked every 12 months at renewal
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Optional add-on badges — two cards side by side */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          {/* Insured for private work */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <div
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "#0A0A0A" }}
                aria-hidden="true"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={XRATED_BRAND.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z" />
                </svg>
              </div>
              <div className="flex-1">
                <p
                  className="text-[11px] font-bold uppercase tracking-widest text-neutral-500"
                >
                  Optional add-on
                </p>
                <h3 className="mt-0.5 text-base font-extrabold text-neutral-900 sm:text-lg">
                  Insured for private work
                </h3>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-neutral-700 sm:text-sm">
              Upload a current public-liability (and employer's liability
              if you have staff) certificate. We confirm the cover amount,
              the insured trade and the expiry date. This badge only
              matters if you do direct-to-customer work — site tradies
              are usually covered by the principal contractor's master
              policy and do not need it.
            </p>
            <ul className="mt-3 flex flex-col gap-1 text-xs text-neutral-700">
              <li className="flex items-start gap-2">
                <span style={{ color: XRATED_BRAND.accent }}>+</span>
                Shows cover amount on your profile
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: XRATED_BRAND.accent }}>+</span>
                Auto-expires when the policy lapses
              </li>
            </ul>
          </div>

          {/* On-site checked */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <div
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "#0A0A0A" }}
                aria-hidden="true"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={XRATED_BRAND.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-7.58 8-13a8 8 0 0 0-16 0c0 5.42 8 13 8 13Z" />
                  <circle cx="12" cy="9" r="3" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  Optional add-on
                </p>
                <h3 className="mt-0.5 text-base font-extrabold text-neutral-900 sm:text-lg">
                  On-site checked
                </h3>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-neutral-700 sm:text-sm">
              For high-risk trades — gas, electrical, structural,
              scaffolding — we confirm your trade credentials (Gas Safe,
              NICEIC, CISRS, etc.) at the work address. A short site or
              workshop visit verifies you and the credential match.
              Customers searching for these trades trust this badge above
              all others.
            </p>
            <ul className="mt-3 flex flex-col gap-1 text-xs text-neutral-700">
              <li className="flex items-start gap-2">
                <span style={{ color: XRATED_BRAND.accent }}>+</span>
                Credential + identity confirmed at the address
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: XRATED_BRAND.accent }}>+</span>
                Re-checked when the credential lapses
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section 2 — Why customers trust Verified */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Why customers trust Verified trades
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          The badge isn't decoration — it changes how customers find,
          contact and pay you.
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          <li className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p
              className="text-2xl font-extrabold sm:text-3xl"
              style={{ color: XRATED_BRAND.accent }}
            >
              3x
            </p>
            <p className="mt-1 text-sm font-bold text-neutral-900">
              More confidence at first contact
            </p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-600 sm:text-sm">
              Customers know they aren't about to message a ghost
              company. The badge replaces the "are they real" anxiety
              that kills most first WhatsApp messages.
            </p>
          </li>
          <li className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p
              className="text-2xl font-extrabold sm:text-3xl"
              style={{ color: XRATED_BRAND.accent }}
            >
              Top
            </p>
            <p className="mt-1 text-sm font-bold text-neutral-900">
              Search ranking, by default
            </p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-600 sm:text-sm">
              Verified profiles always appear above unverified profiles
              when a customer filters by trade or city. The badge does
              the SEO work for you.
            </p>
          </li>
          <li className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p
              className="text-2xl font-extrabold sm:text-3xl"
              style={{ color: XRATED_BRAND.accent }}
            >
              Yes
            </p>
            <p className="mt-1 text-sm font-bold text-neutral-900">
              Verified-only customer filter
            </p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-600 sm:text-sm">
              Customers can toggle "show Verified only" on search.
              Bigger-budget jobs and commercial buyers default to this
              filter — that's the audience the badge unlocks.
            </p>
          </li>
        </ul>
      </section>

      {/* Section 3 — How to become Verified, 4-step process */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          How to become Verified
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Four steps. Verification typically takes 4-6 weeks from payment to badge — exact timeframe depends on your country and the workload of the local registry we check against.
        </p>

        <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          {[
            {
              n: "1",
              title: "Pay £19.99/mo or £199.99/yr",
              body: "Monthly or annual — your choice. Annual saves £40 vs paying monthly. Your slug and tier stay on file as long as your subscription is active."
            },
            {
              n: "2",
              title: "Submit your company documents",
              body: "Upload your company number, a director ID and (if you're adding the add-ons) your insurance certificate or trade credential. Takes about 5 minutes."
            },
            {
              n: "3",
              title: "We verify within 4-6 weeks",
              body: "Our team confirms the registry record, matches you to the directorship, and reviews any add-on documents. Timing varies by country — UK Companies House lookups are fastest, some EU and non-EU registries take longer. We message you the moment anything's missing or approved."
            },
            {
              n: "4",
              title: "Badge appears on your profile",
              body: "Your Verified badge goes live on your xratedtrade.com URL. Add-on badges (Insurance, On-site) layer on top automatically if their checks passed."
            }
          ].map((step) => (
            <li
              key={step.n}
              className="flex gap-4 rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-extrabold"
                style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
              >
                {step.n}
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-extrabold text-neutral-900 sm:text-base">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* Waitlist note */}
        <div
          className="mt-6 rounded-2xl border-2 p-4 sm:p-5"
          style={{
            borderColor: XRATED_BRAND.accent,
            background: `${XRATED_BRAND.accent}12`
          }}
        >
          <p className="text-xs font-extrabold uppercase tracking-widest text-neutral-900">
            Founders' note
          </p>
          <p className="mt-2 text-xs leading-relaxed text-neutral-800 sm:text-sm">
            Verification launches Q3 2026. Join the waitlist now and your
            price is locked at <strong>£199.99/yr for life</strong> — even if
            the public price rises after launch. Waitlist members go
            through the verification queue first, in the order they
            joined.
          </p>
        </div>
      </section>

      {/* Section 3.5 — Contract Winner: main contractor angle.
          This is the B2B positioning Xrated hasn't marketed before.
          Main contractors carry liability for every subbie they bring
          on site; the Verified badge collapses their vetting work to a
          glance. Strongest pitch on the page for tradies chasing
          commercial work. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <div
          className="overflow-hidden rounded-3xl px-6 py-10 sm:px-12 sm:py-14"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em] sm:text-xs"
            style={{ color: XRATED_BRAND.accent }}
          >
            Contract winner — by design
          </p>
          <h2 className="mt-3 max-w-3xl text-2xl font-extrabold leading-tight text-white sm:text-3xl md:text-4xl">
            Why main contractors{" "}
            <span style={{ color: XRATED_BRAND.accent }}>
              actively look for Verified trades.
            </span>
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/80 sm:text-base">
            In commercial construction, main contractors carry the
            liability for every subbie they bring on site. They vet
            every crew before sign-on — credentials, insurance, prior
            work, all of it. That vetting is slow and expensive.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/80 sm:text-base">
            The <span className="font-bold text-white">Xrated Verified badge</span> does the vetting for them. We manually confirm active company registration, public-liability and employer&rsquo;s insurance certificates, and on-site credentials for high-risk trades.{" "}
            <span className="font-extrabold text-white">A main contractor sees the badge on your URL and the vetting question is answered in 2 seconds.</span>
          </p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <p
                className="text-[10px] font-extrabold uppercase tracking-widest"
                style={{ color: XRATED_BRAND.accent }}
              >
                For the contractor
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/85 sm:text-sm">
                Liability burden cut. They can shortlist Verified trades and skip the manual vetting cycle.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <p
                className="text-[10px] font-extrabold uppercase tracking-widest"
                style={{ color: XRATED_BRAND.accent }}
              >
                For you
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/85 sm:text-sm">
                You become the safe pick on the shortlist. Contractors who care about compliance (which is all of them) look for the badge first.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <p
                className="text-[10px] font-extrabold uppercase tracking-widest"
                style={{ color: XRATED_BRAND.accent }}
              >
                Bottom line
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/85 sm:text-sm">
                The badge isn&rsquo;t a vanity flex — it&rsquo;s a{" "}
                <span className="font-bold text-white">shortlist filter</span> for commercial work.
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-white/70 sm:text-base">
            If you&rsquo;re chasing commercial extensions, scaffold
            packages, electrical install on larger sites, or any work
            where a main contractor signs you on — the Verified badge is
            the one trust signal that pays for itself in your first
            booking.
          </p>
        </div>
      </section>

      {/* Section 4 — Annual-only rationale */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Annual-only — why?
        </h2>
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
          <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
            Verification carries a real operational cost. Every Verified
            profile triggers a Companies House (or local-registry)
            lookup, a director-match check, an insurance-document review
            if the add-on is requested, and — for high-risk trades — an
            on-site visit at the work address. That work is performed by
            people on our side, not an automated tick-box, and it
            repeats every 12 months at renewal.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-neutral-700 sm:text-sm">
            To make that economics work we have to pair the check with an
            real funding commitment. Whether you pay £19.99/mo or
            £199.99/yr, the badge stays active as long as your
            subscription does. £199.99/year works out at £16.67/month —
            the better-value option for tradies committing to the
            verification queue long-term.
          </p>
        </div>
      </section>

      {/* Closing CTA — black surface mirroring hero. */}
      <section className="mx-auto mt-12 max-w-5xl px-4 pb-2 sm:px-6">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Lock £199.99/yr for life
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Join the Verified waitlist.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            Founding-member price locked, queue-priority on launch day.
            We'll email you when verification opens in Q3 2026.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/trade-off/verified-waitlist"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
              }}
            >
              Join the Verified waitlist
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
