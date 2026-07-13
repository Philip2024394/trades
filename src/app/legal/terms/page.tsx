// Xrated Trades — Terms & Conditions / Terms of Service.
//
// Comprehensive Shopify/Wix-style Terms rewritten for the Business
// Operating System positioning:
//   • 4-tier pricing (Free / Starter / Professional / Business)
//   • Apps + App Store terminology (replaces legacy "add-ons")
//   • Studio (visual editor) references
//   • Industry Packs
//
// LEGAL REVIEW STATUS: DRAFT — MUST be reviewed by a UK-qualified
// solicitor before deployment. See DisclaimerBanner. Sections carrying
// meaningful liability (auto-renewal, cooling-off waiver, limitation
// of liability, IP, indemnification, jurisdiction) are the priority
// review items.
//
// Notes for legal review:
//   • Payment processor is not currently wired to Stripe (manual
//     billing today) — payment sections use generic wording ("our
//     payment processor") until Stripe integration lands.
//   • Governing law is currently Republic of Ireland (matches Stripe
//     merchant-of-record). Solicitor should confirm this is still
//     correct given the platform's UK-facing customer base.
//   • Starter (£9.99/mo) and Business (£24.99/mo) tiers are currently
//     on a waitlist — signup only takes emails, no billing until launch.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

const SUPPORT_EMAIL = "support@xratedtrade.com";
const LAST_UPDATED = "3 July 2026";

