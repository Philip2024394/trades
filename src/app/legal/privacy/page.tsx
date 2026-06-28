// Xrated Trades — Privacy Policy (UK GDPR + DPA 2018).
// Drafted to ICO guidance and Stripe's compliance checklist for live
// subscription accounts. Lists every sub-processor (Stripe, Supabase,
// Vercel, Resend, ImageKit, Cloudflare) explicitly so Stripe's review
// team can match the disclosure against the integrations on the
// merchant account. To be reviewed by a UK-qualified solicitor before
// relying on it in production.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

const SUPPORT_EMAIL = "support@xratedtrade.com";
const LAST_UPDATED = "28 June 2026";

export const metadata: Metadata = {
  title: "Privacy Policy — Xrated Trades",
  description:
    "How Xrated Trades collects, uses, shares and protects your personal data under UK GDPR — including our sub-processors (Stripe, Supabase, Vercel, Resend, ImageKit, Cloudflare) and your data-subject rights.",
  alternates: { canonical: "/legal/privacy" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Privacy Policy — Xrated Trades",
    description:
      "UK GDPR privacy policy for Xrated Trades — data collected, legal bases, retention, sub-processors and your rights.",
    url: absolute("/legal/privacy")
  }
};

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-white/75 sm:text-sm">
            How we collect, use and protect your personal data under UK
            GDPR and the Data Protection Act 2018.
          </p>
          <p className="mt-3 text-[13px] text-white/55 sm:text-sm">
            Last updated: <span className="font-bold text-white/90">{LAST_UPDATED}</span>
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-10">
        <DisclaimerBanner />

        <article className="mt-8 flex flex-col gap-8 text-[13px] leading-relaxed text-neutral-800 sm:text-sm">
          <Section n="1" title="Who is the data controller?">
            <p>
              <strong>Xrated Trades</strong> (trading name &ldquo;Xrated
              Trades&rdquo; / &ldquo;Trade Off&rdquo;) is the data
              controller for personal data collected through
              xratedtrade.com.
            </p>
            <p>
              <strong>
                Trade Off operates from the Republic of Ireland.
              </strong>{" "}
              EU GDPR applies as our baseline. UK GDPR applies to UK
              residents. US (CCPA / state privacy laws), Australian
              (Privacy Act 1988), and other applicable national privacy
              laws apply where relevant. Where two regimes both apply
              to a request, <strong>we honour the strongest applicable
              right in each case</strong>.
            </p>
            <p>
              You can contact us about anything in this policy at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section n="2" title="What data we collect">
            <p>When you use the Service we collect:</p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Account data</strong> &mdash; your email address (used
                for magic-link sign-in) and the slug you choose.
              </li>
              <li>
                <strong>Profile data</strong> &mdash; the name, trade, town,
                postcode, bio, photos, services and prices you choose to
                publish on your profile.
              </li>
              <li>
                <strong>Contact data</strong> &mdash; your WhatsApp number and
                phone number where you choose to publish them so
                customers can reach you.
              </li>
              <li>
                <strong>Billing data</strong> &mdash; for paid tiers, your name
                and billing address, plus payment-method metadata. Full
                card details are entered directly into Stripe&rsquo;s
                hosted checkout and never reach our servers; we only
                receive the last four digits, the card brand and the
                Stripe customer ID.
              </li>
              <li>
                <strong>Review data</strong> &mdash; when your customers leave
                reviews, we collect their name (or display alias), their
                review text and an optional contact email so we can
                verify the review is real.
              </li>
              <li>
                <strong>Technical data</strong> &mdash; IP address, browser
                user-agent, device type, timezone and the pages you view,
                collected in standard server access logs.
              </li>
              <li>
                <strong>Communications</strong> &mdash; the content of emails
                and WhatsApp messages you send us, kept for support
                history.
              </li>
            </ul>
            <p>
              We do not knowingly collect special-category data (health,
              ethnicity, biometric, etc.). Please don&rsquo;t put it on your
              profile.
            </p>
          </Section>

          <Section n="3" title="Legal bases we rely on">
            <p>
              UK GDPR requires us to have a lawful basis for every use of
              your personal data. Ours are:
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Performance of a contract</strong> &mdash; to set up
                your account, host your profile, process your
                subscription payment and deliver the features you signed
                up for.
              </li>
              <li>
                <strong>Legitimate interests</strong> &mdash; to keep the
                Service secure, prevent fraud and abuse, measure usage
                with privacy-respecting analytics, and improve our
                product. We balance these interests against your privacy
                rights and you can object at any time.
              </li>
              <li>
                <strong>Consent</strong> &mdash; for optional marketing email
                and for any non-essential cookies. You can withdraw
                consent at any time without affecting use of the Service.
              </li>
              <li>
                <strong>Legal obligation</strong> &mdash; to keep accounting
                records, respond to lawful requests from authorities, and
                meet our tax obligations.
              </li>
            </ul>
          </Section>

          <Section n="4" title="How long we keep your data">
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Active accounts</strong> &mdash; for as long as the
                account is open.
              </li>
              <li>
                <strong>Closed accounts</strong> &mdash; profile content is
                deleted within 30 days of account closure.
              </li>
              <li>
                <strong>Billing and tax records</strong> &mdash; kept for at
                least 6 years from the end of the relevant tax year, in
                line with HMRC requirements.
              </li>
              <li>
                <strong>Support emails</strong> &mdash; up to 3 years from the
                last message, then deleted.
              </li>
              <li>
                <strong>Server logs</strong> &mdash; up to 90 days.
              </li>
            </ul>
          </Section>

          <Section n="5" title="Who we share data with (sub-processors)">
            <p>
              We use a small number of trusted vendors to run the
              Service. Each one is bound by a data-processing agreement
              and only processes data on our instructions.
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Stripe Payments UK, Ltd.</strong> &mdash; takes
                subscription payments and stores card data. Stripe is
                PCI-DSS Level 1 certified. Stripe&rsquo;s policy:{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline"
                >
                  stripe.com/privacy
                </a>
                .
              </li>
              <li>
                <strong>Supabase Inc.</strong> &mdash; hosts our database and
                authentication (magic-link email sign-in). EU/US regions.
              </li>
              <li>
                <strong>Vercel Inc.</strong> &mdash; hosts the website and
                serverless functions. EU/US edge regions.
              </li>
              <li>
                <strong>Resend Inc.</strong> &mdash; sends our transactional
                emails (magic-links, billing receipts, support replies).
              </li>
              <li>
                <strong>ImageKit Pvt. Ltd.</strong> &mdash; CDN for the
                profile images and photos you upload.
              </li>
              <li>
                <strong>Cloudflare, Inc.</strong> &mdash; DNS and edge
                protection for our domains.
              </li>
            </ul>
            <p>
              We may also share data where required by law, to enforce
              our Terms, or in connection with a corporate restructure
              (e.g. merger or sale of the business). We do not sell your
              personal data and we do not share it with advertisers.
            </p>
          </Section>

          <Section n="6" title="International transfers">
            <p>
              We use sub-processors based in the EU, UK, and US (see the
              named list in clause 5). Where personal data is transferred
              outside the EEA or UK, we rely on the appropriate safeguard
              for the receiving country:
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>EU SCCs (Standard Contractual Clauses)</strong>{" "}
                under Commission Implementing Decision (EU) 2021/914,
                where required for EU-origin data;
              </li>
              <li>
                the <strong>UK International Data Transfer Agreement
                (IDTA)</strong> or the <strong>UK Addendum to the EU
                SCCs</strong>, for UK-origin data;
              </li>
              <li>
                UK adequacy regulations &mdash; including the{" "}
                <strong>UK&ndash;US Data Bridge</strong> for transfers
                to vendors self-certified under the UK extension to the
                EU&ndash;US Data Privacy Framework;
              </li>
              <li>
                EU adequacy decisions where they exist (e.g. the{" "}
                <strong>EU&ndash;US Data Privacy Framework</strong>).
              </li>
            </ul>
            <p>
              We keep records of these safeguards and can share them on
              request.
            </p>
          </Section>

          <Section n="7" title="Cookies and similar technologies">
            <p>
              We use a small number of cookies and similar storage:
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Strictly necessary</strong> &mdash; a session cookie
                that keeps you signed in after you click a magic-link,
                and a CSRF token. These don&rsquo;t need consent.
              </li>
              <li>
                <strong>Preferences</strong> &mdash; remember your dashboard
                view choices and dismiss-state for in-app banners.
              </li>
              <li>
                <strong>Analytics</strong> &mdash; we may use first-party,
                privacy-respecting analytics (no third-party
                advertising cookies) to count page-views and measure
                conversion. Where local law requires it, we ask for
                consent first.
              </li>
            </ul>
            <p>
              You can clear cookies from your browser at any time;
              clearing the session cookie will sign you out.
            </p>
          </Section>

          <Section n="8" title="Your rights under UK GDPR">
            <p>
              You have the right to:
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Access</strong> the personal data we hold about you;
              </li>
              <li>
                <strong>Rectify</strong> data that is inaccurate or
                incomplete;
              </li>
              <li>
                <strong>Erase</strong> your data (&ldquo;right to be
                forgotten&rdquo;), subject to our legal record-keeping
                duties;
              </li>
              <li>
                <strong>Portability</strong> &mdash; receive a copy of the data
                you gave us in a structured, machine-readable format;
              </li>
              <li>
                <strong>Restrict</strong> the processing of your data while a
                question about it is resolved;
              </li>
              <li>
                <strong>Object</strong> to processing based on legitimate
                interests, and to direct marketing at any time;
              </li>
              <li>
                <strong>Withdraw consent</strong> where consent is the legal
                basis we&rsquo;re relying on.
              </li>
            </ul>
            <p>
              To exercise any of these rights, email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              from the address on your account. We&rsquo;ll respond within
              one calendar month, normally faster.
            </p>
          </Section>

          <Section n="9" title="Supervisory authority complaints">
            <p>
              If you think we&rsquo;ve mishandled your personal data, please
              email us first at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              so we can put it right.
            </p>
            <p>
              You can also lodge a complaint with the supervisory
              authority for your country:
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>EU / Ireland</strong> &mdash; Data Protection
                Commission (DPC):{" "}
                <a
                  href="https://www.dataprotection.ie"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline"
                >
                  dataprotection.ie
                </a>
                . As we operate from the Republic of Ireland, the DPC
                is our lead supervisory authority under EU GDPR.
              </li>
              <li>
                <strong>UK</strong> &mdash; Information Commissioner&rsquo;s
                Office (ICO):{" "}
                <a
                  href="https://ico.org.uk/make-a-complaint/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline"
                >
                  ico.org.uk
                </a>
                . Helpline 0303 123 1113. Address: Wycliffe House,
                Water Lane, Wilmslow, Cheshire SK9 5AF.
              </li>
              <li>
                <strong>US (California)</strong> &mdash; CCPA / CPRA
                rights (right to know, delete, correct, opt-out of sale
                or sharing). Exercise these by emailing{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                  {SUPPORT_EMAIL}
                </a>
                . You may also contact the California Privacy
                Protection Agency at{" "}
                <a
                  href="https://cppa.ca.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline"
                >
                  cppa.ca.gov
                </a>
                .
              </li>
              <li>
                <strong>Other jurisdictions</strong> &mdash; please
                contact your local supervisory or data-protection
                authority (for example the OAIC in Australia, the OPC
                in Canada, the LGPD authority ANPD in Brazil).
              </li>
            </ul>
          </Section>

          <Section n="10" title="Security">
            <p>
              We use HTTPS everywhere, role-based access controls to
              limit who on our side can see your data, encrypted
              database storage, and short-lived magic-link tokens for
              sign-in. No system is perfect, but we take reasonable
              technical and organisational measures to protect your
              data and we will tell you and the ICO without undue delay
              if a breach affecting your personal data ever occurs.
            </p>
          </Section>

          <Section n="11" title="Children">
            <p>
              The Service is for tradespeople running a business and is
              not intended for anyone under 18. We do not knowingly
              collect personal data from children. If you believe a
              child has signed up, please email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              and we will remove the account.
            </p>
          </Section>

          <Section n="12" title="Changes to this policy">
            <p>
              We may update this policy as the Service changes. The
              &ldquo;Last updated&rdquo; date at the top tells you when. If
              we make a material change that affects how we use your
              data, we&rsquo;ll email you and ask for fresh consent if
              consent is the basis.
            </p>
          </Section>

          <Section n="13" title="Contact">
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
        This is a starting template based on UK consumer law and Stripe&rsquo;s
        published merchant requirements. Have it reviewed by a UK-qualified
        solicitor before relying on it in production.
      </p>
    </aside>
  );
}
