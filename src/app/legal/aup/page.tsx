// Xrated Trades — Acceptable Use Policy (AUP).
// Plain English summary of what's not allowed on the platform and what
// happens when you breach it. Linked from Terms section 8 (Acceptable
// Use). Stripe risk reviewers expect a dedicated AUP for subscription
// SaaS that hosts user-generated content (reviews, photos, listings).

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

const SUPPORT_EMAIL = "support@thenetworkers.app";
const LAST_UPDATED = "28 June 2026";

export const metadata: Metadata = {
  title: "Acceptable Use Policy — Thenetworkers",
  description:
    "What you may and may not do on Thenetworkers — no fake reviews, no impersonation, no illegal trades, no scraping, no harassment, no payment fraud. Consequences of breach: suspension, removal, refund refusal, ban.",
  alternates: { canonical: "/legal/aup" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Acceptable Use Policy — Thenetworkers",
    description:
      "Plain-English platform rules and the consequences of breaching them.",
    url: absolute("/legal/aup")
  }
};

export default function AcceptableUsePage() {
  return (
    <main className="bg-white pb-20">
      <XratedHeader />

      <section
        className="border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Legal
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            Acceptable Use Policy
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-white/75 sm:text-sm">
            What's allowed, what's not, and what happens when somebody
            crosses a line. Designed to keep the platform useful for the
            tradies and customers who turn up in good faith.
          </p>
          <p className="mt-3 text-[13px] text-white/55 sm:text-sm">
            Last updated:{" "}
            <span className="font-bold text-white/90">{LAST_UPDATED}</span>
          </p>
        </div>
      </section>

      <article className="mx-auto mt-10 flex max-w-3xl flex-col gap-7 px-4 text-[13px] leading-relaxed text-neutral-800 sm:px-6 sm:text-sm">
        <p>
          This Acceptable Use Policy (AUP) sits underneath our{" "}
          <Link href="/legal/terms" className="font-bold underline">
            Terms & Conditions
          </Link>
          . If anything below conflicts with the Terms, the Terms win.
        </p>

        <Rule n="1" title="No fake reviews or fabricated testimonials">
          Do not post reviews you cannot evidence, write reviews on your
          own profile under another identity, or buy/sell reviews. Every
          review must come from a real customer of real work you did.
        </Rule>

        <Rule n="2" title="No impersonation">
          Do not impersonate another tradesperson, company, or trade body
          (Gas Safe, NICEIC, FENSA, FMB, CISRS etc.). Don't display
          credentials or memberships you don't hold.
        </Rule>

        <Rule n="3" title="No illegal trades or unlicensed work">
          Do not advertise services that require a licence or
          qualification you don't hold, and do not offer work that's
          illegal in the customer's jurisdiction (for example,
          unregistered gas work, unlicensed electrical work where local
          law requires it, or unlicensed asbestos handling).
        </Rule>

        <Rule n="4" title="No scraping or reselling">
          Do not scrape, mirror, copy at scale, or resell Xrated Trades
          content, profiles, reviews, or the platform itself. Automated
          access (bots, crawlers, headless browsers) is allowed only
          where we publish an opt-in via our robots policy or an
          authorised API.
        </Rule>

        <Rule n="5" title="No harassment or abuse">
          Do not harass, threaten, dox, or send abusive messages to
          tradespeople, customers, or our team. Do not use the platform
          to organise harassment off-platform.
        </Rule>

        <Rule n="6" title="No payment fraud or chargeback abuse">
          Do not use stolen card details, submit fraudulent chargebacks,
          or attempt to evade subscription billing through repeated trial
          signups under multiple identities. We share confirmed fraud
          signals with Stripe.
        </Rule>

        <Rule n="7" title="No illegal, harmful, or infringing content">
          Do not upload content that is illegal, defamatory, obscene, or
          sexually explicit, or that infringes anyone's intellectual
          property, privacy, or right of publicity. This includes photos
          of jobs you didn't do.
        </Rule>

        <Rule n="8" title="No spam, mass DMs, or lead-gen farms">
          Do not use Xrated Trades to send unsolicited bulk messages, to
          farm customer enquiries for resale, or to run third-party
          lead-generation operations. WhatsApp, email and phone
          handovers are for genuine job conversations only.
        </Rule>

        <Rule n="9" title="No tampering with the platform">
          Do not probe, scan, or test the security of the Service
          without our written permission. Do not attempt to bypass
          rate-limits, authentication, payment, or tier-gating
          mechanisms. Responsible disclosure of bugs is welcome — email
          us at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-bold underline"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </Rule>

        <Rule n="10" title="Consequences of breach">
          If we reasonably believe you've breached this AUP, we may
          (without limit and at our discretion):
          <ul className="mt-3 ml-4 flex list-disc flex-col gap-2">
            <li>
              <strong>Remove content</strong> (reviews, photos, listings,
              messages) we believe to be in breach;
            </li>
            <li>
              <strong>Suspend</strong> your account temporarily while we
              investigate;
            </li>
            <li>
              <strong>Refuse a refund</strong> for the current billing
              period, including during the statutory cooling-off window
              where regulation 36 of the Consumer Contracts Regulations
              2013 applies;
            </li>
            <li>
              <strong>Permanently ban</strong> the account, the
              underlying email address, the payment method and any
              associated profiles from the platform;
            </li>
            <li>
              <strong>Report</strong> the breach to law enforcement,
              regulators, trade bodies, or Stripe where we are legally
              required or we judge it appropriate.
            </li>
          </ul>
          Where we can, we'll tell you what we've done and why. If you
          think we got it wrong, reply to that notice and we'll review.
        </Rule>

        <p className="mt-4 text-[13px] text-neutral-600">
          Questions about this policy? Email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-bold underline"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </article>

      <XratedFooter />
    </main>
  );
}

function Rule({
  n,
  title,
  children
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-baseline gap-2 text-lg font-extrabold text-neutral-900 sm:text-xl">
        <span style={{ color: XRATED_BRAND.accent }}>{n}.</span>
        <span>{title}</span>
      </h2>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </section>
  );
}
