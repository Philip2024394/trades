// Xrated Trades — Terms & Conditions / Terms of Service.
// Drafted from UK consumer law (Consumer Rights Act 2015 + Consumer
// Contracts Regulations 2013) and Stripe's published merchant
// requirements for live subscription accounts. Plain-English where
// possible; the auto-renewal disclosure is the load-bearing clause
// that Stripe scans for during account review. To be reviewed by a
// UK-qualified solicitor before relying on it in production.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

const SUPPORT_EMAIL = "support@xratedtrade.com";
const LAST_UPDATED = "28 June 2026";

export const metadata: Metadata = {
  title: "Terms & Conditions — Xrated Trades",
  description:
    "The Terms & Conditions for Xrated Trades subscriptions — service description, account terms, auto-renewing billing, 14-day cooling-off rights and how to cancel. Governed by the Republic of Ireland; worldwide customers welcome.",
  alternates: { canonical: "/legal/terms" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Terms & Conditions — Xrated Trades",
    description:
      "Service terms, subscription terms, auto-renewal disclosure, cancellation rights and governing law for Xrated Trades.",
    url: absolute("/legal/terms")
  }
};

export default function TermsPage() {
  return (
    <main className="bg-white pb-20">
      <XratedHeader />

      {/* Hero — short black banner matching pricing/help. */}
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
            Terms &amp; Conditions
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-white/75 sm:text-sm">
            The agreement between you and Xrated Trades when you use
            xratedtrade.com or subscribe to one of our paid tiers.
          </p>
          <p className="mt-3 text-[13px] text-white/55 sm:text-sm">
            Last updated: <span className="font-bold text-white/90">{LAST_UPDATED}</span>
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-10">
        <DisclaimerBanner />

        <article className="mt-8 flex flex-col gap-8 text-[13px] leading-relaxed text-neutral-800 sm:text-sm">
          <Section n="1" title="Who we are">
            <p>
              xratedtrade.com (operated by Xrated Trades) runs the
              website at <strong>xratedtrade.com</strong> (the
              “Service”). In these Terms, “we”,
              “us” and “our” mean Xrated Trades.
              “You” means the person who signs up for or uses the
              Service.
            </p>
            <p>
              You can contact us at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section n="1a" title="Worldwide service">
            <p>
              The Service is provided from the{" "}
              <strong>Republic of Ireland</strong>. Customers worldwide
              are welcome — UK, EU, US, Australia, and elsewhere.
              Local consumer rights vary by jurisdiction; see also our{" "}
              <a href="/legal/refunds" className="font-bold underline">
                Refunds page
              </a>{" "}
              for how those rights interact with our policy.
            </p>
          </Section>

          <Section n="2" title="What the Service is">
            <p>
              The Service is a SaaS platform for construction
              tradespeople. A paid subscription gives you a public profile
              under your chosen slug (for example{" "}
              <code>xratedtrade.com/your-name</code>), a service catalogue,
              customer reviews, lead-capture features, optional add-ons and
              access to The Yard (our private trades-only board).
            </p>
            <p>
              The Service is provided for business use. We do not handle
              jobs, take payments from customers on your behalf, or act as
              an agent between you and your customers. We are a directory
              and profile platform only.
            </p>
          </Section>

          <Section n="3" title="Your account">
            <p>
              You sign up with an email address and authenticate via a
              magic-link sent to that inbox. You are responsible for
              keeping access to your email account secure. Anyone who
              clicks a valid magic-link can access your dashboard, so
              treat your inbox as you would a password.
            </p>
            <p>
              When you sign up, you choose a slug (the URL part after
              <code> /</code>). Your slug stays yours for as long as your
              account exists, whether you are on the Free, Paid or Verified
              tier. We may refuse, reclaim or change a slug that infringes
              a third-party trademark, impersonates another person or
              business, or breaches our acceptable-use policy in clause 8.
            </p>
            <p>You must be at least 18 years old to open an account.</p>
          </Section>

          <Section n="4" title="Subscription tiers and pricing">
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Free</strong> — &pound;0. Public profile on the free
                tier, basic widgets only.
              </li>
              <li>
                <strong>Paid</strong> — &pound;14.99 per month or &pound;139.99 per year
                (save &pound;40).
              </li>
              <li>
                <strong>Verified</strong> — &pound;19.99 per month or &pound;199.99 per
                year (save &pound;40). Currently waitlist; opens Q3 2026.
              </li>
              <li>
                <strong>Add-ons</strong> — 10 monthly add-ons priced &pound;2 to
                &pound;7 each (Trade Center, Services Prices, Downloads, Job
                Diary, Wholesale Mode, Custom Domain, Lead Alerts,
                Materials Network, Quote Pipeline, FAQ Page). Add-ons are
                billed alongside your subscription on the same cadence.
              </li>
            </ul>
            <p>
              All prices are in pounds sterling (GBP) and include VAT
              where applicable. We may change prices on 30 days’ notice
              by email. Your renewal price is the price displayed in your
              dashboard at the time of renewal; if you do not accept a
              price change you can cancel before it takes effect.
            </p>
          </Section>

          <Section n="5" title="The 14-day free trial">
            <p>
              Every new signup gets 14 days of full Paid-tier access at no
              charge. <strong>No payment method is required to start the trial.</strong>
            </p>
            <p>
              At the end of the 14 days, your profile soft-downgrades to
              the Free tier automatically. We will not bill you unless you
              actively choose to subscribe through Stripe Checkout. You
              keep your slug, your reviews, your photos and your existing
              content either way.
            </p>
          </Section>

          <Section n="6" title="Billing and auto-renewal (important)">
            <p>
              <strong>
                Paid subscriptions renew automatically. By starting a Paid
                or Verified subscription, you authorise us to charge your
                saved payment method on each renewal date until you cancel.
              </strong>
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Monthly plans</strong> renew every month on the
                same day of the month as the first charge.
              </li>
              <li>
                <strong>Annual plans</strong> renew every year on the same
                date as the first charge.
              </li>
              <li>
                Payments are processed by{" "}
                <strong>Stripe Payments Europe, Limited</strong>{" "}
                (Republic of Ireland). All card data is handled directly
                by Stripe; we never see or store your full card number.
              </li>
              <li>
                Renewal charges appear on your statement as “Xrated
                Trades” or “XRATEDTRADE”.
              </li>
              <li>
                You can view all upcoming charges, update your payment
                method, and cancel renewal at any time from the Stripe
                Customer Portal linked in your Xrated Trades dashboard.
              </li>
            </ul>
            <p>
              If a renewal payment fails, Stripe will retry up to three
              times over the following week. If all retries fail, your
              account moves to the Free tier and your paid features are
              disabled until you update your payment method.
            </p>
          </Section>

          <Section n="7" title="Cancellation and 14-day cooling-off">
            <p>
              <strong>
                EU and UK consumers benefit from a statutory 14-day
                cooling-off period under the Consumer Rights Directive
                (2011/83/EU) and the UK Consumer Contracts (Information,
                Cancellation and Additional Charges) Regulations 2013.
              </strong>{" "}
              You have 14 days from the date of your first paid
              subscription charge to cancel for a full refund. This is
              your statutory cooling-off period for distance contracts.
            </p>
            <p>
              <strong>Customers in other jurisdictions</strong> retain
              whatever statutory rights apply locally. As a matter of
              policy we extend the same 14-day cancellation window to
              every customer worldwide, regardless of whether their
              local law requires it — see our{" "}
              <a href="/legal/refunds" className="font-bold underline">
                Refund Policy
              </a>{" "}
              for the detail.
            </p>
            <p>
              <strong>Waiver during cooling-off.</strong> If you ask us to
              start providing the paid features immediately (for example
              by activating a paid-only add-on, sending a customer
              broadcast, or using a Verified-tier badge during the 14 days)
              and then cancel within the cooling-off window, we may
              deduct a proportionate amount for the service already
              supplied. If you use the paid features substantially during
              the cooling-off period you may lose the right to a full
              refund, in line with regulation 36.
            </p>
            <p>
              <strong>After the cooling-off window:</strong>
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Monthly plans</strong> — cancel any time. You keep
                access until the end of the current paid month. We do not
                refund the unused portion of the current month.
              </li>
              <li>
                <strong>Annual plans</strong> — cancel any time. You keep
                access until the end of the current paid year. We do not
                refund the unused portion outside the cooling-off window,
                except where the Service has been unavailable to you for
                more than 7 consecutive days due to our fault (see clause
                12).
              </li>
            </ul>
            <p>
              <strong>How to cancel:</strong>
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                Open your Xrated Trades dashboard and click{" "}
                <strong>Billing &rarr; Manage subscription</strong>. This opens
                the Stripe Customer Portal where you can cancel renewal in
                one click.
              </li>
              <li>
                Or email{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                  {SUPPORT_EMAIL}
                </a>{" "}
                from the address on your account and ask us to cancel.
                We’ll confirm in writing within 1 working day.
              </li>
            </ul>
            <p>
              Full details, including refund timelines, are set out in our{" "}
              <a href="/legal/refunds" className="font-bold underline">
                Refund Policy
              </a>
              .
            </p>
          </Section>

          <Section n="8" title="Acceptable use">
            <p>You agree not to use the Service to:</p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                post fake reviews, fabricated case studies or testimonials
                you cannot evidence;
              </li>
              <li>
                impersonate another tradesperson, company or trade body
                (Gas Safe, NICEIC, FENSA, FMB, CISRS etc.);
              </li>
              <li>
                advertise services that require a licence or qualification
                you do not hold;
              </li>
              <li>
                upload content that is illegal, defamatory, obscene,
                harassing, or that infringes anyone else’s intellectual
                property or privacy;
              </li>
              <li>
                scrape, mirror or resell the Service or any other user’s
                content;
              </li>
              <li>
                use the Service to send unsolicited bulk messages or to
                run lead-generation farms for third parties.
              </li>
            </ul>
            <p>
              We may suspend or close your account without refund if we
              reasonably believe you have breached this clause. We will
              tell you why where we can.
            </p>
            <p>
              The full rules and the consequences of breach are set out
              in our{" "}
              <a href="/legal/aup" className="font-bold underline">
                Acceptable Use Policy
              </a>
              .
            </p>
          </Section>

          <Section n="9" title="Your content and our content">
            <p>
              <strong>You own your content.</strong> Reviews submitted by
              your customers, photos you upload, the services you list,
              your bio and your branding all remain yours.
            </p>
            <p>
              <strong>You grant us a licence to display it.</strong> So that
              we can run the Service, you give us a worldwide,
              royalty-free, non-exclusive licence to host, copy, cache,
              display and distribute your content on xratedtrade.com,
              xratedtrades.com, in search results, in our PWA and in
              promotional materials for the Service. This licence ends
              when you close your account, except where we are legally
              required to keep a copy (for example for tax or dispute
              records).
            </p>
            <p>
              <strong>We own the platform.</strong> The Xrated Trades
              software, design, brand, copy, logo, illustrations and the
              database that organises your content are owned by us or
              our licensors. You get the right to use the Service; you do
              not get any ownership of it.
            </p>
          </Section>

          <Section n="10" title="Customer reviews">
            <p>
              Customers can submit reviews on your public profile when
              you are on the Paid or Verified tier. Reviews are the
              opinions of the people who write them. We do not pre-moderate
              every review, but we will remove a review that is clearly
              fake, defamatory or breaches the acceptable-use policy in
              clause 8 if you flag it to us with evidence.
            </p>
          </Section>

          <Section n="11" title="Service availability">
            <p>
              We aim to keep the Service available 24/7 but we do not
              guarantee uninterrupted access. We may need to take the
              Service down for maintenance, upgrades or for reasons
              outside our control. Where downtime is planned, we will
              try to give notice in the dashboard or by email.
            </p>
          </Section>

          <Section n="12" title="Our liability">
            <p>
              Nothing in these Terms limits or excludes our liability for
              death or personal injury caused by our negligence, for
              fraud or fraudulent misrepresentation, or for any other
              liability that cannot be limited under Irish law (or the
              mandatory consumer-protection law of your country of
              residence).
            </p>
            <p>
              Subject to the above, our total liability to you for any
              claim arising out of or in connection with the Service{" "}
              <strong>
                is capped at the total subscription fees you have paid us
                in the 12 months immediately before the event that gave
                rise to the claim
              </strong>
              .
            </p>
            <p>
              We are not liable for loss of profits, loss of business,
              loss of goodwill or any indirect or consequential loss.
              The Service is a profile platform — we are not
              responsible for the jobs you win or lose through it, the
              quality of the work you do, the conduct of your customers,
              or any contract you enter into with a customer you meet
              through the Service.
            </p>
          </Section>

          <Section n="13" title="Termination">
            <p>
              You can close your account at any time by emailing{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
            <p>
              We can suspend or close your account on notice if you
              breach these Terms, fail to pay, or use the Service in a
              way that exposes us or other users to harm or legal risk.
              In serious cases (fraud, illegal content, abuse) we can
              close the account immediately and without refund.
            </p>
            <p>
              When the account closes, your public profile is removed
              and your content is deleted from active systems within 30
              days, except where we are required to keep records for
              accounting, tax or legal reasons.
            </p>
          </Section>

          <Section n="14" title="Changes to the Service or these Terms">
            <p>
              We are continuously improving the Service. Small changes
              (new features, design tweaks, bug fixes) happen at any
              time without notice. For material changes that disadvantage
              you (a price rise, removal of a paid feature, a change to
              your refund rights) we will give you at least{" "}
              <strong>30 days’ notice by email</strong> and you may
              cancel before the change takes effect.
            </p>
          </Section>

          <Section n="15" title="Governing law and disputes">
            <p>
              These Terms are governed by the laws of the{" "}
              <strong>Republic of Ireland</strong>, where our merchant of
              record (Stripe Payments Europe, Limited) is registered.
              Any dispute will be heard by the courts of the Republic of
              Ireland. Consumers retain the protection of any mandatory
              consumer-protection laws of their country of residence
              that cannot be displaced by contract.
            </p>
            <p>
              If you have a complaint, please email us first at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              so we can try to put it right.
            </p>
          </Section>

          <Section n="16" title="Contact">
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
