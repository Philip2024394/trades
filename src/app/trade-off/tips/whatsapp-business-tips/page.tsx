// Xrated Trades — Tips guide: WhatsApp Business for tradies.
// Long-form Article-schema page covering profile setup, quick replies,
// auto-replies, catalogue, broadcast vs groups, labels, voice notes.
// Server component, reuses XratedHeader/Footer.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { CaseStudyCallout } from "@/components/xrated/tips/CaseStudyCallout";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

const TITLE = "WhatsApp Business tips for tradies";
const DESCRIPTION =
  "Set up WhatsApp Business properly — quick-reply templates, out-of-hours auto-replies, the catalogue feature, labels for tracking jobs, and the voice-note habit that saves an hour a day.";
const SLUG = "/trade-off/tips/whatsapp-business-tips";
const HERO =
  "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/guide-whatsapp-business-tips.png";

export const metadata: Metadata = {
  title: `${TITLE} | thenetworkers.app guides`,
  description: DESCRIPTION,
  alternates: { canonical: SLUG },
  openGraph: {
    type: "article",
    siteName: BRAND.name,
    title: TITLE,
    description: DESCRIPTION,
    url: absolute(SLUG),
    images: [{ url: HERO, alt: TITLE }]
  }
};

const ARTICLE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  author: { "@type": "Organization", name: "thenetworkers.app" },
  publisher: {
    "@type": "Organization",
    name: "thenetworkers.app",
    logo: { "@type": "ImageObject", url: BRAND.logo }
  },
  datePublished: "2026-06-28",
  dateModified: "2026-06-28",
  description: DESCRIPTION,
  mainEntityOfPage: { "@type": "WebPage", "@id": absolute(SLUG) },
  image: HERO
};

