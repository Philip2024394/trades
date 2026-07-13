// Xrated Trades — Refund Policy.
// Tracks the cancellation rights set out in our Terms of Service
// (clause 7) but expanded into the operational detail Stripe asks for
// during live-account review: cooling-off, pro-rata rules, monthly vs
// annual handling, refund processing time and exclusions.
// To be reviewed by a UK-qualified solicitor before relying on it in
// production.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

const SUPPORT_EMAIL = "support@thenetworkers.app";
const LAST_UPDATED = "28 June 2026";

export const metadata: Metadata = {
  title: "Refund Policy — Thenetworkers",
  description:
    "Refund rules for Thenetworkers subscriptions and add-ons — UK 14-day cooling-off, monthly vs annual handling, processing times and how to request a refund.",
  alternates: { canonical: "/legal/refunds" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Refund Policy — Thenetworkers",
    description:
      "14-day cooling-off, pro-rata rules, processing times and how to request a refund for Thenetworkers.",
    url: absolute("/legal/refunds")
  }
};

export default function RefundsPage() {
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
            Refund Policy
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-white/75 sm:text-sm">
            When you can get a refund, how much, and how to ask for one.
          </p>
          <p className="mt-3 text-[13px] text-white/55 sm:text-sm">
            Last updated: <span className="font-bold text-white/90">{LAST_UPDATED}</span>
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-10">
        <DisclaimerBanner />

        {/* Jurisdiction callout — sits above the headline so worldwide
            customers see the "we honour whichever is more generous"
            framing before reading the EU/UK-flavoured 14-day mechanic. */}
        <aside
          className="mt-6 rounded-2xl border-2 p-4 text-[13px] leading-relaxed sm:text-sm"
          style={{
            borderColor: `${XRATED_BRAND.accent}55`,
            background: `${XRATED_BRAND.accent}10`,
            color: "#3D2A00"
          }}
        >
          <p className="font-extrabold uppercase tracking-wider text-[11px]">
            Jurisdiction
          </p>
          <p className="mt-1.5">
            Statutory refund rights vary by country. <strong>We honour
            whichever is more generous</strong> — our standard
            14-day cooling-off OR your local statutory right. The
            sections below describe our policy baseline; nothing in
            this page overrides a mandatory consumer-protection right
            you have at home.
          </p>
        </aside>

        <article className="mt-8 flex flex-col gap-8 text-[13px] leading-relaxed text-neutral-800 sm:text-sm">
          <Section n="1" title="The headline">
            <p>
              You get a <strong>14-day cooling-off period</strong> from your
              first paid subscription charge, in line with the UK
              Consumer Contracts (Information, Cancellation and
              Additional Charges) Regulations 2013. Cancel inside that
              window and we’ll refund you in full, unless you’ve
              actively used the paid features in a way that uses up the
              service (see clause 3).
            </p>
            <p>
              Outside the cooling-off window, monthly subscribers get no
              refund for the current month, and annual subscribers
              normally get no pro-rata refund unless we’ve failed to
              deliver the Service for more than 7 consecutive days.
            </p>
          </Section>

          <Section n="2" title="The 14-day cooling-off period">
            <p>
              For the first 14 days after your first subscription
              payment, you can cancel for any reason and receive a full
              refund. This applies to:
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>your first paid month (Monthly plan);</li>
              <li>your first paid year (Annual plan);</li>
              <li>any add-on you bought in the same payment.</li>
            </ul>
            <p>
              <strong>EU and UK customers</strong> are exercising a
              statutory cooling-off right (Consumer Rights Directive
              2011/83/EU and UK CCR 2013).{" "}
              <strong>US customers</strong> do not have an EU-style
              statutory cooling-off period, but the same 14-day refund
              window applies under our policy.{" "}
              <strong>Other jurisdictions</strong> — the same 14
              days apply as a matter of policy, on top of any local
              statutory right you have.
            </p>
          </Section>

          <Section n="3" title="Waiver during the cooling-off period">
            <p>
              By starting your subscription you may ask us to begin
              providing the paid features straight away — for
              example by activating an add-on, switching your URL to{" "}
              <code>thenetworkers.app</code>, sending lead messages,
              displaying a Verified-tier badge or unlocking The Yard
              posts. That’s fine; we’ll start delivering.
            </p>
            <p>
              <strong>
                If you cancel inside the cooling-off window after asking
                us to start, we may deduct a proportionate amount for
                the time the Service was provided
              </strong>{" "}
              (regulation 36 of the Consumer Contracts Regulations 2013).
              If you have substantially used the paid features during
              the cooling-off period — for example using Job Diary
              extensively, broadcasting via Lead Alerts, or relying on
              Verified status to win work — you may lose the right to
              a full refund.
            </p>
            <p>
              We’ll always tell you in writing what we’re
              deducting and why before processing a partial refund.
            </p>
          </Section>

          <Section n="4" title="Monthly plans after the cooling-off">
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                Cancel any time from the Customer Portal or by emailing
                us.
              </li>
              <li>
                You keep paid access until the end of the current paid
                month.
              </li>
              <li>
                We do not refund the unused portion of the current
                month, and you won’t be billed again.
              </li>
            </ul>
          </Section>

          <Section n="5" title="Annual plans after the cooling-off">
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                Cancel any time. You keep paid access until the end of
                the current paid year.
              </li>
              <li>
                We do <strong>not</strong> pro-rata refund the unused
                months outside the cooling-off window…
              </li>
              <li>
                …<strong>except</strong> where the Service was
                unavailable to you due to our fault for more than 7
                consecutive days. In that case we’ll refund either the
                affected period or a sensible pro-rata share of the
                remaining year, whichever is fairer.
              </li>
            </ul>
          </Section>

          <Section n="6" title="The 14-day free trial">
            <p>
              The 14-day trial doesn’t require a payment method, so
              there’s nothing to refund. If you don’t subscribe at
              the end of the trial, your profile soft-downgrades to the
              Free tier automatically and we don’t charge you.
            </p>
          </Section>

          <Section n="7" title="The Free tier">
            <p>
              The Free tier is &pound;0. There’s nothing to refund.
            </p>
          </Section>

          <Section n="8" title="Add-ons">
            <p>
              Add-ons follow exactly the same rules as the tier they
              attach to:
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                Refundable inside the 14-day cooling-off (subject to the
                same waiver in clause 3);
              </li>
              <li>
                No refund for the current month / year outside the
                cooling-off window;
              </li>
              <li>
                Removing an add-on stops the next charge; you keep the
                add-on active until the end of the current billing
                period.
              </li>
            </ul>
          </Section>

          <Section n="9" title="How to request a refund">
            <p>
              <strong>Step 1 — Customer Portal.</strong> Open your
              Xrated Trades dashboard, click{" "}
              <strong>Billing &rarr; Manage subscription</strong>, and cancel.
              Stripe will email you a confirmation. If you cancel inside
              the cooling-off window and haven’t used the paid
              features, Stripe will issue the refund automatically.
            </p>
            <p>
              <strong>Step 2 — Email us if the Portal isn’t
              enough.</strong> If your case needs human review (partial
              refund, unavailability claim, billing dispute), email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              from the address on your account, with:
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>the slug or email on your account;</li>
              <li>the date and amount of the charge you’d like refunded;</li>
              <li>a one-line reason.</li>
            </ul>
            <p>
              We’ll acknowledge within 1 working day and resolve
              within 5 working days.
            </p>
          </Section>

          <Section n="10" title="Processing time">
            <p>
              Approved refunds go back to your original payment method
              through Stripe and normally show up in{" "}
              <strong>5 – 10 business days</strong>, depending on
              your card issuer. We can’t speed this up — the
              clearing time is set by your bank.
            </p>
          </Section>

          <Section n="11" title="Exclusions">
            <p>We will not refund (or will reverse a previous refund) where:</p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                you’ve breached our Terms by posting fake reviews,
                impersonating another person or business, or breaking the
                acceptable-use policy;
              </li>
              <li>
                the account has been suspended or closed for fraud, abuse
                of customers, or illegal content;
              </li>
              <li>
                you’ve already used the paid features substantially
                during a claimed cooling-off cancellation (see clause 3);
              </li>
              <li>
                the refund request comes more than 12 months after the
                payment.
              </li>
            </ul>
          </Section>

          <Section n="12" title="Chargebacks">
            <p>
              If you raise a chargeback with your bank instead of
              contacting us, we’ll suspend your account while the
              dispute is open. We always prefer to resolve a billing
              issue directly — please email us first.
            </p>
          </Section>

          <Section n="13" title="Statutory rights">
            <p>
              This policy doesn’t affect your statutory rights as a
              consumer under the law of your country of residence
              — for example, in the UK, the Consumer Rights Act
              2015 and the Consumer Contracts (Information, Cancellation
              and Additional Charges) Regulations 2013; in the EU, the
              Consumer Rights Directive (2011/83/EU) as implemented in
              your member state; in the US, state-level consumer
              protection laws (including California’s automatic
              renewal disclosure regime); in Australia, the Australian
              Consumer Law in Schedule 2 to the Competition and Consumer
              Act 2010. Where a statutory right would give you more
              than this policy, the statutory right wins.
            </p>
          </Section>

          <Section n="14" title="Contact">
            <p>
              <strong>Xrated Trades</strong>
              <br />
              Email:{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </Section>
        </article>
      </div>

      <XratedFooter />
    </main>
  );
}

function Section({
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
      <h2 className="text-base font-extrabold text-neutral-900 sm:text-lg">
        <span style={{ color: XRATED_BRAND.accent }}>{n}.</span> {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function DisclaimerBanner() {
  return (
    <aside
      className="rounded-2xl border-2 p-4 text-[13px] leading-relaxed sm:text-sm"
      style={{
        borderColor: `${XRATED_BRAND.accent}55`,
        background: `${XRATED_BRAND.accent}10`,
        color: "#3D2A00"
      }}
    >
      <p className="font-extrabold uppercase tracking-wider text-[11px]">
        Template notice
      </p>
      <p className="mt-1.5">
        This is a starting template based on UK consumer law and Stripe’s
        published merchant requirements. Have it reviewed by a UK-qualified
        solicitor before relying on it in production.
      </p>
    </aside>
  );
}