export const metadata: Metadata = {
  title: "Terms & Conditions — The Network",
  description:
    "The Terms & Conditions for The Network — the platform for construction trades. Service description, account terms, subscription plans, auto-renewing billing, App Warehouse terms, 14-day cooling-off rights and how to cancel.",
  alternates: { canonical: "/legal/terms" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Terms & Conditions — The Network",
    description:
      "Service terms, subscription terms, App Warehouse terms, auto-renewal disclosure, cancellation rights and governing law for The Network.",
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
            xratedtrade.com, install Apps from the App Store, or
            subscribe to one of our paid plans.
          </p>
          <p className="mt-3 text-[13px] text-white/55 sm:text-sm">
            Last updated: <span className="font-bold text-white/90">{LAST_UPDATED}</span>
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-10">
        <DisclaimerBanner />

        <article className="mt-8 flex flex-col gap-8 text-[13px] leading-relaxed text-neutral-800 sm:text-sm">
          {/* ─── 1. Who we are ────────────────────────────────── */}
          <Section n="1" title="Who we are">
            <p>
              xratedtrade.com (operated by Xrated Trades) provides a
              cloud-based business platform at{" "}
              <strong>xratedtrade.com</strong> (the &ldquo;Service&rdquo;).
              In these Terms, &ldquo;we&rdquo;, &ldquo;us&rdquo; and
              &ldquo;our&rdquo; mean Xrated Trades. &ldquo;You&rdquo; and
              &ldquo;your&rdquo; mean the person or business who signs
              up for or uses the Service.
            </p>
            <p>
              You can contact us at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Section>

          {/* ─── 2. Acceptance of these Terms ─────────────────── */}
          <Section n="2" title="Acceptance of these Terms">
            <p>
              By creating an account, accessing the Service, or
              clicking &ldquo;I agree&rdquo; on any signup screen, you
              agree to be bound by these Terms, our{" "}
              <a href="/legal/privacy" className="font-bold underline">
                Privacy Policy
              </a>
              , our{" "}
              <a href="/legal/aup" className="font-bold underline">
                Acceptable Use Policy
              </a>{" "}
              and any additional plan-specific or App-specific terms we
              present during signup or install.
            </p>
            <p>
              If you are using the Service on behalf of a company, sole
              trader, partnership or other legal entity, you represent
              that you have authority to bind that entity to these
              Terms, and &ldquo;you&rdquo; refers to that entity.
            </p>
            <p>
              If you do not agree to these Terms, you must not use the
              Service.
            </p>
          </Section>

          {/* ─── 3. Worldwide service ─────────────────────────── */}
          <Section n="3" title="Worldwide service">
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

          {/* ─── 4. Definitions ───────────────────────────────── */}
          <Section n="4" title="Definitions">
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Service</strong> — the Xrated Trades platform,
                including the public site at xratedtrade.com, the
                Studio visual editor, the App Store, Industry Packs,
                Apps, dashboards, APIs and any related mobile or web
                surfaces.
              </li>
              <li>
                <strong>Business App</strong> — the merchant-facing
                application we host for you at your chosen slug
                (e.g. <code>xratedtrade.com/your-name</code>). Your
                business app is what your customers interact with.
              </li>
              <li>
                <strong>Studio</strong> — the visual editor within the
                Service used to design pages, edit theme, install Apps,
                and publish changes to your Business App.
              </li>
              <li>
                <strong>App</strong> — an installable feature that adds
                functionality to your Business App (for example
                Meet the Team, Newsletter, Trade Circle, Product
                Catalogue). Apps are installed from the App Store.
              </li>
              <li>
                <strong>App Store</strong> — the catalogue of Apps
                available inside the Service. Some Apps are free; some
                require a paid subscription plan.
              </li>
              <li>
                <strong>Industry Pack</strong> — a curated bundle of
                Apps, brand tokens and starter content designed for a
                specific trade vertical (Plant Hire, Builder Merchant,
                Plumber, etc.).
              </li>
              <li>
                <strong>Content</strong> — any material you upload,
                submit or generate through the Service (photos, text,
                reviews you receive, product listings, customer data,
                pricing, etc.).
              </li>
              <li>
                <strong>Customer</strong> — the end user who visits
                your Business App to view your services, request a
                quote, place an order or contact you.
              </li>
              <li>
                <strong>Paid Plan</strong> — Starter, Professional or
                Business — see clause 6.
              </li>
              <li>
                <strong>Free Plan</strong> — the £0 tier — see clause 6.
              </li>
            </ul>
          </Section>

          {/* ─── 5. What the Service is ───────────────────────── */}
          <Section n="5" title="What the Service is">
            <p>
              The Service is a <strong>Business Operating System</strong>{" "}
              for trade businesses. A subscription (or the Free plan)
              gives you access to:
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                A hosted <strong>Business App</strong> at your chosen
                slug that customers can visit, share and bookmark.
              </li>
              <li>
                <strong>Studio</strong> — a visual editor to design and
                customise your Business App without writing code.
              </li>
              <li>
                The <strong>App Store</strong> — a catalogue of
                installable Apps you can add to your Business App.
              </li>
              <li>
                <strong>Industry Packs</strong> — pre-configured
                bundles of Apps for specific trades.
              </li>
              <li>
                <strong>Publishing</strong> — the ability to push your
                edits live to customers, with version history.
              </li>
            </ul>
            <p>
              The Service is provided for business use. We do not
              handle jobs or perform work on your behalf. Unless a
              specific paid App expressly says otherwise, we do not
              take payments from your customers, do not act as an
              agent between you and your customers, and do not
              guarantee the quality of any customer we introduce to
              you.
            </p>
          </Section>

          {/* ─── 6. Your account ──────────────────────────────── */}
          <Section n="6" title="Your account">
            <p>
              You register with an email address and a WhatsApp number.
              You authenticate via a magic-link sent to the email
              address on your account (or by password if you have set
              one). You are responsible for keeping access to your
              email inbox and password secure. Anyone who clicks a
              valid magic-link can access your Studio dashboard.
            </p>
            <p>
              When you sign up, you choose a{" "}
              <strong>slug</strong> (the URL part after the domain).
              Your slug stays yours for as long as your account exists,
              whether you are on the Free plan or a Paid Plan. We may
              refuse, reclaim or change a slug that infringes a
              third-party trademark, impersonates another person or
              business, or breaches our{" "}
              <a href="/legal/aup" className="font-bold underline">
                Acceptable Use Policy
              </a>
              .
            </p>
            <p>
              You must be at least <strong>18 years old</strong> to
              open an account. One business = one account. You may not
              share your credentials with a third party without our
              express permission.
            </p>
            <p>
              You are responsible for all activity on your account,
              including anything installed, published or purchased
              through the App Store.
            </p>
          </Section>

          {/* ─── 7. Subscription plans and pricing ────────────── */}
          <Section n="7" title="Subscription plans and pricing">
            <p>
              The Service is offered on the following plans. Feature
              availability per plan is described in the{" "}
              <a href="/trade-off/pricing" className="font-bold underline">
                pricing page
              </a>{" "}
              at the time of purchase and forms part of these Terms.
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Free</strong> — &pound;0. Starter Business App,
                Studio access, basic theme, Link in Bio App, contact
                details, basic pages, publishing. Free for life,
                no card required.
              </li>
              <li>
                <strong>Starter</strong> — &pound;9.99 per month.
                Currently on waitlist while we finalise billing
                infrastructure. Includes a complete Business App,
                Studio Editor, core App Store, product catalogue,
                contact forms, basic AI assistance and standard themes.
              </li>
              <li>
                <strong>Professional</strong> — &pound;14.99 per month
                or &pound;139.99 per year (save &pound;40). Our
                recommended plan. Includes everything in Starter plus
                premium Apps, Trade Circle, industry-specific Apps,
                AI content tools, advanced promotions, analytics and
                advanced Studio features.
              </li>
              <li>
                <strong>Business</strong> — &pound;24.99 per month.
                Currently on waitlist. Includes everything in
                Professional plus multi-user accounts, multiple
                locations, advanced AI, premium Industry Packs,
                advanced automation, priority support and future
                enterprise features (which will be described on the
                pricing page as they become available).
              </li>
            </ul>
            <p>
              All prices are in <strong>pounds sterling (GBP)</strong>{" "}
              and include VAT where applicable. If you are outside the
              UK, your bank will convert the GBP charge at its own
              prevailing rate; we do not charge a currency-conversion
              fee ourselves.
            </p>
            <p>
              We may change prices on{" "}
              <strong>30 days&rsquo; notice by email</strong>. Your
              renewal price is the price displayed in your dashboard at
              the time of renewal. If you do not accept a price change,
              you can cancel before it takes effect.
            </p>
          </Section>

          {/* ─── 8. 14-day free trial ─────────────────────────── */}
          <Section n="8" title="The 14-day free trial">
            <p>
              Every new signup that activates a Paid Plan receives{" "}
              <strong>14 days of full paid access at no charge</strong>.
              No payment method is required to start the trial.
            </p>
            <p>
              At the end of the 14 days, your account soft-downgrades
              to the Free plan automatically unless you actively
              subscribe. We will not bill you unless you provide a
              payment method and confirm a subscription. You keep your
              slug, your reviews, your Content and your Business App
              layout either way.
            </p>
          </Section>

          {/* ─── 9. Billing and auto-renewal ──────────────────── */}
          <Section n="9" title="Billing and auto-renewal (important)">
            <p>
              <strong>
                Paid Plan subscriptions renew automatically. By
                starting a Paid Plan subscription and providing a
                payment method, you authorise us (through our payment
                processor) to charge that payment method on each
                renewal date until you cancel.
              </strong>
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Monthly plans</strong> renew every month on
                the same day of the month as the first charge.
              </li>
              <li>
                <strong>Annual plans</strong> renew every year on the
                same date as the first charge.
              </li>
              <li>
                Payments are processed by{" "}
                <strong>our payment processor</strong>, a
                PCI-DSS-compliant third party. All card data is handled
                directly by the payment processor; we never see or
                store your full card number.
              </li>
              <li>
                Renewal charges appear on your statement as
                &ldquo;Xrated Trades&rdquo; or &ldquo;XRATEDTRADE&rdquo;.
              </li>
              <li>
                You can view upcoming charges, update your payment
                method, and cancel renewal at any time from the
                billing section of your Xrated Trades dashboard.
              </li>
            </ul>
            <p>
              If a renewal payment fails, our payment processor will
              retry over the following week. If all retries fail, your
              account moves to the Free plan and paid-only features
              are disabled until you update your payment method.
            </p>
          </Section>

          {/* ─── 10. Cancellation and 14-day cooling-off ──────── */}
          <Section n="10" title="Cancellation and 14-day cooling-off">
            <p>
              <strong>
                EU and UK consumers benefit from a statutory 14-day
                cooling-off period under the Consumer Rights Directive
                (2011/83/EU) and the UK Consumer Contracts (Information,
                Cancellation and Additional Charges) Regulations 2013.
              </strong>{" "}
              You have 14 days from the date of your first Paid Plan
              charge to cancel for a full refund. This is your
              statutory cooling-off period for distance contracts.
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
              <strong>Waiver during cooling-off.</strong> If you ask us
              to start providing paid features immediately (for example
              by installing a paid App, publishing a Studio layout that
              uses paid features, or using a premium Industry Pack
              during the 14 days) and then cancel within the
              cooling-off window, we may deduct a proportionate amount
              for the service already supplied. If you use the paid
              features substantially during the cooling-off period you
              may lose the right to a full refund, in line with
              regulation 36 of the UK Regulations.
            </p>
            <p>
              <strong>After the cooling-off window:</strong>
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Monthly plans</strong> — cancel any time. You
                keep access until the end of the current paid month.
                We do not refund the unused portion of the current
                month.
              </li>
              <li>
                <strong>Annual plans</strong> — cancel any time. You
                keep access until the end of the current paid year.
                We do not refund the unused portion outside the
                cooling-off window, except where the Service has been
                unavailable to you for more than 7 consecutive days
                due to our fault (see clause 18).
              </li>
            </ul>
            <p>
              <strong>How to cancel:</strong>
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                Open your Xrated Trades dashboard and click{" "}
                <strong>Billing &rarr; Manage subscription</strong>.
              </li>
              <li>
                Or email{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                  {SUPPORT_EMAIL}
                </a>{" "}
                from the address on your account and ask us to cancel.
                We&rsquo;ll confirm in writing within 1 working day.
              </li>
            </ul>
            <p>
              Full details, including refund timelines, are set out in
              our{" "}
              <a href="/legal/refunds" className="font-bold underline">
                Refund Policy
              </a>
              .
            </p>
          </Section>

          {/* ─── 11. App Store and Apps ───────────────────────── */}
          <Section n="11" title="App Store and Apps">
            <p>
              The App Store is a catalogue of Apps that add features
              to your Business App. Some Apps are free; some require a
              specific paid plan or an additional monthly fee.
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Installing an App</strong> writes a record to
                your account, may create pages inside your Business
                App, may add navigation entries, and may run background
                jobs on your behalf. The App&rsquo;s manifest describes
                exactly what capabilities and permissions the App
                requests. You are asked to confirm before installation.
              </li>
              <li>
                <strong>Uninstalling an App</strong> hides its
                features from your live Business App and stops any
                associated billing at the end of the current cycle. By
                default, your Content associated with the App is{" "}
                <strong>preserved</strong> so that reinstalling the App
                restores your setup. To hard-delete an App&rsquo;s
                content, use the &ldquo;Purge data&rdquo; option
                explicitly — this is irreversible.
              </li>
              <li>
                <strong>First-party Apps</strong> (published by Xrated
                Trades) are covered by these Terms.
              </li>
              <li>
                <strong>Third-party Apps.</strong> If we ever make
                third-party Apps available (via a developer program),
                the third-party developer is responsible for that App,
                and you agree to that developer&rsquo;s additional
                terms at install. Xrated Trades is not liable for a
                third-party App&rsquo;s functionality, security,
                content, or business practices, except where required
                by mandatory law.
              </li>
              <li>
                <strong>Included Apps.</strong> Some Apps are described
                as &ldquo;included&rdquo; on a Paid Plan. If you
                downgrade below that plan, the App remains installed
                but its features cease to render on your Business App
                until you upgrade or install the App as a paid add-on.
              </li>
            </ul>
          </Section>

          {/* ─── 12. Industry Packs ───────────────────────────── */}
          <Section n="12" title="Industry Packs">
            <p>
              Industry Packs bundle a curated set of Apps, brand tokens
              and starter content for a specific trade vertical.
              Installing an Industry Pack installs each App in the
              bundle, seeds theme tokens where none are set, and seeds
              a starter home-page layout only if your home page is
              empty. Your existing customisations are preserved.
            </p>
            <p>
              Uninstalling an Industry Pack uninstalls the Apps the
              Pack brought in (using the App uninstall rules in
              clause 11) but does not revert your brand tokens or
              layout changes.
            </p>
          </Section>

          {/* ─── 13. Studio and your Business App ─────────────── */}
          <Section n="13" title="Studio and your Business App">
            <p>
              Studio is a visual editor. When you publish a change in
              Studio, that change becomes visible on your live
              Business App. Publishing writes an immutable version
              you can restore later from the version history.
            </p>
            <p>
              You are responsible for the accuracy and legality of
              everything you publish. We are a hosting and editing
              platform; we do not vet or endorse the copy, prices,
              images, downloads or Apps you install and publish
              through Studio.
            </p>
          </Section>

          {/* ─── 14. Third-party services ─────────────────────── */}
          <Section n="14" title="Third-party services">
            <p>
              The Service integrates with third-party services (for
              example WhatsApp Business, our payment processor, email
              delivery providers, map providers, analytics providers).
              We do not control those third parties. Their terms and
              privacy policies apply when you or your customers use
              their services through the platform.
            </p>
            <p>
              You are responsible for your own compliance with the
              third-party terms and applicable law when you configure
              third-party integrations. For example, if you enable a
              newsletter App you are the data controller for the email
              addresses you collect; you must comply with UK GDPR /
              PECR requirements.
            </p>
          </Section>

          {/* ─── 15. Acceptable use ───────────────────────────── */}
          <Section n="15" title="Acceptable use">
            <p>You agree not to use the Service to:</p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                post fake reviews, fabricated case studies or
                testimonials you cannot evidence;
              </li>
              <li>
                impersonate another tradesperson, company or trade
                body (Gas Safe, NICEIC, FENSA, FMB, CISRS, CSCS etc.);
              </li>
              <li>
                advertise services that require a licence or
                qualification you do not hold;
              </li>
              <li>
                upload Content that is illegal, defamatory, obscene,
                harassing, or that infringes anyone else&rsquo;s
                intellectual property or privacy;
              </li>
              <li>
                scrape, mirror, resell, reverse-engineer, decompile or
                attempt to derive the source of the Service or any
                other user&rsquo;s Content;
              </li>
              <li>
                use the Service to send unsolicited bulk messages or
                to run lead-generation farms for third parties;
              </li>
              <li>
                interfere with the security or availability of the
                Service (denial of service, port scanning, exploiting
                bugs, bypassing rate limits, etc.);
              </li>
              <li>
                use automated means (bots, scripts) to create accounts,
                install Apps, submit reviews or generate Content.
              </li>
            </ul>
            <p>
              We may suspend or close your account without refund if
              we reasonably believe you have breached this clause. We
              will tell you why where we can.
            </p>
            <p>
              The full rules and the consequences of breach are set
              out in our{" "}
              <a href="/legal/aup" className="font-bold underline">
                Acceptable Use Policy
              </a>
              .
            </p>
          </Section>

          {/* ─── 16. Customer reviews ─────────────────────────── */}
          <Section n="16" title="Customer reviews">
            <p>
              Customers can submit reviews on your public Business App
              when you are on a Paid Plan or when the Reviews feature
              is unlocked on your plan. Reviews are the opinions of the
              people who write them and do not represent the views of
              Xrated Trades.
            </p>
            <p>
              We do not pre-moderate every review, but we will remove a
              review that is clearly fake, defamatory, or breaches the
              Acceptable Use Policy in clause 15, if you flag it to us
              with evidence.
            </p>
          </Section>

          {/* ─── 17. Your Content and our platform ────────────── */}
          <Section n="17" title="Your Content and our platform">
            <p>
              <strong>You own your Content.</strong> Reviews submitted
              by your customers, photos you upload, the products and
              services you list, your bio, your team information and
              your branding all remain yours.
            </p>
            <p>
              <strong>You grant us a licence to display it.</strong> So
              that we can run the Service, you give us a worldwide,
              royalty-free, non-exclusive licence to host, copy, cache,
              display, transmit and distribute your Content on
              xratedtrade.com, on our related domains, in search
              results, in our progressive web app, and in promotional
              materials for the Service. This licence ends when you
              close your account, except where we are legally required
              to keep a copy (for example for tax or dispute records).
            </p>
            <p>
              <strong>We own the platform.</strong> The Xrated Trades
              software, the Studio editor, the App Store,
              Industry Packs, our design system, brand, copy, logos,
              illustrations, and the database and code that organise
              your Content are owned by us or our licensors. You
              receive the right to use the Service under these Terms;
              you do not receive any ownership of it. All rights not
              expressly granted to you are reserved.
            </p>
            <p>
              <strong>App submissions and materials we create.</strong>{" "}
              If you submit an App idea through the Studio &ldquo;Describe
              your app&rdquo; recommender or otherwise ask us to build an
              App, section, template, calculator, or other feature on
              your behalf, then any App, code, design, layout, prompt,
              configuration, description, illustration, and other
              material created as a result — whether built by our team
              or generated by our AI tooling — becomes the exclusive
              property of xratedtrade.com. This applies whether we ship
              the resulting App to the public App Store or use the
              submission for internal purposes only. You waive any
              moral rights in the submission to the extent permitted by
              law. In return, you get automatic and free access to any
              resulting App on the terms it&rsquo;s listed under. This
              clause is what lets us convert good merchant ideas into
              production Apps every other merchant can install.
            </p>
          </Section>

          {/* ─── 18. Service availability ────────────────────── */}
          <Section n="18" title="Service availability">
            <p>
              We aim to keep the Service available 24/7 but we do not
              guarantee uninterrupted access. We may need to take the
              Service down for maintenance, upgrades or for reasons
              outside our reasonable control (including third-party
              hosting, network or utility failures). Where downtime is
              planned, we will try to give notice in the dashboard or
              by email.
            </p>
          </Section>

          {/* ─── 19. Warranty disclaimer ─────────────────────── */}
          <Section n="19" title="Warranty disclaimer">
            <p>
              To the maximum extent permitted by applicable law, the
              Service, the App Store, all Apps, all Industry Packs and
              all Content are provided <strong>&ldquo;as is&rdquo;</strong>{" "}
              and <strong>&ldquo;as available&rdquo;</strong>, without
              warranties of any kind, whether express, implied,
              statutory or otherwise, including any implied warranties
              of merchantability, fitness for a particular purpose,
              non-infringement, or that the Service will be
              uninterrupted or error-free.
            </p>
            <p>
              We do not warrant that the Service will meet any
              specific commercial objective, that any App will bring
              you a particular volume of enquiries, or that any AI
              feature will produce accurate or lawful output.
            </p>
            <p>
              Nothing in this clause limits any warranty or right that
              cannot be excluded under mandatory consumer-protection
              law of your country of residence.
            </p>
          </Section>

          {/* ─── 20. Limitation of liability ─────────────────── */}
          <Section n="20" title="Limitation of liability">
            <p>
              Nothing in these Terms limits or excludes our liability
              for death or personal injury caused by our negligence,
              for fraud or fraudulent misrepresentation, or for any
              other liability that cannot be limited under Irish law
              (or the mandatory consumer-protection law of your
              country of residence).
            </p>
            <p>
              Subject to the above, our total liability to you for any
              claim arising out of or in connection with the Service{" "}
              <strong>
                is capped at the total subscription fees you have paid
                us in the 12 months immediately before the event that
                gave rise to the claim
              </strong>
              . Where you are on the Free plan, our aggregate liability
              is capped at &pound;100.
            </p>
            <p>
              We are not liable for loss of profits, loss of business,
              loss of goodwill, loss of anticipated savings, loss of
              data (except where we have failed to take reasonable
              steps to protect it) or any indirect or consequential
              loss.
            </p>
            <p>
              The Service is a platform for your business. We are not
              responsible for the jobs you win or lose through it, the
              quality of the work you do, the conduct of your
              customers, the accuracy of any AI-generated content, or
              any contract you enter into with a customer you meet
              through the Service.
            </p>
          </Section>

          {/* ─── 21. Indemnification ─────────────────────────── */}
          <Section n="21" title="Indemnification">
            <p>
              You agree to indemnify and hold harmless Xrated Trades,
              its officers, employees and agents from and against any
              third-party claims, damages, liabilities, costs and
              reasonable legal fees arising out of or related to:
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>your Content;</li>
              <li>your breach of these Terms or of applicable law;</li>
              <li>
                your use of any App or Industry Pack in a manner not
                permitted by its documentation;
              </li>
              <li>
                any claim by your customers regarding the goods or
                services you offer, sell or perform through the
                Service.
              </li>
            </ul>
            <p>
              We will tell you about any such claim as soon as we can,
              cooperate reasonably in the defence, and let you control
              the defence and settlement (provided any settlement
              releases us fully and does not admit fault on our
              behalf).
            </p>
          </Section>

          {/* ─── 22. Termination ─────────────────────────────── */}
          <Section n="22" title="Termination">
            <p>
              You can close your account at any time by emailing{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              from the address on your account.
            </p>
            <p>
              We can suspend or close your account on notice if you
              breach these Terms, fail to pay, or use the Service in a
              way that exposes us or other users to harm or legal
              risk. In serious cases (fraud, illegal Content, abuse,
              or persistent violation of the Acceptable Use Policy) we
              can close the account immediately and without refund.
            </p>
            <p>
              When the account closes, your Business App is removed
              from the public web and your Content is deleted from
              active systems within 30 days, except where we are
              required to keep records for accounting, tax or legal
              reasons, or where you have expressly consented to us
              retaining certain data.
            </p>
            <p>
              Clauses that by their nature should survive termination
              (definitions, IP ownership, warranty disclaimer,
              limitation of liability, indemnification, governing
              law) survive termination.
            </p>
          </Section>

          {/* ─── 23. Changes to the Service or these Terms ───── */}
          <Section n="23" title="Changes to the Service or these Terms">
            <p>
              We are continuously improving the Service. Small changes
              (new features, design tweaks, bug fixes, new Apps in the
              App Store) happen at any time without notice. For
              material changes that disadvantage you (a price rise,
              removal of a paid feature, a change to your refund
              rights, a change to jurisdiction), we will give you at
              least <strong>30 days&rsquo; notice by email</strong> and
              you may cancel before the change takes effect.
            </p>
          </Section>

          {/* ─── 24. Governing law and disputes ──────────────── */}
          <Section n="24" title="Governing law and disputes">
            <p>
              These Terms are governed by the laws of the{" "}
              <strong>Republic of Ireland</strong>. Any dispute will be
              heard by the courts of the Republic of Ireland. Consumers
              retain the protection of any mandatory
              consumer-protection laws of their country of residence
              that cannot be displaced by contract.
            </p>
            <p>
              If you have a complaint, please email us first at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              so we can try to put it right. We aim to respond within 5
              working days.
            </p>
          </Section>

          {/* ─── 25. Miscellaneous ───────────────────────────── */}
          <Section n="25" title="Miscellaneous">
            <ul className="ml-4 flex list-disc flex-col gap-2">
              <li>
                <strong>Entire agreement.</strong> These Terms, the
                Privacy Policy, the Acceptable Use Policy, the Refund
                Policy, and any plan- or App-specific terms are the
                entire agreement between you and us regarding the
                Service.
              </li>
              <li>
                <strong>Severability.</strong> If any part of these
                Terms is held unenforceable, the remainder continues
                in force.
              </li>
              <li>
                <strong>No waiver.</strong> Failing to enforce a right
                does not waive our ability to enforce it later.
              </li>
              <li>
                <strong>Assignment.</strong> You may not assign these
                Terms without our consent. We may assign them to a
                successor entity (for example on a corporate
                reorganisation or acquisition) without your consent,
                provided your rights are not materially reduced.
              </li>
              <li>
                <strong>No third-party beneficiaries.</strong> These
                Terms do not create any rights in favour of any
                person who is not a party to them.
              </li>
            </ul>
          </Section>

          {/* ─── 26. Contact ─────────────────────────────────── */}
          <Section n="26" title="Contact">
            <p>
              <strong>Xrated Trades</strong>
              <br />
              Email:{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
                {SUPPORT_EMAIL}
              </a>
            </p>
            <p>
              We aim to respond to legal or subscription queries within
              5 working days and to urgent security issues within 1
              working day.
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
        This is a comprehensive Shopify/Wix-style Terms template
        drafted for the Xrated Trades Business Operating System
        (Studio, App Store, Industry Packs, four-tier pricing). It
        must be reviewed by a UK-qualified solicitor before being
        relied upon in production. Payment-processor references use
        generic wording pending live billing integration.
      </p>
    </aside>
  );
}