export default function GuideWhatsappBusiness() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_JSONLD) }}
      />

      <article className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <a
          href="/trade-off/tips"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-neutral-500 transition hover:text-neutral-900"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to all tips
        </a>

        <TopicBadge>WhatsApp</TopicBadge>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
          WhatsApp is where most British tradies do their actual
          customer service. The free WhatsApp Business app does ninety
          per cent of what a CRM costs &pound;30/mo for. Here’s
          how to set it up properly.
        </p>
        <Byline minutes={7} />

        <Section heading="1. Set up the business profile properly">
          <p>
            Download WhatsApp Business (separate app from regular
            WhatsApp — you can use both on the same phone, on
            different numbers). Open the Business Tools menu. Fill in
            every field: your trade, your service area, your address (or
            workshop), your opening hours, your website (point it at
            your Xrated profile if you don’t have your own site).
          </p>
          <p>
            Why this matters: that information shows in the customer’s
            chat sidebar when they tap your name. It is silent
            credibility — a customer who taps in and sees
            “Open until 6pm, Leeds-based plumber, 7 years
            trading” feels safer messaging you than a blank profile.
          </p>
        </Section>

        <Section heading="2. Quick replies — templates for the messages you send daily">
          <p>
            WhatsApp Business has a quick replies feature (Business
            Tools &rarr; Quick replies). You write a template, give it
            a short keyword, and from then on typing “/quote”
            pastes the whole message. Save five templates immediately:
          </p>
          <Bullets>
            <li>
              <strong>/quote</strong> — “Thanks for getting
              in touch. To send a fair quote I’ll need: your
              postcode, a couple of photos of the area, and a rough idea
              of when you’d like the work done. Drop those over
              and I’ll get a number back to you today.”
            </li>
            <li>
              <strong>/yes</strong> — “Yes I cover that
              postcode. Happy to come out and quote — what day
              works for you?”
            </li>
            <li>
              <strong>/no</strong> — polite decline outside your
              area, with a referral to a tradesperson who does cover it.
            </li>
            <li>
              <strong>/booked</strong> — confirmation message with
              date, arrival time and what they need to have ready.
            </li>
            <li>
              <strong>/review</strong> — the message you send when
              the job’s done, asking for a review with a one-tap
              link to your Xrated profile.
            </li>
          </Bullets>
        </Section>

        <Section heading="3. Auto-replies for out-of-hours">
          <p>
            Business Tools &rarr; Away message. Set your business hours
            (Mon-Fri 7am-6pm is normal for most trades). Outside those
            hours, a customer who messages you gets an automatic reply.
            Something like: “Thanks for your message — I’m
            off the tools until 7am. I’ll come back to you first
            thing tomorrow.”
          </p>
          <p>
            Add a separate greeting message for first-time contacts
            (same menu). “Hi, thanks for messaging. I’m
            usually quickest to reply on WhatsApp — what trade do
            you need and what postcode are you in?” That single
            sentence cuts the time-to-quote by hours because they answer
            both questions before you ever look at your phone.
          </p>
        </Section>

        <Section heading="4. The catalogue feature most tradies don’t know exists">
          <p>
            Business Tools &rarr; Catalogue. You can list services or
            products with a price and a photo. For a tradesperson with
            fixed-price service tiers — boiler service, gutter
            clean, oven install, drain unblock — the catalogue
            does the price quote for you.
          </p>
          <p>
            When a customer asks “how much for a boiler
            service?” you can send them the catalogue item with
            one tap. Photo, price, description, all there. It works
            especially well for sparks, plumbers, gas engineers and
            anyone with a list of standard call-out jobs.
          </p>
        </Section>

        <Section heading="5. Broadcast lists vs groups">
          <p>
            Broadcast lists are the right tool for “here’s a
            quick update to my last twenty customers”. Every
            recipient sees a normal one-to-one message from you. They
            cannot see each other. Best for: announcing seasonal
            availability, a price change, a new service.
          </p>
          <p>
            Groups are the wrong tool for customers. Everyone can see
            everyone else’s number. You’ll get one customer
            complaining about another, and you’ll lose both. Use
            groups for your crew, your suppliers and your trusted
            tradesperson network — never for customers.
          </p>
        </Section>

        <Section heading="6. Labels — the secret pipeline tool">
          <p>
            Long-press a chat and you get the option to add a label.
            Set up four:
          </p>
          <Bullets>
            <li>
              <strong>Quote sent</strong> — waiting for them to
              confirm.
            </li>
            <li>
              <strong>Booked</strong> — in the diary, has a date.
            </li>
            <li>
              <strong>On site</strong> — job in progress.
            </li>
            <li>
              <strong>Done — ask for review</strong> — the
              follow-up trigger.
            </li>
          </Bullets>
          <p>
            From then on you can tap a label to see every chat in that
            stage. That is a free, mobile-only sales pipeline. Once a
            week, scroll “Quote sent” and follow up on
            anyone who’s gone quiet for more than two days —
            a polite WhatsApp wins more jobs than tradies realise.
          </p>
        </Section>

        <Section heading="7. Voice notes for explaining technical problems">
          <p>
            A customer sends a photo of a weeping radiator valve and
            asks “is this a big problem?”. Typing back a
            paragraph takes you four minutes and reads like a manual.
            A thirty-second voice note saying “yeah it’s
            the gland nut, fifty quid fix, I can do it Tuesday
            afternoon” takes thirty seconds and lands like a
            conversation with someone who knows what they’re
            doing.
          </p>
          <p>
            Customers prefer voice notes from tradies because they sound
            like the in-person chat they expected. Use them for anything
            longer than three sentences.
          </p>
        </Section>

        <Section heading="8. The one rule that protects your evenings">
          <p>
            Tell customers, in your auto-reply and in your first
            response: “I’m on the tools until 6pm and
            reply between 6 and 7. Anything urgent before then, ring
            me.” You train them. They will respect it. You will
            get your evenings back.
          </p>
        </Section>

        <CaseStudyCallout
          slug="demo-rebecca-fawcett-tool-hire-derby"
          title="See Rebecca's WhatsApp-led hire profile →"
          subtitle="Tool hire in Derby — phone the yard, tell them what the job is, they suggest the right tool. The whole profile is built around making that first WhatsApp easy to start."
        />

        <ClosingCta />
      </article>

      <XratedFooter />
    </main>
  );
}

function TopicBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900"
      style={{ background: XRATED_BRAND.accent }}
    >
      {children}
    </span>
  );
}

function Byline({ minutes }: { minutes: number }) {
  return (
    <p className="mt-4 text-[13px] text-neutral-500">
      {minutes} min read · The thenetworkers.app team
    </p>
  );
}

function Section({
  heading,
  children
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-extrabold leading-snug text-neutral-900 sm:text-2xl">
        {heading}
      </h2>
      <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
        {children}
      </div>
    </section>
  );
}

function Bullets({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-5 list-disc space-y-2 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
      {children}
    </ul>
  );
}

function ClosingCta() {
  return (
    <section
      className="mt-12 overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-10"
      style={{ background: "#0A0A0A" }}
    >
      <p
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color: XRATED_BRAND.accent }}
      >
        Try Xrated Trades
      </p>
      <h2 className="mt-2 text-xl font-extrabold leading-tight text-white sm:text-3xl">
        Free for 14 days. No card. No commission.
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-[13px] text-white/80 sm:text-sm">
        Add a one-tap WhatsApp button to your Xrated profile. One link
        for every customer, every quote, every follow-up.
      </p>
      <a
        href="/trade-off/signup"
        className="mt-5 inline-flex h-12 items-center gap-2 rounded-lg px-6 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
        style={{
          background: XRATED_BRAND.accent,
          boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
        }}
      >
        Join Thenetworkers
      </a>
    </section>
  );
}
